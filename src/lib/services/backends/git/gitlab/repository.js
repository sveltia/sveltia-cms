import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { fetchAPI, fetchGraphQL, graphqlVars } from '$lib/services/backends/git/shared/api';
import { REPOSITORY_INFO_PLACEHOLDER } from '$lib/services/backends/git/shared/repository';
import { user } from '$lib/services/user';

/**
 * @import { RepositoryInfo } from '$lib/types/private';
 */

/** @type {RepositoryInfo} */
export const repository = { ...REPOSITORY_INFO_PLACEHOLDER };

/**
 * Get the URL of the page for creating a new Personal Access Token (PAT) on GitLab.
 * @param {string} repoURL Repository URL, e.g. `https://gitlab.com/owner/repo`.
 * @returns {string} URL to create a new PAT.
 * @see https://docs.gitlab.com/user/profile/personal_access_tokens/
 */
export const getPatURL = (repoURL) => {
  const { origin } = new URL(repoURL);

  const params = new URLSearchParams({
    name: 'Sveltia CMS',
    scopes: 'api,read_user',
  });

  return `${origin}/-/user_settings/personal_access_tokens?${params}`;
};

/**
 * Generate base URLs for accessing the repository’s resources.
 * @param {string} repoURL The base URL of the repository.
 * @param {string} [branch] The branch name. Could be `undefined` if the branch is not specified in
 * the site configuration.
 * @returns {{ treeBaseURL: string, blobBaseURL: string }} An object containing the tree base URL
 * for browsing files, and the blob base URL for accessing file contents.
 */
export const getBaseURLs = (repoURL, branch) => ({
  treeBaseURL: branch ? `${repoURL}/-/tree/${branch}` : repoURL,
  blobBaseURL: branch ? `${repoURL}/-/blob/${branch}` : '',
});

/**
 * Check if the user has access to the current repository.
 * @throws {Error} If the user is not a collaborator of the repository.
 * @see https://docs.gitlab.com/api/members.html#get-a-member-of-a-group-or-project-including-inherited-and-invited-members
 */
export const checkRepositoryAccess = async () => {
  const { owner, repo } = repository;
  const userId = /** @type {number} */ (get(user)?.id);

  const { ok } = /** @type {Response} */ (
    await fetchAPI(`/projects/${encodeURIComponent(`${owner}/${repo}`)}/members/all/${userId}`, {
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
  query($fullPath: ID!) {
    project(fullPath: $fullPath) {
      repository {
        rootRef
      }
    }
  }
`;

/**
 * Fetch the repository’s default branch name, which is typically `master` or `main`.
 * @returns {Promise<string>} Branch name.
 * @throws {Error} When the repository could not be found, or when the repository is empty.
 * @see https://docs.gitlab.com/api/graphql/reference/#repository
 */
export const fetchDefaultBranchName = async () => {
  const { repo, repoURL = '' } = repository;

  const result = /** @type {{ project: { repository?: { rootRef: string } } }} */ (
    await fetchGraphQL(FETCH_DEFAULT_BRANCH_NAME_QUERY)
  );

  if (!result.project) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }

  const { rootRef: branch } = result.project.repository ?? {};

  if (!branch) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_empty', { values: { repo } })),
    });
  }

  Object.assign(repository, { branch }, getBaseURLs(repoURL, branch));
  Object.assign(graphqlVars, { branch });

  return branch;
};
