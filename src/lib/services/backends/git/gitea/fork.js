import { BACKEND_NAMES } from '$lib/services/backends/git/gitea/constants';
import { instance } from '$lib/services/backends/git/gitea/instance';
import {
  fetchDefaultBranchName,
  fetchRepositoryAccess,
  repository,
} from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import {
  fetchForkByNameFor,
  isOpenAuthoringConfiguredFor,
  requestForkWithFallbackName,
  resolveWorkflowRepository,
  runOpenAuthoringSetUp,
  setUpForkFor,
  syncForkWith,
  warnForkNotFastForwarded,
} from '$lib/services/backends/git/shared/fork';
import {
  getRepositoryPath,
  getRestBranchPath,
  isSameRepository,
  toRepositoryPath,
} from '$lib/services/backends/git/shared/repository';
import { user } from '$lib/services/user/account.svelte';
import { encodePathSegments } from '$lib/services/utils/url';

/**
 * @import { RepositoryPath, User } from '$lib/types/private';
 * @import { GitBackendName } from '$lib/types/public';
 */

/**
 * Maximum number of the user’s forks to look through for one of the configured repository, when it
 * isn’t at the name it was given by default. A contributor rarely has more than a handful.
 */
const MAX_FORKS = 50;

/**
 * Check whether Open Authoring is turned on for this backend, configured as either `gitea` or
 * `forgejo`, in the site configuration: see {@link isOpenAuthoringConfiguredFor}.
 * @returns {boolean} `true` if the `open_authoring` backend option is enabled.
 */
export const isOpenAuthoringConfigured = () =>
  isOpenAuthoringConfiguredFor(/** @type {GitBackendName[]} */ (BACKEND_NAMES));

/**
 * Get the repository that receives the CMS’s commits: the signed-in user’s fork when the current
 * session is an Open Authoring one, and the configured repository otherwise. Content is always read
 * from the configured repository, so this is only for writes and for the branches behind them.
 * @returns {RepositoryPath} Repository owner and name.
 */
export const getWorkflowRepository = () => resolveWorkflowRepository(repository);

/**
 * Look for the fork at the name the instance gives it by default: see {@link fetchForkByNameFor}.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if it isn’t there.
 */
export const fetchForkByName = () => fetchForkByNameFor(repository);

/**
 * Look through the forks the signed-in user owns for one of the configured repository, wherever
 * it’s named. This only runs when {@link fetchForkByName} came up empty. A failed search is passed
 * on rather than taken for no fork, which would have the contributor asked to create another one.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if there is none.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoSearch
 */
export const fetchForkBySearch = async () => {
  // Nothing here runs before the user has signed in
  const { id, login } = /** @type {User} */ (user.account);

  const { data = [] } = /** @type {{ data?: Record<string, any>[] }} */ (
    await fetchAPI(`/repos/search?uid=${id}&exclusive=true&mode=fork&limit=${MAX_FORKS}`)
  );

  const result = data.find(
    (item) =>
      // Check the owner rather than trusting the filter to have applied: committing to someone
      // else’s fork would fail in a way that’s hard to make sense of
      item.owner?.login === login && isSameRepository(item.parent?.full_name, repository),
  );

  return result ? toRepositoryPath(result.full_name) : undefined;
};

/**
 * Look for an existing fork of the configured repository on the signed-in user’s account.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if there is none.
 */
export const fetchFork = async () => (await fetchForkByName()) ?? fetchForkBySearch();

/**
 * Fetch whether the instance allows repositories to be forked. Forgejo can turn forking off
 * altogether and says so in its repository settings, while Gitea has no such setting. A failure
 * leaves the fork request to say whether it’s allowed.
 * @returns {Promise<boolean>} `false` if forking is turned off.
 * @see https://codeberg.org/api/swagger#/settings/getGeneralRepositorySettings
 */
export const fetchForkingAllowed = async () => {
  if (!instance.isForgejo) {
    return true;
  }

  try {
    const { forks_disabled: disabled } = /** @type {{ forks_disabled?: boolean }} */ (
      await fetchAPI('/settings/repository')
    );

    return !disabled;
  } catch {
    return true;
  }
};

/**
 * Check whether the signed-in user already has a repository of the given name, which is what stops
 * a fork from being created at the default name.
 * @param {string} name Repository name.
 * @returns {Promise<boolean>} `true` if the name is taken.
 */
const isRepositoryNameTaken = async (name) => {
  const userName = /** @type {string} */ (user.account?.login);

  const response = /** @type {Response} */ (
    await fetchAPI(getRepositoryPath({ owner: userName, repo: name }), { responseType: 'raw' })
  );

  return response.ok;
};

/**
 * Fork the configured repository onto the signed-in user’s account. Unlike GitHub, the instance
 * copies the repository before answering, so the fork can be used as soon as the request returns.
 * @returns {Promise<RepositoryPath>} The new fork.
 * @throws {Error} When the fork could not be created.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/createFork
 */
export const createFork = async () => {
  const { owner, repo } = repository;
  const endpoint = `${getRepositoryPath(repository)}/forks`;

  const result = await requestForkWithFallbackName({
    repoPath: `${owner}/${repo}`,
    /**
     * Request a fork at the default name.
     * @returns {Promise<any>} New fork.
     */
    requestFork: () => fetchAPI(endpoint, { method: 'POST', body: {} }),
    /**
     * Request a fork named after the configured repository’s owner and name.
     * @returns {Promise<any>} New fork.
     */
    requestRenamedFork: () =>
      fetchAPI(endpoint, { method: 'POST', body: { name: `${owner}-${repo}` } }),
    // The instance doesn’t pick another name when the contributor already has an unrelated
    // repository of the same name, the way GitHub does, so give it one. Any other failure is real:
    // a fork of the repository already exists, or forking is turned off on the instance
    conflictStatuses: [409],
    /**
     * Check whether the contributor has a repository at the default name.
     * @returns {Promise<boolean>} `true` if the name is taken.
     */
    isNameTaken: () => isRepositoryNameTaken(repo),
  });

  return toRepositoryPath(result.full_name);
};

/**
 * Find out whether Forgejo can bring the fork’s copy of the given branch up to date. Forgejo only
 * fast-forwards, and refuses a sync both when the fork has commits of its own on the branch and
 * when there’s nothing to sync, so it’s asked first rather than sent a request it would refuse on
 * every sign-in with an up-to-date fork.
 * @param {RepositoryPath} fork Fork to check.
 * @param {string} branch Branch name.
 * @returns {Promise<'current' | 'behind' | 'diverged'>} Where the fork’s copy stands.
 * @see https://codeberg.org/api/swagger#/repository/repoSyncForkBranchInfo
 */
const fetchForgejoSyncState = async ({ owner, repo }, branch) => {
  const {
    allowed,
    fork_commit: forkCommit,
    base_commit: baseCommit,
  } = /** @type {{ allowed?: boolean, fork_commit?: string, base_commit?: string }} */ (
    await fetchAPI(`${getRepositoryPath({ owner, repo })}/sync_fork/${encodePathSegments(branch)}`)
  );

  if (forkCommit && forkCommit === baseCommit) {
    return 'current';
  }

  return allowed ? 'behind' : 'diverged';
};

/**
 * Bring the fork’s copy of the configured branch up to date: see {@link syncForkWith}. Gitea takes
 * the same request as GitHub, while Forgejo names the branch in the path and is asked beforehand
 * whether it can do it at all.
 * @param {RepositoryPath} fork Fork to update.
 * @see https://codeberg.org/api/swagger#/repository/repoSyncForkBranch
 */
export const syncFork = async (fork) => {
  // The branch is resolved before the fork is set up
  const { branch } = /** @type {{ branch: string }} */ (repository);

  await syncForkWith(
    fork,
    branch,
    instance.isForgejo
      ? async () => {
          const state = await fetchForgejoSyncState(fork, branch);

          // The fork has commits of its own on the branch, which is a state the CMS can’t resolve
          // on the contributor’s behalf
          if (state === 'diverged') {
            warnForkNotFastForwarded(fork);
          }

          return state === 'behind'
            ? /** @type {Promise<Response>} */ (
                fetchAPI(`${getRepositoryPath(fork)}/sync_fork/${encodePathSegments(branch)}`, {
                  method: 'POST',
                  responseType: 'raw',
                })
              )
            : undefined;
        }
      : undefined,
  );
};

/**
 * Make sure the fork has its own copy of the configured branch, which is what a workflow branch is
 * created from. A fork that predates the branch — the configured repository renamed its default
 * branch since, say — has no such copy, and the instance can’t be asked to add one, so the
 * contributor has to bring the fork up to date themselves before they can save anything.
 * @param {RepositoryPath} fork Fork to check.
 * @throws {Error} When the fork doesn’t have the branch.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetBranch
 */
export const checkForkBranch = async ({ owner, repo }) => {
  // The branch is resolved before this runs
  const { branch } = /** @type {{ branch: string }} */ (repository);

  const response = /** @type {Response} */ (
    await fetchAPI(getRestBranchPath({ owner, repo }, branch), {
      responseType: 'raw',
    })
  );

  if (!response.ok) {
    throw createLocalizedError(
      'The fork does not have the configured branch',
      'open_authoring.fork_branch_missing',
      { fork: `${owner}/${repo}`, branch, repo: `${repository.owner}/${repository.repo}` },
    );
  }
};

/**
 * Work out how the signed-in user is going to write to the repository, and set up a fork for them
 * if they can’t write to the configured one. This replaces the plain access check performed when
 * Open Authoring is turned off, because a contributor without write access is expected here rather
 * than turned away.
 * @throws {Error} When the fork could not be set up.
 * @see https://sveltiacms.app/en/docs/workflows/open
 */
const setUpOpenAuthoring = async () => {
  await setUpForkFor({
    repository,
    fetchAccess: fetchRepositoryAccess,
    // Syncing the fork needs the branch name
    fetchDefaultBranchName,
    fetchFork,
    /**
     * Bring the existing fork up to date, and make sure it has the configured branch.
     * @param {RepositoryPath} fork Fork.
     */
    prepareFork: async (fork) => {
      await syncFork(fork);
      await checkForkBranch(fork);
    },
    fetchForkingAllowed,
    createFork,
  });
};

/**
 * Set up Open Authoring for the signed-in user: see {@link setUpOpenAuthoring}.
 * @throws {Error} When the fork could not be set up.
 */
export const initOpenAuthoring = async () => {
  await runOpenAuthoringSetUp(setUpOpenAuthoring);
};
