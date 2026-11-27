import { fetchAliasedBatch } from '$lib/services/backends/git/github/graphql';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import {
  addCandidates,
  collectSafely,
  findURLInSummary,
  resolveDeployments,
} from '$lib/services/backends/git/shared/deployment';
import { getRepositoryPath } from '$lib/services/backends/git/shared/repository';
import { user } from '$lib/services/user/account.svelte';
import { splitIntoChunks } from '$lib/services/utils/array';
import { runConcurrently } from '$lib/services/utils/scheduling';

/**
 * @import { DeployState, DeployStatus, DeployTarget } from '$lib/types/private';
 * @import { DeployCandidate } from '$lib/services/backends/git/shared/deployment';
 */

/**
 * Manually trigger a deployment with GitHub Actions by dispatching the `repository_dispatch` event.
 * @returns {Promise<Response>} Response.
 * @see https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event
 */
export const triggerDeployment = async () =>
  /** @type {Promise<Response>} */ (
    fetchAPI(`${getRepositoryPath(repository)}/dispatches`, {
      method: 'POST',
      body: { event_type: 'sveltia-cms-publish' },
      responseType: 'raw',
    })
  );

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
  if (!repository.branch) {
    // The default branch hasn’t been detected yet
    return undefined;
  }

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
 * Read the given fields from each commit in a single batched request.
 * @param {string[]} shas Commit SHAs. The caller keeps the list to {@link MAX_ITEMS.commits}.
 * @param {string} selection Inner selection on the `Commit` type.
 * @returns {Promise<any[]>} Commit node for each SHA, in the same order.
 */
const fetchCommits = (shas, selection) =>
  fetchAliasedBatch({
    items: shas,
    alias: 'commit',
    /**
     * Build the field selection for a commit.
     * @param {string} sha Commit SHA.
     * @returns {string} Field selection.
     */
    getFragment: (sha) => `object(oid: ${JSON.stringify(sha)}) { ... on Commit { ${selection} } }`,
    chunkSize: MAX_ITEMS.commits,
  });

/**
 * What to ask for on each commit, and how to read the answer. Keeping the two side by side lets the
 * three be asked for together in one request, or separately when that isn’t possible.
 * `field` is the commit field the selection starts with, which an error’s `path` names.
 * @type {Record<string, { field: string, selection: string, parse: (commit: any, sha: string,
 * candidateMap: Record<string, DeployCandidate[]>) => void }>}
 */
const SOURCES = {
  /**
   * Commit statuses, where an external CI service posts a build result when it posts one at all.
   * @see https://docs.github.com/en/graphql/reference/objects#status
   */
  status: {
    field: 'status',
    selection: 'status { contexts { context state targetUrl description } }',
    /**
     * Read the commit statuses from one commit node.
     * @param {any} commit Commit node.
     * @param {string} sha Commit SHA.
     * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate.
     */
    parse: (commit, sha, candidateMap) => {
      addCandidates(
        candidateMap[sha],
        commit?.status?.contexts,
        ({ state }) => STATUS_STATE_MAP[state],
        ({ context, targetUrl, description }) => ({
          name: context ?? '',
          url: targetUrl,
          description,
          source: 'status',
        }),
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
    field: 'deployments',
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
      addCandidates(
        candidateMap[sha],
        commit?.deployments?.nodes,
        ({ latestStatus }) => DEPLOYMENT_STATE_MAP[latestStatus?.state],
        ({ environment, latestStatus }) => ({
          name: environment ?? '',
          url: latestStatus?.environmentUrl,
          description: latestStatus?.description,
          source: 'deployment',
        }),
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
    field: 'checkSuites',
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
      addCandidates(
        candidateMap[sha],
        commit?.checkSuites?.nodes?.flatMap(
          (/** @type {Record<string, any>} */ suite) => suite?.checkRuns?.nodes ?? [],
        ),
        // A run that hasn’t finished has no conclusion yet, so the status carries the state
        ({ status, conclusion }) =>
          status === 'COMPLETED' ? CHECK_CONCLUSION_MAP[conclusion] : 'pending',
        ({ name, detailsUrl, summary }) => ({
          name: name ?? '',
          // A URL published in the output is the provider saying where the site went, so it’s taken
          // at face value. The check’s own link is usually a build page, and is trusted only when
          // the run names itself a preview, as AWS Amplify’s does
          url:
            findURLInSummary(summary, detailsUrl) ??
            (PREVIEW_CHECK_NAME_REGEX.test(name) ? detailsUrl : undefined),
          source: 'check',
        }),
      );
    },
  },
};

/**
 * What has been learned about the current token, which is kept per token, as another token signed
 * in later may well be allowed more.
 *
 * `askSeparately` says whether the sources have to be asked for one at a time. GitHub answers a
 * query touching a field the token can’t read with partial data and an `errors` array, which
 * {@link collectTogether} uses, but a field the server doesn’t know at all, as on an older GitHub
 * Enterprise Server, fails the whole query with no data. That’s rare, and permanent for a given
 * server, so it’s discovered once and remembered rather than assumed every time. A transient
 * failure latches this too, which only costs extra requests.
 *
 * `forbiddenSources` lists the sources the token isn’t allowed to read, which are left out of later
 * queries. A fine-grained personal access token can’t be granted the Checks permission at all, so
 * check suites are always forbidden to one, and asking again would only bring the same error back.
 * @type {{ token?: string, askSeparately: boolean, forbiddenSources: Set<string> }}
 */
let tokenState = { token: undefined, askSeparately: false, forbiddenSources: new Set() };

/**
 * Get what has been learned about the current token, starting afresh when another one is in use.
 * @returns {typeof tokenState} State.
 */
const getTokenState = () => {
  const token = user.account?.token;

  if (tokenState.token !== token) {
    tokenState = { token, askSeparately: false, forbiddenSources: new Set() };
  }

  return tokenState;
};

/**
 * Get the sources still worth asking for with the given token.
 * @param {typeof tokenState} state Token state.
 * @returns {[string, (typeof SOURCES)[string]][]} Source keys and definitions.
 */
const getAvailableSources = (state) =>
  Object.entries(SOURCES).filter(([key]) => !state.forbiddenSources.has(key));

/**
 * Find the source each GraphQL error belongs to, from the commit field its `path` names, e.g.
 * `["repository", "commit_0", "checkSuites", "nodes", 0]`.
 * @param {any[]} errors Errors from the response.
 * @param {[string, (typeof SOURCES)[string]][]} sources Sources asked for.
 * @returns {Map<string, any[]> | undefined} Errors keyed by source, or `undefined` if any error
 * can’t be pinned to one, in which case the rest of the data can’t be trusted either.
 */
const groupErrorsBySource = (errors, sources) => {
  const keys = errors.map((error) => {
    const field = Array.isArray(error?.path) ? error.path[2] : undefined;

    return sources.find(([, { field: name }]) => name === field)?.[0];
  });

  return keys.every((key) => !!key)
    ? Map.groupBy(errors, (_error, index) => /** @type {string} */ (keys[index]))
    : undefined;
};

/**
 * Ask for the given sources on each commit, keeping a partial answer. A source the token is
 * forbidden to read is left out from then on.
 * @param {string[]} shas Commit SHAs. The caller keeps the list to {@link MAX_ITEMS.commits}, so
 * it’s asked for in one request and a partial answer covers every commit.
 * @param {[string, (typeof SOURCES)[string]][]} sources Sources to ask for.
 * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate, keyed by commit SHA.
 * @param {typeof tokenState} state State of the token the request is sent with, which is still the
 * one to update if another token has been signed in by the time the answer comes back.
 * @throws {Error} When the request fails in a way that leaves no usable data.
 */
const collectSources = async (shas, sources, candidateMap, state) => {
  const selection = sources.map(([, { selection: part }]) => part).join('\n');
  /** @type {any[]} */
  let commits;

  try {
    commits = await fetchCommits(shas, selection);
  } catch (ex) {
    const { errors, results } = /** @type {any} */ (ex)?.cause ?? {};
    const grouped = Array.isArray(results) ? groupErrorsBySource(errors, sources) : undefined;

    // An error in a field that can’t be null nulls its parent instead, up to the commit itself,
    // which would take the commit’s other sources with it
    if (!grouped || errors.some(({ index }) => !results[index])) {
      throw ex;
    }

    grouped.forEach((items, key) => {
      if (items.every((error) => error?.type === 'FORBIDDEN')) {
        state.forbiddenSources.add(key);
      }

      // eslint-disable-next-line no-console
      console.warn(`Failed to fetch the deployment info from ${key}.`, items);
    });

    // A node that couldn’t be read comes back as `null`, which the parsers skip, so whatever did
    // arrive is still used — the other check suites of a commit, say, when only one is forbidden
    commits = results;
  }

  shas.forEach((sha, index) => {
    sources.forEach(([, { parse }]) => parse(commits[index], sha, candidateMap));
  });
};

/**
 * Ask for all the available sources in a single request.
 * @param {string[]} shas Commit SHAs.
 * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate, keyed by commit SHA.
 * @param {typeof tokenState} state Token state.
 * @throws {Error} When the request fails in a way that leaves no usable data.
 */
const collectTogether = async (shas, candidateMap, state) => {
  const sources = getAvailableSources(state);

  if (sources.length) {
    await collectSources(shas, sources, candidateMap, state);
  }
};

/**
 * Ask for each source in its own request, so an unavailable field only costs its own source.
 * @param {string[]} shas Commit SHAs.
 * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate, keyed by commit SHA.
 * @param {typeof tokenState} state Token state.
 */
const collectOneByOne = async (shas, candidateMap, state) => {
  await Promise.all(
    // A missing or restricted field shouldn’t take the other sources down with it
    getAvailableSources(state).map((source) =>
      collectSafely(() => collectSources(shas, [source], candidateMap, state)),
    ),
  );
};

/**
 * Collect deploy candidates for the given commits from the sources the token can read. They’re
 * asked for in one request per chunk, dropping to one request each only if that fails without any
 * usable data.
 * @param {string[]} shas Commit SHAs.
 * @param {Record<string, DeployCandidate[]>} candidateMap Candidates keyed by commit SHA.
 */
const collectCandidates = async (shas, candidateMap) => {
  const state = getTokenState();

  // Chunked here rather than in `fetchAliasedBatch`, so a failure only sends its own chunk down the
  // one-request-per-source path
  await runConcurrently(splitIntoChunks(shas, MAX_ITEMS.commits), async (chunk) => {
    if (!state.askSeparately) {
      try {
        await collectTogether(chunk, candidateMap, state);

        return;
      } catch (ex) {
        // eslint-disable-next-line no-console
        console.warn('Falling back to a request per deployment source.', ex);
        state.askSeparately = true;
      }
    }

    await collectOneByOne(chunk, candidateMap, state);
  });
};

/**
 * Fetch the deployment status and URL for the given commits. All the sources are asked for in one
 * request. A source the token can’t read only costs itself, as the rest of the partial answer is
 * kept; the request is split into one per source only if it fails outright, which happens when a
 * field is unknown to the server, as on an older GitHub Enterprise Server. A repository that needs
 * the split pays for discovering it once.
 * @param {DeployTarget[]} targets Commits to look up.
 * @returns {Promise<Record<string, DeployStatus>>} Deployments keyed by commit SHA.
 */
export const fetchDeployments = async (targets) =>
  resolveDeployments(targets, { collect: collectCandidates, selfURL: repository.repoURL });
