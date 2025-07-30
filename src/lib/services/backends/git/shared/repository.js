/**
 * @import { RepositoryInfo } from '$lib/types/private';
 */

/**
 * @type {RepositoryInfo}
 */
export const REPOSITORY_INFO_PLACEHOLDER = {
  service: '',
  label: '',
  owner: '',
  repo: '',
  branch: '',
  repoURL: '',
  treeBaseURL: '',
  blobBaseURL: '',
  isSelfHosted: false,
  databaseName: '',
};

/**
 * Get the base URL for the repository from the REST API root URL.
 * @param {string} restApiRoot REST API root URL. It can be `https://api.github.com`,
 * `https://github.example.com`, `https://gitlab.com/api/v3`, `https://example.com/gitea/api/v1`,
 * etc.
 * @param {string} repoPath Repository path, e.g., `owner/repo`.
 * @returns {string} Base URL for the repository.
 */
export const getRepoURL = (restApiRoot, repoPath) => {
  const baseURL =
    restApiRoot === 'https://api.github.com'
      ? 'https://github.com'
      : restApiRoot.replace(/\/api(?:\/v\d+)?(?:\/.*)?/, '');

  return `${baseURL}/${repoPath}`;
};
