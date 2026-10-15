import { repository } from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { collectSafely, resolveDeployments } from '$lib/services/backends/git/shared/deployment';
import { encodePathSegments } from '$lib/services/utils/url';

/**
 * @import { DeployState, DeployStatus, DeployTarget } from '$lib/types/private';
 * @import { DeployCandidate } from '$lib/services/backends/git/shared/deployment';
 */

/**
 * Maximum number of commit statuses to retrieve per commit. This is the default
 * `MAX_RESPONSE_ITEMS` of both Gitea and Forgejo. A commit rarely has that many contexts, since
 * only the latest status of each is returned.
 */
const MAX_ITEMS = 50;

/**
 * Map a commit status to a normalized state. `warning` is a build that went through with something
 * to report, so it still has a page behind it. `skipped` is absent, so a job that didn’t run is
 * ignored rather than reported as a failure.
 * @type {Record<string, DeployState>}
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetCombinedStatusByRef
 * @see https://codeberg.org/api/swagger#/repository/repoGetCombinedStatusByRef
 */
const COMMIT_STATUS_MAP = {
  success: 'ready',
  warning: 'ready',
  pending: 'pending',
  failure: 'error',
  error: 'error',
};

/**
 * Fetch the head commit of the configured branch, which is the commit the production site is built
 * from.
 * @returns {Promise<string | undefined>} Commit SHA, or `undefined` if it couldn’t be resolved.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetBranch
 */
export const fetchBranchHeadSHA = async () => {
  const { owner, repo, branch } = repository;

  if (!branch) {
    // The default branch hasn’t been detected yet
    return undefined;
  }

  const result = /** @type {Record<string, any>} */ (
    await fetchAPI(`/repos/${owner}/${repo}/branches/${encodePathSegments(branch)}`)
  );

  return result?.commit?.id ?? undefined;
};

/**
 * Collect deploy candidates from the commit statuses of the given commit, which is the only place
 * Gitea/Forgejo has for a build result: neither has a Deployments or Checks API. The combined
 * status is read rather than the status list, because the list keeps every status ever posted, so a
 * build re-run on the same commit would leave its earlier `success` behind to outrank the new
 * `pending` one. The combined status only has the latest status of each context. Gitea/Forgejo
 * Actions posts one for every job, linked to the job log on the instance, which
 * {@link resolveDeployments} doesn’t take for a site URL.
 * @param {string} sha Commit SHA.
 * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate, keyed by commit SHA.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetCombinedStatusByRef
 */
const collectStatusCandidates = async (sha, candidateMap) => {
  const { owner, repo } = repository;

  const result = /** @type {Record<string, any>} */ (
    await fetchAPI(
      `/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}/status?limit=${MAX_ITEMS}`,
    )
  );

  // The statuses come in no particular order, while {@link pickDeployment} expects the newest last.
  // The times are in the server’s own time zone, whose offset can change with daylight saving time,
  // so they’re compared as times rather than as strings
  /** @type {Record<string, any>[]} */ ([...(result?.statuses ?? [])])
    .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
    .forEach(({ context, status, target_url: targetURL, description }) => {
      const state = COMMIT_STATUS_MAP[status];

      if (state) {
        candidateMap[sha].push({
          name: context ?? '',
          url: targetURL || undefined,
          state,
          description: description || undefined,
          source: 'status',
        });
      }
    });
};

/**
 * Collect deploy candidates for the given commits, one request per commit since there’s no GraphQL
 * API to batch them. A failure is reported without failing the batch, so a commit whose statuses
 * are gone — after a force push, say — doesn’t take the others down with it.
 * @param {string[]} shas Commit SHAs.
 * @param {Record<string, DeployCandidate[]>} candidateMap Candidates keyed by commit SHA.
 */
const collectCandidates = async (shas, candidateMap) => {
  await runConcurrently(shas, (sha) =>
    collectSafely(() => collectStatusCandidates(sha, candidateMap)),
  );
};

/**
 * Fetch the deployment status and URL for the given commits.
 * @param {DeployTarget[]} targets Commits to look up.
 * @returns {Promise<Record<string, DeployStatus>>} Deployments keyed by commit SHA.
 */
export const fetchDeployments = async (targets) =>
  resolveDeployments(targets, { collect: collectCandidates, selfURL: repository.repoURL });
