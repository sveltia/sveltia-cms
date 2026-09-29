import { lockedBranch, mergeLockedBranch } from '$lib/services/backends/branch-access';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import {
  createLocalizedError,
  NOT_COLLABORATOR_ERROR_MESSAGE,
} from '$lib/services/backends/git/shared/errors';
import {
  applyDefaultBranch,
  REPOSITORY_INFO_PLACEHOLDER,
} from '$lib/services/backends/git/shared/repository';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { user } from '$lib/services/user/account.svelte';

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
 * signed-in user’s permissions, so it’s kept along with the ID of the user it was fetched for.
 * @type {{ userId: number | undefined, info: Record<string, any> } | null}
 */
let repositoryInfoCache = null;

/**
 * Reset the repository info cache. Used for testing.
 */
export const resetRepositoryInfoCache = () => {
  repositoryInfoCache = null;
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
export const getRepositoryInfo = async () => {
  const { owner, repo } = repository;
  const userId = user.account?.id;

  // Another user may have signed in on the same page, e.g. after a read-only account was refused,
  // and their permissions are not the previous user’s
  if (repositoryInfoCache && repositoryInfoCache.userId === userId) {
    return repositoryInfoCache.info;
  }

  const info = /** @type {Record<string, any>} */ (await fetchAPI(`/repos/${owner}/${repo}`));

  repositoryInfoCache = { userId, info };

  return info;
};

/**
 * Check if the user has write access to the current repository, like Netlify/Decap CMS requires.
 * @throws {Error} If the user can’t push to the repository.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
export const checkRepositoryAccess = async () => {
  const { repo } = repository;

  try {
    const { permissions } = await getRepositoryInfo();

    if (!permissions?.push) {
      throw createLocalizedError(NOT_COLLABORATOR_ERROR_MESSAGE, 'repository_no_access', { repo });
    }
  } catch (error) {
    if (error instanceof Error && error.message === NOT_COLLABORATOR_ERROR_MESSAGE) {
      throw error;
    }

    throw createLocalizedError('Failed to check repository access', 'repository_not_found', {
      repo,
    });
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
  let canPush = true;
  let canMerge = true;

  if (branch) {
    try {
      const result = /** @type {{ user_can_push?: boolean, user_can_merge?: boolean }} */ (
        await fetchAPI(`/repos/${owner}/${repo}/branches/${encodePath(branch)}`)
      );

      canPush = result.user_can_push !== false;
      canMerge = result.user_can_merge !== false;
    } catch {
      // Keep the branch writable, as said above
    }
  }

  lockedBranch.current = canPush ? undefined : branch;
  mergeLockedBranch.current = canMerge ? undefined : branch;
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
