import { lockedBranch } from '$lib/services/backends/branch-access';
import { fetchAPI, fetchGraphQL, graphqlVars } from '$lib/services/backends/git/shared/api';
import {
  createLocalizedError,
  NOT_COLLABORATOR_ERROR_MESSAGE,
} from '$lib/services/backends/git/shared/errors';
import {
  applyDefaultBranch,
  REPOSITORY_INFO_PLACEHOLDER,
} from '$lib/services/backends/git/shared/repository';

/**
 * @import { RepositoryBaseURLs, RepositoryInfo } from '$lib/types/private';
 */

/**
 * Placeholder for repository information.
 * @type {RepositoryInfo}
 */
export const repository = { ...REPOSITORY_INFO_PLACEHOLDER };

/**
 * Generate base URLs for accessing the repository’s resources.
 * @param {string} repoURL The base URL of the repository.
 * @param {string} [branch] The branch name. Could be `undefined` if the branch is not specified in
 * the CMS configuration.
 * @returns {RepositoryBaseURLs} An object containing the tree base URL for browsing files, and the
 * blob base URL for accessing file contents.
 */
export const getBaseURLs = (repoURL, branch) => ({
  treeBaseURL: branch ? `${repoURL}/tree/${branch}` : repoURL,
  blobBaseURL: branch ? `${repoURL}/blob/${branch}` : '',
  commitBaseURL: `${repoURL}/commit`,
});

/**
 * Check if the user has write access to the current repository, which takes the write, maintain or
 * admin role, like Netlify/Decap CMS requires. The repository reports the authenticated user’s own
 * permissions, however they’re granted, including through an organization team. Asking the
 * collaborator endpoint instead would let a read-only collaborator in.
 * @throws {Error} If the user can’t push to the repository.
 * @see https://docs.github.com/en/rest/repos/repos#get-a-repository
 */
export const checkRepositoryAccess = async () => {
  const { owner, repo } = repository;

  const response = /** @type {Response} */ (
    await fetchAPI(`/repos/${owner}/${repo}`, {
      headers: { Accept: 'application/json' },
      responseType: 'raw',
    })
  );

  const { permissions } = response.ok
    ? /** @type {{ permissions?: { push?: boolean } }} */ (await response.json())
    : {};

  if (!permissions?.push) {
    throw createLocalizedError(NOT_COLLABORATOR_ERROR_MESSAGE, 'repository_no_access', { repo });
  }
};

const FETCH_BRANCH_ACCESS_QUERY = `
  query($owner: String!, $repo: String!, $qualifiedName: String!) {
    repository(owner: $owner, name: $repo) {
      ref(qualifiedName: $qualifiedName) {
        refUpdateRule {
          viewerCanPush
        }
      }
    }
  }
`;

/**
 * Check if the user can push to the configured branch, and record it in {@link lockedBranch}. Write
 * access is enough to sign in, but a protected branch may require a pull request or only allow some
 * people to push, in which case everything that commits to the branch directly is made read-only up
 * front, rather than failing when the user saves. The rule is `null` for a branch that isn’t
 * protected. A failed request leaves the branch writable, as GitHub still refuses a push the user
 * isn’t allowed to make.
 *
 * Whether the user can merge a pull request into the branch isn’t told: a branch that requires a
 * pull request can’t be pushed to, but its pull requests can still be merged, so the Publish button
 * is left to GitHub to allow or refuse.
 * @see https://docs.github.com/en/graphql/reference/objects#refupdaterule
 */
export const checkBranchAccess = async () => {
  const { branch } = repository;
  let canPush = true;

  if (branch) {
    try {
      const result = /** @type {{ repository?: { ref?: { refUpdateRule?: any } } }} */ (
        await fetchGraphQL(FETCH_BRANCH_ACCESS_QUERY, { qualifiedName: `refs/heads/${branch}` })
      );

      canPush = result.repository?.ref?.refUpdateRule?.viewerCanPush !== false;
    } catch {
      // Keep the branch writable, as said above
    }
  }

  lockedBranch.current = canPush ? undefined : branch;
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
  const result = /** @type {{ repository: { defaultBranchRef?: { name: string } } }} */ (
    await fetchGraphQL(FETCH_DEFAULT_BRANCH_NAME_QUERY)
  );

  const branch = applyDefaultBranch(repository, {
    found: !!result.repository,
    branch: result.repository?.defaultBranchRef?.name,
    getBaseURLs,
  });

  Object.assign(graphqlVars, { branch });

  return branch;
};
