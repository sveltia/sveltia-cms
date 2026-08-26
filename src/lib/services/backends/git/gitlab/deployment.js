import { repository } from '$lib/services/backends/git/gitlab/repository';
import { getProjectId } from '$lib/services/backends/git/gitlab/workflow';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { pickDeployment } from '$lib/services/backends/git/shared/deployment';

/**
 * @import { DeployState, DeployStatus, DeployTarget } from '$lib/types/private';
 * @import { DeployCandidate } from '$lib/services/backends/git/shared/deployment';
 */

/** Maximum number of items to retrieve per request. This is GitLab’s own cap. */
const MAX_ITEMS = 100;
/**
 * How far back to look for deployments. GitLab’s Deployments API can’t filter by commit or ref, so
 * a recent window is fetched and matched locally. A project that produces more than {@link
 * MAX_ITEMS} deployments within the window may push a Review App out of the first page, in which
 * case the commit statuses still cover it.
 */
const DEPLOYMENT_WINDOW = 7 * 24 * 60 * 60 * 1000;

/**
 * Map a commit status to a normalized state. `skipped` is absent, so a job that didn’t run is
 * ignored rather than reported as a failure.
 * @type {Record<string, DeployState>}
 * @see https://docs.gitlab.com/api/commits/#list-the-statuses-of-a-commit
 */
const COMMIT_STATUS_MAP = {
  success: 'ready',
  pending: 'pending',
  running: 'pending',
  created: 'pending',
  preparing: 'pending',
  manual: 'pending',
  scheduled: 'pending',
  waiting_for_resource: 'pending',
  failed: 'error',
  canceled: 'error',
};

/**
 * Map a deployment status to a normalized state.
 * @type {Record<string, DeployState>}
 * @see https://docs.gitlab.com/api/deployments/
 */
const DEPLOYMENT_STATUS_MAP = {
  success: 'ready',
  created: 'pending',
  running: 'pending',
  blocked: 'pending',
  failed: 'error',
  canceled: 'error',
};

/**
 * Fetch the head commit of the configured branch, which is the commit the production site is built
 * from.
 * @returns {Promise<string | undefined>} Commit SHA, or `undefined` if it couldn’t be resolved.
 * @see https://docs.gitlab.com/api/branches/#get-single-repository-branch
 */
export const fetchBranchHeadSHA = async () => {
  const { branch } = repository;

  if (!branch) {
    // The default branch hasn’t been detected yet
    return undefined;
  }

  const result = /** @type {Record<string, any>} */ (
    await fetchAPI(`/projects/${getProjectId()}/repository/branches/${encodeURIComponent(branch)}`)
  );

  return result?.commit?.id ?? undefined;
};

/**
 * Collect deploy candidates from the project’s recent deployments, which is how GitLab’s own Review
 * Apps and environments report a site URL. One request covers every target, because the API can
 * only be narrowed by time, not by commit or ref.
 * @param {DeployTarget[]} targets Commits to look up.
 * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate, keyed by commit SHA.
 */
const collectDeploymentCandidates = async (targets, candidateMap) => {
  const updatedAfter = new Date(Date.now() - DEPLOYMENT_WINDOW).toISOString();

  const deployments = /** @type {Record<string, any>[]} */ (
    await fetchAPI(
      `/projects/${getProjectId()}/deployments` +
        `?order_by=updated_at&sort=desc&per_page=${MAX_ITEMS}` +
        `&updated_after=${encodeURIComponent(updatedAfter)}`,
    )
  );

  // The response is newest first, while {@link pickDeployment} expects the newest last
  [...(deployments ?? [])].reverse().forEach(({ ref, status, environment }) => {
    const state = DEPLOYMENT_STATUS_MAP[status];
    // An older self-hosted GitLab omits `external_url` from the list response
    const url = environment?.external_url ?? undefined;

    if (!state) {
      return;
    }

    targets.forEach(({ sha, branch }) => {
      if (ref === branch) {
        candidateMap[sha].push({
          name: environment?.name ?? '',
          url,
          state,
          source: 'deployment',
        });
      }
    });
  });
};

/**
 * Collect deploy candidates from the commit statuses of the given commit. This is where an external
 * CI service posts a build result when it posts one at all.
 * @param {DeployTarget} target Commit to look up.
 * @param {Record<string, DeployCandidate[]>} candidateMap Map to populate, keyed by commit SHA.
 * @see https://docs.gitlab.com/api/commits/#list-the-statuses-of-a-commit
 */
const collectStatusCandidates = async ({ sha }, candidateMap) => {
  const statuses = /** @type {Record<string, any>[]} */ (
    await fetchAPI(
      `/projects/${getProjectId()}/repository/commits/${encodeURIComponent(sha)}` +
        `/statuses?per_page=${MAX_ITEMS}`,
    )
  );

  (statuses ?? []).forEach(({ name, status, target_url: targetURL, description }) => {
    const state = COMMIT_STATUS_MAP[status];

    if (state) {
      candidateMap[sha].push({
        name: name ?? '',
        url: targetURL ?? undefined,
        state,
        description: description ?? undefined,
        source: 'status',
      });
    }
  });
};

/**
 * Fetch the deployment status and URL for the given commits. Each source is requested separately
 * and any failure is swallowed, so a commit whose statuses are gone — after a force push, say —
 * doesn’t take the rest of the batch down with it.
 * @param {DeployTarget[]} targets Commits to look up.
 * @returns {Promise<Record<string, DeployStatus>>} Deployments keyed by commit SHA.
 */
export const fetchDeployments = async (targets) => {
  // A merge request created in an older session may have no head commit recorded yet
  const validTargets = targets.filter(({ sha }) => !!sha);

  if (!validTargets.length) {
    return {};
  }

  /** @type {Record<string, DeployCandidate[]>} */
  const candidateMap = Object.fromEntries(validTargets.map(({ sha }) => [sha, []]));

  /**
   * Run a collector, reporting a failure without failing the batch.
   * @param {() => Promise<void>} task Task to run.
   */
  const collect = async (task) => {
    try {
      await task();
    } catch (ex) {
      // eslint-disable-next-line no-console
      console.warn('Failed to fetch the deployment info.', ex);
    }
  };

  await Promise.all([
    collect(() => collectDeploymentCandidates(validTargets, candidateMap)),
    // Two merge requests can share a head commit, so look each one up only once
    runConcurrently([...new Set(validTargets.map(({ sha }) => sha))], async (sha) =>
      collect(() => collectStatusCandidates({ sha, branch: '', kind: 'preview' }, candidateMap)),
    ),
  ]);

  return Object.fromEntries(
    validTargets.map(({ sha, kind }) => [
      sha,
      pickDeployment(candidateMap[sha], { kind, selfURL: repository.repoURL }),
    ]),
  );
};
