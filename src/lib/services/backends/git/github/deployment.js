import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { findURLInSummary, pickDeployment } from '$lib/services/backends/git/shared/deployment';

/**
 * @import { DeployState, DeployStatus, DeployTarget } from '$lib/types/private';
 * @import { DeployCandidate } from '$lib/services/backends/git/shared/deployment';
 */

/**
 * Manually trigger a deployment with GitHub Actions by dispatching the `repository_dispatch` event.
 * @returns {Promise<Response>} Response.
 * @see https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event
 */
export const triggerDeployment = async () => {
  const { owner, repo } = repository;

  return /** @type {Promise<Response>} */ (
    fetchAPI(`/repos/${owner}/${repo}/dispatches`, {
      method: 'POST',
      body: { event_type: 'sveltia-cms-publish' },
      responseType: 'raw',
    })
  );
};

/**
 * Maximum number of commits to look up in one GraphQL request, and deployments to read per commit.
 * A commit rarely has more than a couple of deployments; the cap only guards a repository where
 * several providers are connected at once.
 */
const MAX_ITEMS = { commits: 20, deployments: 10, checkSuites: 10, checkRuns: 20 };

/**
 * Map a GraphQL `StatusState` to a normalized state. `EXPECTED` means a required check hasn’t
 * reported yet, so it’s treated the same as a running build.
 * @type {Record<string, DeployState>}
 * @see https://docs.github.com/en/graphql/reference/enums#statusstate
 */
const STATUS_STATE_MAP = {
  SUCCESS: 'ready',
  PENDING: 'pending',
  EXPECTED: 'pending',
  FAILURE: 'error',
  ERROR: 'error',
};

/**
 * Map a GraphQL `DeploymentStatusState` to a normalized state. `INACTIVE` and `DESTROYED` are
 * absent, so a superseded or torn-down environment is skipped rather than reported as a preview.
 * @type {Record<string, DeployState>}
 * @see https://docs.github.com/en/graphql/reference/enums#deploymentstatusstate
 */
const DEPLOYMENT_STATE_MAP = {
  SUCCESS: 'ready',
  PENDING: 'pending',
  QUEUED: 'pending',
  IN_PROGRESS: 'pending',
  WAITING: 'pending',
  FAILURE: 'error',
  ERROR: 'error',
};

/**
 * Map a GraphQL `CheckConclusionState` to a normalized state. `CANCELLED`, `SKIPPED` and `STALE`
 * are absent, so a run that produced nothing is ignored rather than reported as a preview.
 * @type {Record<string, DeployState>}
 * @see https://docs.github.com/en/graphql/reference/enums#checkconclusionstate
 */
const CHECK_CONCLUSION_MAP = {
  SUCCESS: 'ready',
  NEUTRAL: 'ready',
  FAILURE: 'error',
  TIMED_OUT: 'error',
  STARTUP_FAILURE: 'error',
  ACTION_REQUIRED: 'error',
};

/**
 * Names that say a check run offers a deploy preview at its own URL rather than pointing at a build
 * page. It’s only consulted when the run publishes no address in its output summary — AWS Amplify
 * reports “AWS Amplify Console Web Preview” and links straight to the preview, while Cloudflare
 * Pages links to its dashboard and puts the address in the summary instead.
 */
const PREVIEW_CHECK_NAME_REGEX = /preview/i;

/**
 * Fetch the head commit of the configured branch, which is the commit the production site is built
 * from.
 * @returns {Promise<string | undefined>} Commit SHA, or `undefined` if it couldn’t be resolved.
 * @see https://docs.github.com/en/graphql/reference/objects#ref
 */
export const fetchBranchHeadSHA = async () => {
  const { repository: result } = /** @type {Record<string, any>} */ (
    await fetchGraphQL(`
      query($owner: String!, $repo: String!, $branch: String!) {
        repository(owner: $owner, name: $repo) {
          ref(qualifiedName: $branch) {
            target {
              ... on Commit {
                oid
              }
            }
          }
        }
      }
    `)
  );

  return result?.ref?.target?.oid ?? undefined;
};

/**
 * Build a batched query that reads the given field from each commit. GraphQL aliases can’t be
 * variables, so the commit SHAs are inlined the same way {@link fetchPullRequestFiles} does.
 * @param {string[]} shas Commit SHAs.
 * @param {string} selection Inner selection on the `Commit` type.
 * @returns {string} GraphQL query.
 */
const buildCommitQuery = (shas, selection) => `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      ${shas
        .map(
          (sha, index) => `
            commit_${index}: object(oid: ${JSON.stringify(sha)}) {
              ... on Commit {
                ${selection}
              }
            }
          `,
        )
        .join('')}
    }
  }
`;

/**
 * What to ask for on each commit, and how to read the answer. Keeping the two side by side lets the
 * three be asked for together in one request, or separately when that isn’t possible.
 * @type {Record<string, { selection: string, parse: (commit: any, sha: string,
 * candidateMap: Record<string, DeployCandidate[]>) => void }>}
 */
const SOURCES = {
  /**
   * Commit statuses, where an external CI service posts a build result when it posts one at all.
   * @see https://docs.github.com/en/graphql/reference/objects#status
   */
  status: {
    selection: 'status { contexts { context state targetUrl description } }',
    /**
     * Read the commit statuses from one commit node.
     * @param {any} commit Commit node.
     * @param {string} sha Commit SHA.
     * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate.
     */
    parse: (commit, sha, candidateMap) => {
      (commit?.status?.contexts ?? []).forEach(
        (/** @type {Record<string, any>} */ { context, state, targetUrl, description }) => {
          const mapped = STATUS_STATE_MAP[state];

          if (mapped) {
            candidateMap[sha].push({
              name: context ?? '',
              url: targetUrl ?? undefined,
              state: mapped,
              description: description ?? undefined,
              source: 'status',
            });
          }
        },
      );
    },
  },

  /**
   * Deployments. Vercel and GitHub Pages report here, and unlike a commit status target URL, the
   * environment URL is guaranteed to point at the site rather than a build log. Cloudflare, both
   * Pages and Workers, reports through check runs instead.
   * @see https://docs.github.com/en/graphql/reference/objects#deployment
   */
  deployments: {
    selection: `deployments(
      last: ${MAX_ITEMS.deployments}
      orderBy: { field: CREATED_AT, direction: ASC }
    ) {
      nodes {
        environment
        latestStatus {
          state
          environmentUrl
          description
        }
      }
    }`,
    /**
     * Read the deployments from one commit node.
     * @param {any} commit Commit node.
     * @param {string} sha Commit SHA.
     * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate.
     */
    parse: (commit, sha, candidateMap) => {
      (commit?.deployments?.nodes ?? []).forEach(
        (/** @type {Record<string, any>} */ { environment, latestStatus }) => {
          const mapped = DEPLOYMENT_STATE_MAP[latestStatus?.state];

          if (mapped) {
            candidateMap[sha].push({
              name: environment ?? '',
              url: latestStatus?.environmentUrl ?? undefined,
              state: mapped,
              description: latestStatus?.description ?? undefined,
              source: 'deployment',
            });
          }
        },
      );
    },
  },

  /**
   * Check runs. Most are ordinary CI jobs whose details URL is a build log, but a few providers
   * publish the preview URL here and nowhere else: Cloudflare Pages writes it into the run’s output
   * summary, and AWS Amplify links its “AWS Amplify Console Web Preview” run straight at the site.
   * @see https://docs.github.com/en/graphql/reference/objects#checkrun
   * @see https://github.com/decaporg/decap-cms/issues/5161
   */
  checks: {
    selection: `checkSuites(last: ${MAX_ITEMS.checkSuites}) {
      nodes {
        checkRuns(last: ${MAX_ITEMS.checkRuns}) {
          nodes {
            name
            status
            conclusion
            detailsUrl
            summary
          }
        }
      }
    }`,
    /**
     * Read the check runs from one commit node.
     * @param {any} commit Commit node.
     * @param {string} sha Commit SHA.
     * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate.
     */
    parse: (commit, sha, candidateMap) => {
      (commit?.checkSuites?.nodes ?? []).forEach((/** @type {Record<string, any>} */ suite) => {
        (suite?.checkRuns?.nodes ?? []).forEach(
          (
            /** @type {Record<string, any>} */ { name, status, conclusion, detailsUrl, summary },
          ) => {
            // A run that hasn’t finished has no conclusion yet, so the status carries the state
            const mapped = status === 'COMPLETED' ? CHECK_CONCLUSION_MAP[conclusion] : 'pending';

            if (mapped) {
              candidateMap[sha].push({
                name: name ?? '',
                // A URL published in the output is the provider saying where the site went, so it’s
                // taken at face value. The check’s own link is usually a build page, and is trusted
                // only when the run names itself a preview, as AWS Amplify’s does
                url:
                  findURLInSummary(summary, detailsUrl) ??
                  (PREVIEW_CHECK_NAME_REGEX.test(name ?? '')
                    ? (detailsUrl ?? undefined)
                    : undefined),
                state: mapped,
                source: 'check',
              });
            }
          },
        );
      });
    },
  },
};

/**
 * Whether the three sources have to be asked for one at a time. GitHub answers a query touching an
 * unavailable field with partial data *and* an `errors` array, which the shared request helper
 * treats as a failure — so one missing field would cost all three. That’s rare, and permanent for a
 * given repository and token, so it’s discovered once and remembered rather than assumed every
 * time. A transient failure latches this too, which only costs extra requests.
 */
let askSeparately = false;

/**
 * Ask for all three sources in a single request.
 * @param {string[]} shas Commit SHAs.
 * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate, keyed by commit SHA.
 */
const collectTogether = async (shas, candidateMap) => {
  const selection = Object.values(SOURCES)
    .map(({ selection: part }) => part)
    .join('\n');

  const { repository: result } = /** @type {Record<string, any>} */ (
    await fetchGraphQL(buildCommitQuery(shas, selection))
  );

  shas.forEach((sha, index) => {
    Object.values(SOURCES).forEach(({ parse }) =>
      parse(result?.[`commit_${index}`], sha, candidateMap),
    );
  });
};

/**
 * Ask for each source in its own request, so an unavailable field only costs its own source.
 * @param {string[]} shas Commit SHAs.
 * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate, keyed by commit SHA.
 */
const collectOneByOne = async (shas, candidateMap) => {
  await Promise.all(
    Object.values(SOURCES).map(async ({ selection, parse }) => {
      try {
        const { repository: result } = /** @type {Record<string, any>} */ (
          await fetchGraphQL(buildCommitQuery(shas, selection))
        );

        shas.forEach((sha, index) => parse(result?.[`commit_${index}`], sha, candidateMap));
      } catch (ex) {
        // A missing or restricted field shouldn’t take the other sources down with it
        // eslint-disable-next-line no-console
        console.warn('Failed to fetch the deployment info.', ex);
      }
    }),
  );
};

/**
 * Fetch the deployment status and URL for the given commits. All three sources are asked for in one
 * request, dropping to one request each only if that fails — which happens when a field is
 * unavailable, on GitHub Enterprise Server or with a token lacking deployment scope, because the
 * API answers with partial data and an error together and the shared request helper rejects the
 * whole response. A repository that needs the split pays for discovering it once.
 * @param {DeployTarget[]} targets Commits to look up.
 * @returns {Promise<Record<string, DeployStatus>>} Deployments keyed by commit SHA.
 */
export const fetchDeployments = async (targets) => {
  // A pull request created in an older session may have no head commit recorded yet
  const validTargets = targets.filter(({ sha }) => !!sha);
  // Two pull requests can share a head commit, so look each one up only once
  const shas = [...new Set(validTargets.map(({ sha }) => sha))];

  if (!shas.length) {
    return {};
  }

  /** @type {Record<string, DeployCandidate[]>} */
  const candidateMap = Object.fromEntries(shas.map((sha) => [sha, []]));
  /** @type {string[][]} */
  const chunks = [];

  for (let i = 0; i < shas.length; i += MAX_ITEMS.commits) {
    chunks.push(shas.slice(i, i + MAX_ITEMS.commits));
  }

  await runConcurrently(chunks, async (chunk) => {
    if (!askSeparately) {
      try {
        await collectTogether(chunk, candidateMap);

        return;
      } catch (ex) {
        // eslint-disable-next-line no-console
        console.warn('Falling back to a request per deployment source.', ex);
        askSeparately = true;
      }
    }

    await collectOneByOne(chunk, candidateMap);
  });

  return Object.fromEntries(
    validTargets.map(({ sha, kind }) => [
      sha,
      pickDeployment(candidateMap[sha], { kind, selfURL: repository.repoURL }),
    ]),
  );
};
