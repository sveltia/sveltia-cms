import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { fetchAPI, fetchGraphQL, graphqlVars } from '$lib/services/backends/git/shared/api';
import { REPOSITORY_INFO_PLACEHOLDER } from '$lib/services/backends/git/shared/repository';
import { user } from '$lib/services/user';

/**
 * @import { RepositoryInfo } from '$lib/types/private';
 */

/**
 * Placeholder for repository information.
 * @type {RepositoryInfo}
 */
export const repository = { ...REPOSITORY_INFO_PLACEHOLDER };

/**
 * Generate base URLs for accessing the repository’s resources.
 * @param {string} baseURL The name of the repository.
 * @param {string} [branch] The branch name. Could be `undefined` if the branch is not specified in
 * the site configuration.
 * @returns {{ treeBaseURL: string, blobBaseURL: string }} An object containing the tree base URL
 * for browsing files, and the blob base URL for accessing file contents.
 */
export const getBaseURLs = (baseURL, branch) => ({
  treeBaseURL: branch ? `${baseURL}/tree/${branch}` : baseURL,
  blobBaseURL: branch ? `${baseURL}/blob/${branch}` : '',
});

/**
 * Check if the user has access to the current repository.
 * @throws {Error} If the user is not a collaborator of the repository.
 * @see https://docs.github.com/en/rest/collaborators/collaborators#check-if-a-user-is-a-repository-collaborator
 */
export const checkRepositoryAccess = async () => {
  const { owner, repo } = repository;
  const userName = /** @type {string} */ (get(user)?.login);

  const { ok } = /** @type {Response} */ (
    await fetchAPI(`/repos/${owner}/${repo}/collaborators/${encodeURIComponent(userName)}`, {
      headers: { Accept: 'application/json' },
      responseType: 'raw',
    })
  );

  if (!ok) {
    throw new Error('Not a collaborator of the repository', {
      cause: new Error(get(_)('repository_no_access', { values: { repo } })),
    });
  }
};

const FETCH_DEFAULT_BRANCH_NAME_QUERY = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      defaultBranchRef {
        name
      }
    }
  }
`;

/**
 * Fetch the repository’s default branch name, which is typically `master` or `main`.
 * @returns {Promise<string>} Branch name.
 * @throws {Error} When the repository could not be found, or when the repository is empty.
 */
export const fetchDefaultBranchName = async () => {
  const { repo, baseURL = '' } = repository;

  const result = /** @type {{ repository: { defaultBranchRef?: { name: string } } }} */ (
    await fetchGraphQL(FETCH_DEFAULT_BRANCH_NAME_QUERY)
  );

  if (!result.repository) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }

  const { name: branch } = result.repository.defaultBranchRef ?? {};

  if (!branch) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_empty', { values: { repo } })),
    });
  }

  Object.assign(repository, { branch }, getBaseURLs(baseURL, branch));
  Object.assign(graphqlVars, { branch });

  return branch;
};
