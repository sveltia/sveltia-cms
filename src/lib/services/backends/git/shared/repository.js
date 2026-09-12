import { _ } from '@sveltia/i18n';

import { prefs } from '$lib/services/user/prefs.svelte';

/**
 * @import { RepositoryBaseURLs, RepositoryInfo } from '$lib/types/private';
 * @import { BackendName } from '$lib/types/public';
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

/**
 * Fill in a backend’s repository info from the CMS configuration during backend initialization.
 * @param {RepositoryInfo} repository Repository info placeholder to be updated in place.
 * @param {object} args Arguments.
 * @param {BackendName} args.service Backend name, e.g. `github`.
 * @param {string} args.label Backend label, e.g. `GitHub`.
 * @param {string} args.owner Repository owner.
 * @param {string} args.repo Repository name.
 * @param {string} [args.branch] Branch name, if specified in the CMS configuration.
 * @param {string} args.restApiRoot REST API root URL of the configured instance.
 * @param {string} args.defaultApiRoot REST API root URL of the service’s hosted instance, used to
 * tell whether the configured instance is self-hosted.
 * @param {(repoURL: string) => string} args.getTokenPageURL Function to get the URL of the page
 * for creating a new Personal Access Token.
 * @param {(repoURL: string, branch?: string) => RepositoryBaseURLs} args.getBaseURLs Function to
 * generate the base URLs for accessing the repository’s resources.
 * @returns {RepositoryInfo} The updated repository info.
 */
export const initRepositoryInfo = (
  repository,
  {
    service,
    label,
    owner,
    repo,
    branch,
    restApiRoot,
    defaultApiRoot,
    getTokenPageURL,
    getBaseURLs,
  },
) => {
  const repoPath = `${owner}/${repo}`;
  const repoURL = getRepoURL(restApiRoot, repoPath);

  Object.assign(
    repository,
    /** @type {RepositoryInfo} */ ({
      service,
      label,
      owner,
      repo,
      branch,
      repoURL,
      tokenPageURL: getTokenPageURL(repoURL),
      databaseName: `${service}:${repoPath}`,
      isSelfHosted: restApiRoot !== defaultApiRoot,
    }),
    getBaseURLs(repoURL, branch),
  );

  if (prefs.devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('repositoryInfo', repository);
  }

  return repository;
};

/**
 * Apply the default branch name fetched from the backend to the repository info, once the branch
 * is not specified in the CMS configuration.
 * @param {RepositoryInfo} repository Repository info to be updated in place.
 * @param {object} args Arguments.
 * @param {boolean} args.found Whether the repository was found on the backend.
 * @param {string | undefined} args.branch Default branch name, which is typically `master` or
 * `main`, or `undefined` if the repository is empty.
 * @param {(repoURL: string, branch?: string) => RepositoryBaseURLs} args.getBaseURLs Function to
 * generate the base URLs for accessing the repository’s resources.
 * @returns {string} Branch name.
 * @throws {Error} When the repository could not be found, or when the repository is empty.
 */
export const applyDefaultBranch = (repository, { found, branch, getBaseURLs }) => {
  const { repo, repoURL = '' } = repository;

  if (!found) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(_('repository_not_found', { values: { repo } })),
    });
  }

  if (!branch) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(_('repository_empty', { values: { repo } })),
    });
  }

  Object.assign(repository, { branch }, getBaseURLs(repoURL, branch));

  return branch;
};
