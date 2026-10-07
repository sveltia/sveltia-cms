import { instance } from '$lib/services/backends/git/gitea/instance';
import {
  fetchDefaultBranchName,
  getRepositoryInfo,
  repository,
} from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import {
  createLocalizedError,
  NOT_COLLABORATOR_ERROR_MESSAGE,
} from '$lib/services/backends/git/shared/errors';
import {
  ensureForkPermission,
  resolveWorkflowRepository,
  runOpenAuthoringSetUp,
} from '$lib/services/backends/git/shared/fork';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { cmsConfig } from '$lib/services/config';
import { user } from '$lib/services/user/account.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * @import { RepositoryPath, User } from '$lib/types/private';
 */

/**
 * Maximum number of the user’s forks to look through for one of the configured repository, when it
 * isn’t at the name it was given by default. A contributor rarely has more than a handful.
 */
const MAX_FORKS = 50;

/**
 * Check whether Open Authoring is turned on in the site configuration. It doesn’t mean the
 * signed-in user is actually contributing through a fork: a user who can write to the configured
 * repository keeps working on it directly. Use the `openAuthoring` store for that.
 * @returns {boolean} `true` if the `open_authoring` backend option is enabled.
 */
export const isOpenAuthoringConfigured = () => {
  const { backend } = cmsConfig.current ?? {};

  return backend?.name === 'gitea' && backend.open_authoring === true;
};

/**
 * Get the repository that receives the CMS’s commits: the signed-in user’s fork when the current
 * session is an Open Authoring one, and the configured repository otherwise. Content is always read
 * from the configured repository, so this is only for writes and for the branches behind them.
 * @returns {RepositoryPath} Repository owner and name.
 */
export const getWorkflowRepository = () => resolveWorkflowRepository(repository);

/**
 * Parse a repository returned by the REST API into the owner and name pair the CMS works with.
 * @param {Record<string, any>} result Repository.
 * @returns {RepositoryPath} Repository owner and name.
 */
const toRepositoryPath = ({ full_name: fullName }) => {
  const [owner, repo] = fullName.split('/');

  return { owner, repo };
};

/**
 * Fetch what the sign-in needs to know about the configured repository: whether the signed-in user
 * can commit to it. The repository reports the authenticated user’s own permissions. A private
 * repository answers a request from someone without access with a 404 rather than a 403, so its
 * existence isn’t leaked; either way, being unable to read it is a dead end rather than a reason to
 * fall back to a fork.
 * @returns {Promise<{ canWrite: boolean }>} Repository access.
 * @throws {Error} When the user has no access to the repository, or the answer couldn’t be
 * determined — which is not the same thing.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
export const fetchRepositoryAccess = async () => {
  const { owner, repo } = repository;
  const repoPath = `${owner}/${repo}`;
  /** @type {Record<string, any>} */
  let result;

  try {
    result = await getRepositoryInfo();
  } catch (/** @type {any} */ ex) {
    // The shared message is what the sign-in flow looks for to drop the cached credentials, the
    // same as the regular access check does, so the user gets the sign-in form rather than the
    // same error on every reload
    if ([403, 404].includes(ex.cause?.status)) {
      throw createLocalizedError(NOT_COLLABORATOR_ERROR_MESSAGE, 'repository_no_access', {
        repo: repoPath,
      });
    }

    // A rate limit or an outage leaves the question unanswered. Reading that as “no write access”
    // would send a maintainer down the fork path over something passing, and offer to create a
    // copy of a repository they can already write to, so make the failure visible instead
    throw createLocalizedError(
      'Failed to check the repository permission.',
      'open_authoring.permission_check_failed',
      { repo: repoPath },
    );
  }

  return { canWrite: !!result.permissions?.push };
};

/**
 * Look for the fork at the name the instance gives it by default, which is the parent’s. This is
 * where it is unless the contributor renamed it. A repository that happens to share the name but
 * isn’t a fork of the configured one is ignored.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if it isn’t there.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
export const fetchForkByName = async () => {
  const { owner, repo } = repository;
  const userName = /** @type {string} */ (user.account?.login);

  const response = /** @type {Response} */ (
    await fetchAPI(`/repos/${encodeURIComponent(userName)}/${repo}`, { responseType: 'raw' })
  );

  if (!response.ok) {
    return undefined;
  }

  const result = await response.json();
  const parent = result.parent?.full_name?.toLowerCase();

  if (!result.fork || parent !== `${owner}/${repo}`.toLowerCase()) {
    return undefined;
  }

  // The instance redirects a request for a repository that was renamed or transferred, so the one
  // it answered with can sit on an account other than the one asked for. Everything the CMS writes
  // goes to this repository, so take it only once it’s confirmed to be the signed-in user’s own
  if (result.owner?.login?.toLowerCase() !== userName.toLowerCase()) {
    return undefined;
  }

  return toRepositoryPath(result);
};

/**
 * Look through the forks the signed-in user owns for one of the configured repository, wherever
 * it’s named. This only runs when {@link fetchForkByName} came up empty, so its worst case is the
 * behavior without it: no fork found, and the contributor asked whether to make one.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if there is none.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoSearch
 */
export const fetchForkBySearch = async () => {
  const { owner, repo } = repository;
  // Nothing here runs before the user has signed in
  const { id, login } = /** @type {User} */ (user.account);
  const repoPath = `${owner}/${repo}`.toLowerCase();

  try {
    const { data = [] } = /** @type {{ data?: Record<string, any>[] }} */ (
      await fetchAPI(`/repos/search?uid=${id}&exclusive=true&mode=fork&limit=${MAX_FORKS}`)
    );

    const result = data.find(
      (item) =>
        // Check the owner rather than trusting the filter to have applied: committing to someone
        // else’s fork would fail in a way that’s hard to make sense of
        item.owner?.login === login && item.parent?.full_name?.toLowerCase() === repoPath,
    );

    return result ? toRepositoryPath(result) : undefined;
  } catch {
    return undefined;
  }
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
    await fetchAPI(`/repos/${encodeURIComponent(userName)}/${name}`, { responseType: 'raw' })
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
  const repoPath = `${owner}/${repo}`;
  const endpoint = `/repos/${owner}/${repo}/forks`;
  /** @type {Record<string, any>} */
  let result;

  try {
    result = /** @type {Record<string, any>} */ (
      await fetchAPI(endpoint, { method: 'POST', body: {} })
    );
  } catch (/** @type {any} */ ex) {
    // The instance doesn’t pick another name when the contributor already has an unrelated
    // repository of the same name, the way GitHub does, so give it one. Any other failure is real:
    // a fork of the repository already exists, or forking is turned off on the instance
    if (ex.cause?.status !== 409 || !(await isRepositoryNameTaken(repo))) {
      // eslint-disable-next-line no-console
      console.error('Failed to fork the repository.', ex);

      throw createLocalizedError('Failed to fork the repository.', 'open_authoring.fork_failed', {
        repo: repoPath,
      });
    }

    try {
      result = /** @type {Record<string, any>} */ (
        await fetchAPI(endpoint, { method: 'POST', body: { name: `${owner}-${repo}` } })
      );
    } catch (/** @type {any} */ retryEx) {
      // eslint-disable-next-line no-console
      console.error('Failed to fork the repository.', retryEx);

      throw createLocalizedError('Failed to fork the repository.', 'open_authoring.fork_failed', {
        repo: repoPath,
      });
    }
  }

  return toRepositoryPath(result);
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
    await fetchAPI(`/repos/${owner}/${repo}/sync_fork/${encodePath(branch)}`)
  );

  if (forkCommit && forkCommit === baseCommit) {
    return 'current';
  }

  return allowed ? 'behind' : 'diverged';
};

/**
 * Bring the fork’s copy of the configured branch up to date with the configured repository, so a
 * new workflow branch starts from what’s currently on the site and the resulting pull request only
 * contains the entry being edited. The two services ask for this differently: Gitea names the
 * branch in the body, while Forgejo names it in the path and is asked beforehand whether it can do
 * it at all. A failure is logged rather than raised: a fork that has drifted still works, it just
 * makes for a noisier pull request.
 * @param {RepositoryPath} fork Fork to update.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoMergeUpstream
 * @see https://codeberg.org/api/swagger#/repository/repoSyncForkBranch
 */
export const syncFork = async (fork) => {
  const { owner, repo } = fork;
  // The branch is resolved before the fork is set up
  const { branch } = /** @type {{ branch: string }} */ (repository);
  /** @type {Response | undefined} */
  let response;

  try {
    if (instance.isForgejo) {
      const state = await fetchForgejoSyncState(fork, branch);

      if (state === 'current') {
        return;
      }

      // The fork has commits of its own on the branch, which is a state the CMS can’t resolve on
      // the contributor’s behalf
      if (state === 'diverged') {
        // eslint-disable-next-line no-console
        console.warn(
          `The ${owner}/${repo} fork could not be fast-forwarded to the upstream repository.`,
        );

        return;
      }
    }

    response = /** @type {Response} */ (
      await fetchAPI(
        instance.isForgejo
          ? `/repos/${owner}/${repo}/sync_fork/${encodePath(branch)}`
          : `/repos/${owner}/${repo}/merge-upstream`,
        {
          method: 'POST',
          ...(instance.isForgejo ? {} : { body: { branch } }),
          responseType: 'raw',
        },
      )
    );
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to sync the ${owner}/${repo} fork with the upstream repository.`, ex);

    return;
  }

  // Gitea refuses the request when the fork’s commits conflict with the upstream ones, which it
  // can’t merge
  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      `The ${owner}/${repo} fork could not be fast-forwarded to the upstream repository.`,
    );
  }
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
    await fetchAPI(`/repos/${owner}/${repo}/branches/${encodePath(branch)}`, {
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
  const { canWrite } = await fetchRepositoryAccess();

  // A maintainer keeps working on the configured repository, as if Open Authoring was off
  if (canWrite) {
    return;
  }

  const { owner, repo } = repository;

  // Syncing the fork needs the branch name, which is otherwise resolved later in the data load
  if (!repository.branch) {
    await fetchDefaultBranchName();
  }

  const existingFork = await fetchFork();

  if (existingFork) {
    await syncFork(existingFork);
    await checkForkBranch(existingFork);
    forkedRepository.current = existingFork;

    return;
  }

  await ensureForkPermission({
    repoPath: `${owner}/${repo}`,
    allowForking: await fetchForkingAllowed(),
  });

  forkedRepository.current = await createFork();
};

/**
 * Set up Open Authoring for the signed-in user: see {@link setUpOpenAuthoring}.
 * @throws {Error} When the fork could not be set up.
 */
export const initOpenAuthoring = async () => {
  await runOpenAuthoringSetUp(setUpOpenAuthoring);
};
