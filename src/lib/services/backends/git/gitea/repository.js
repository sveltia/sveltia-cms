import { recordBranchAccess } from '$lib/services/backends/branch-access';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import {
  createLocalizedError,
  NOT_COLLABORATOR_ERROR_MESSAGE,
  toRepositoryAccessError,
} from '$lib/services/backends/git/shared/errors';
import {
  applyDefaultBranch,
  REPOSITORY_INFO_PLACEHOLDER,
} from '$lib/services/backends/git/shared/repository';
import { user } from '$lib/services/user/account.svelte';
import { getOrCreateAsync } from '$lib/services/utils/cache';
import { encodePathSegments } from '$lib/services/utils/url';

/**
 * @import { RepositoryBaseURLs, RepositoryInfo } from '$lib/types/private';
 */

/**
 * Placeholder for repository information.
 * @type {RepositoryInfo}
 */
export const repository = { ...REPOSITORY_INFO_PLACEHOLDER };

/**
 * Cache for repository information to avoid multiple API calls. The information includes the
 * signed-in user’s permissions, so it’s keyed by the ID of the user it was fetched for, and only
 * the current user’s is kept. The request is cached rather than its result, so callers asking at
 * the same time, like the access check and the default branch lookup, share one request.
 * @type {Map<number | undefined, Promise<Record<string, any>>>}
 */
const repositoryInfoCache = new Map();
/**
 * Last response of the branch endpoint, along with the branch and user it was fetched for. The
 * last commit and the user’s branch permissions come from the same endpoint, and the permissions
 * are checked right after the last commit is fetched on the initial load, so they’re read from
 * here rather than requested again.
 * @type {{ branch: string, userId: number | undefined, result: Record<string, any> } | undefined}
 */
let lastBranchResponse;

/**
 * Reset the repository info cache. Used for testing.
 */
export const _resetRepositoryInfoCache = () => {
  repositoryInfoCache.clear();
  lastBranchResponse = undefined;
};

/**
 * Generate base URLs for accessing the repository’s resources.
 * @param {string} repoURL The base URL of the repository.
 * @param {string} [branch] The branch name. Could be `undefined` if the branch is not specified in
 * the CMS configuration.
 * @returns {RepositoryBaseURLs} An object containing the tree base URL for browsing files, and the
 * blob base URL for accessing file contents.
 */
export const getBaseURLs = (repoURL, branch) => ({
  treeBaseURL: branch ? `${repoURL}/src/branch/${branch}` : repoURL,
  blobBaseURL: branch ? `${repoURL}/src/branch/${branch}` : '',
  commitBaseURL: `${repoURL}/commit`,
});

/**
 * Get the repository information.
 * @returns {Promise<Record<string, any>>} Repository information.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
export const getRepositoryInfo = () => {
  const { owner, repo } = repository;
  const userId = user.account?.id;

  // Another user may have signed in on the same page, e.g. after a read-only account was refused,
  // and their permissions are not the previous user’s
  if (!repositoryInfoCache.has(userId)) {
    repositoryInfoCache.clear();
  }

  // A failure isn’t remembered, so a later call can try again
  return getOrCreateAsync(
    repositoryInfoCache,
    userId,
    () => /** @type {Promise<Record<string, any>>} */ (fetchAPI(`/repos/${owner}/${repo}`)),
  );
};

/**
 * Fetch the configured branch, which includes its last commit and the signed-in user’s permissions
 * on it. The response is kept for {@link checkBranchAccess}.
 * @returns {Promise<Record<string, any>>} Branch information.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetBranch
 */
export const fetchBranch = async () => {
  const { owner, repo } = repository;
  const branch = String(repository.branch);
  const userId = user.account?.id;

  const result = /** @type {Record<string, any>} */ (
    await fetchAPI(`/repos/${owner}/${repo}/branches/${encodePathSegments(branch)}`)
  );

  lastBranchResponse = { branch, userId, result };

  return result;
};

/**
 * Check if the user has write access to the current repository, like Netlify/Decap CMS requires.
 * @throws {Error} If the user can’t push to the repository, the repository doesn’t exist, or the
 * access couldn’t be checked.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
export const checkRepositoryAccess = async () => {
  const { repo } = repository;
  /** @type {Record<string, any>} */
  let result;

  try {
    result = await getRepositoryInfo();
  } catch (/** @type {any} */ ex) {
    throw toRepositoryAccessError(repository, ex?.cause?.status, { reportNotFound: true });
  }

  if (!result.permissions?.push) {
    throw createLocalizedError(NOT_COLLABORATOR_ERROR_MESSAGE, 'repository_no_access', { repo });
  }
};

/**
 * Check if the user can push to and merge into the configured branch, and record it in
 * {@link lockedBranch} and {@link mergeLockedBranch}. Write access is enough to sign in, but a
 * protected branch may only allow some users to push or merge, in which case everything that would
 * fail is made read-only or hidden up front. A failed request leaves the branch writable, as
 * Gitea/Forgejo still refuses a push or merge the user isn’t allowed to make.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetBranch
 */
export const checkBranchAccess = async () => {
  const { owner, repo, branch } = repository;
  // Read the response the last commit was just fetched with, if it’s for this branch and user. It’s
  // only used once, so a later check doesn’t go by permissions fetched long ago
  const cached = lastBranchResponse;

  lastBranchResponse = undefined;

  await recordBranchAccess(branch, async (_branch) => {
    const result = /** @type {{ user_can_push?: boolean, user_can_merge?: boolean }} */ (
      cached?.branch === _branch && cached.userId === user.account?.id
        ? cached.result
        : await fetchAPI(`/repos/${owner}/${repo}/branches/${encodePathSegments(_branch)}`)
    );

    return { canPush: result.user_can_push, canMerge: result.user_can_merge };
  });
};

/**
 * Fetch the repository’s default branch name, which is typically `master` or `main`.
 * @returns {Promise<string>} Branch name.
 * @throws {Error} When the repository could not be found, or when the repository is empty.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
export const fetchDefaultBranchName = async () => {
  // A request that fails means the repository could not be read at all, which `applyDefaultBranch`
  // reports as a missing repository; a repository that was read but has no default branch is empty
  const info = await getRepositoryInfo().catch(() => undefined);

  return applyDefaultBranch(repository, {
    found: !!info,
    branch: info?.default_branch,
    getBaseURLs,
  });
};
