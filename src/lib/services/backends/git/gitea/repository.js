import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { REPOSITORY_INFO_PLACEHOLDER } from '$lib/services/backends/git/shared/repository';

/**
 * @import { RepositoryInfo } from '$lib/types/private';
 */

/**
 * Placeholder for repository information.
 * @type {RepositoryInfo}
 */
export const repository = { ...REPOSITORY_INFO_PLACEHOLDER };

/**
 * Cache for repository information to avoid multiple API calls.
 * @type {Record<string, any> | null}
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
 * @param {string} baseURL The name of the repository.
 * @param {string} [branch] The branch name. Could be `undefined` if the branch is not specified in
 * the site configuration.
 * @returns {{ treeBaseURL: string, blobBaseURL: string }} An object containing the tree base URL
 * for browsing files, and the blob base URL for accessing file contents.
 */
export const getBaseURLs = (baseURL, branch) => ({
  treeBaseURL: branch ? `${baseURL}/src/branch/${branch}` : baseURL,
  blobBaseURL: branch ? `${baseURL}/src/branch/${branch}` : '',
});

/**
 * Get the repository information.
 * @returns {Promise<Record<string, any>>} Repository information.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
export const getRepositoryInfo = async () => {
  const { owner, repo } = repository;

  repositoryInfoCache ??= await /** @type {Promise<Record<string, any>>} */ (
    fetchAPI(`/repos/${owner}/${repo}`)
  );

  return repositoryInfoCache;
};

/**
 * Check if the user has access to the current repository.
 * @throws {Error} If the user is not a collaborator of the repository.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
export const checkRepositoryAccess = async () => {
  const { repo } = repository;

  try {
    const { permissions } = await getRepositoryInfo();

    if (!permissions?.pull) {
      throw new Error('Not a collaborator of the repository', {
        cause: new Error(get(_)('repository_no_access', { values: { repo } })),
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not a collaborator')) {
      throw error;
    }

    throw new Error('Failed to check repository access', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }
};

/**
 * Fetch the repository’s default branch name, which is typically `master` or `main`.
 * @returns {Promise<string>} Branch name.
 * @throws {Error} When the repository could not be found, or when the repository is empty.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
export const fetchDefaultBranchName = async () => {
  const { repo, baseURL = '' } = repository;

  try {
    const { default_branch: branch } = await getRepositoryInfo();

    if (!branch) {
      throw new Error('Failed to retrieve the default branch name.', {
        cause: new Error(get(_)('repository_empty', { values: { repo } })),
      });
    }

    Object.assign(repository, { branch }, getBaseURLs(baseURL, branch));

    return branch;
  } catch {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }
};
