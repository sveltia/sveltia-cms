import { stripSlashes } from '@sveltia/utils/string';

import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { getRootDir } from '$lib/services/backends/root-dir';
import { prefs } from '$lib/services/user/prefs.svelte';
import { encodePathSegments } from '$lib/services/utils/url';

/**
 * @import { RepositoryBaseURLs, RepositoryInfo, RepositoryPath } from '$lib/types/private';
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
 * Regular expression matching the first path segment of a REST API root URL that is exactly `api`,
 * along with everything after it. The origin is matched separately, so a host name starting with
 * `api` is left alone, and so is a path segment that only starts with it, like `apis`.
 */
const API_PATH_REGEX = /^(?<origin>(?:[a-z][a-z\d+.-]*:)?\/\/[^/]*)?(?<path>.*?)\/api(?:\/.*)?$/i;

/**
 * Get the base URL of the service’s web interface from the REST API root URL. A self-hosted
 * instance can live under a subpath, which is kept.
 * @param {string} restApiRoot REST API root URL. It can be `https://api.github.com`,
 * `https://github.example.com`, `https://gitlab.com/api/v3`, `https://example.com/gitea/api/v1`,
 * etc.
 * @returns {string} Base URL, e.g. `https://github.com` or `https://example.com/gitea`.
 */
export const getInstanceURL = (restApiRoot) =>
  restApiRoot === 'https://api.github.com'
    ? 'https://github.com'
    : restApiRoot.replace(API_PATH_REGEX, '$<origin>$<path>');

/**
 * Get the base URL for the repository from the REST API root URL.
 * @param {string} restApiRoot REST API root URL. See {@link getInstanceURL}.
 * @param {string} repoPath Repository path, e.g., `owner/repo`.
 * @returns {string} Base URL for the repository.
 */
export const getRepoURL = (restApiRoot, repoPath) => `${getInstanceURL(restApiRoot)}/${repoPath}`;

/**
 * Get the REST API path of the given repository on GitHub or Gitea/Forgejo, whose APIs address a
 * repository the same way. The owner and repository names are encoded, though a valid name never
 * needs it.
 * @param {RepositoryPath} repository Repository.
 * @returns {string} Path, e.g. `/repos/owner/repo`.
 * @see https://docs.github.com/en/rest/repos/repos#get-a-repository
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
export const getRepositoryPath = ({ owner, repo }) =>
  `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

/**
 * Check whether a full repository name returned by a Git service, like `full_name` on GitHub and
 * Gitea/Forgejo or `path_with_namespace` on GitLab, names the given repository. The services treat
 * owner and repository names as case-insensitive, so they’re compared that way.
 * @param {string | undefined} fullName Full name, e.g. `Owner/Repo`.
 * @param {RepositoryPath} repository Repository to compare with.
 * @returns {boolean} Result. `false` if no name is given.
 */
export const isSameRepository = (fullName, { owner, repo }) =>
  typeof fullName === 'string' && fullName.toLowerCase() === `${owner}/${repo}`.toLowerCase();

/**
 * Get the REST API path of the given pull request on GitHub or Gitea/Forgejo.
 * @param {RepositoryPath} repository Repository holding the pull request.
 * @param {number | undefined} number Pull request number.
 * @returns {string} Path, e.g. `/repos/owner/repo/pulls/1`.
 */
export const getPullRequestPath = (repository, number) =>
  `${getRepositoryPath(repository)}/pulls/${number}`;

/**
 * Create a function to generate base URLs for accessing the repository’s resources on a service’s
 * web interface, which only differs from another service’s by the path segments that come after the
 * repository URL.
 * @param {object} paths Path segments, with a leading slash.
 * @param {string} paths.tree Path to browse a branch, e.g. `/tree`.
 * @param {string} paths.blob Path to read a file on a branch, e.g. `/blob`.
 * @param {string} paths.commit Path to view a commit, e.g. `/commit`.
 * @returns {(repoURL: string, branch?: string) => RepositoryBaseURLs} Function that takes the base
 * URL of the repository and the branch name, which can be `undefined` if the branch is not
 * specified in the CMS configuration, and returns an object containing the tree base URL for
 * browsing files, the blob base URL for accessing file contents, and the commit base URL.
 */
export const createBaseURLsGetter =
  ({ tree, blob, commit }) =>
  (repoURL, branch) => ({
    // A branch name may contain a character that ends a URL path, like `#` in `cms/posts/c#`
    treeBaseURL: branch ? `${repoURL}${tree}/${encodePathSegments(branch)}` : repoURL,
    blobBaseURL: branch ? `${repoURL}${blob}/${encodePathSegments(branch)}` : '',
    commitBaseURL: `${repoURL}${commit}`,
  });

/**
 * Generate the base URLs for accessing the repository’s resources, pointing the tree and blob URLs
 * at the configured root directory, so a file path relative to it can be appended. Without a
 * branch, the tree base URL is the repository itself and there is no blob base URL, so they’re left
 * as they are.
 * @param {(repoURL: string, branch?: string) => RepositoryBaseURLs} getBaseURLs Backend’s function
 * to generate the base URLs.
 * @param {string} repoURL The base URL of the repository.
 * @param {string} [branch] Branch name.
 * @returns {RepositoryBaseURLs} Base URLs.
 */
const getScopedBaseURLs = (getBaseURLs, repoURL, branch) => {
  const urls = getBaseURLs(repoURL, branch);
  const rootDir = getRootDir();

  if (!rootDir || !branch) {
    return urls;
  }

  return {
    ...urls,
    treeBaseURL: `${urls.treeBaseURL}/${encodePathSegments(rootDir)}`,
    blobBaseURL: `${urls.blobBaseURL}/${encodePathSegments(rootDir)}`,
  };
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
 * @param {(instanceURL: string) => string} args.getTokenPageURL Function to get the URL of the
 * page for creating a new Personal Access Token from the base URL of the service’s web interface.
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
  // Drop any trailing slash from the configured URL, e.g. `https://gitlab.com/api/v4/`, so the
  // hosted service isn’t taken for a self-hosted instance and the repository URL has no `//`
  restApiRoot = stripSlashes(restApiRoot);

  const repoPath = `${owner}/${repo}`;
  const repoURL = getRepoURL(restApiRoot, repoPath);
  const rootDir = getRootDir();

  Object.assign(
    repository,
    /** @type {RepositoryInfo} */ ({
      service,
      label,
      owner,
      repo,
      branch,
      repoURL,
      tokenPageURL: getTokenPageURL(getInstanceURL(restApiRoot)),
      // The cached files are keyed with paths relative to the root directory, so each directory
      // of a monorepo gets a database of its own
      databaseName: rootDir ? `${service}:${repoPath}:${rootDir}` : `${service}:${repoPath}`,
      isSelfHosted: restApiRoot !== defaultApiRoot,
    }),
    getScopedBaseURLs(getBaseURLs, repoURL, branch),
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
    throw createLocalizedError(
      'Failed to retrieve the default branch name.',
      'repository_not_found',
      { repo },
    );
  }

  if (!branch) {
    throw createLocalizedError('Failed to retrieve the default branch name.', 'repository_empty', {
      repo,
    });
  }

  Object.assign(repository, { branch }, getScopedBaseURLs(getBaseURLs, repoURL, branch));

  return branch;
};
