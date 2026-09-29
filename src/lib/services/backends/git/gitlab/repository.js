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

/** @type {RepositoryInfo} */
export const repository = { ...REPOSITORY_INFO_PLACEHOLDER };

/**
 * Get the URL-encoded project identifier used in the REST API paths, e.g. the `group/project` path
 * with the slash percent-encoded.
 * @returns {string} Project ID.
 */
export const getProjectId = () => {
  const { owner, repo } = repository;

  return encodeURIComponent(`${owner}/${repo}`);
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
  treeBaseURL: branch ? `${repoURL}/-/tree/${branch}` : repoURL,
  blobBaseURL: branch ? `${repoURL}/-/blob/${branch}` : '',
  commitBaseURL: `${repoURL}/-/commit`,
});

const FETCH_USER_PERMISSIONS_QUERY = `
  query($fullPath: ID!) {
    project(fullPath: $fullPath) {
      userPermissions {
        pushCode
      }
    }
  }
`;

/**
 * Check if the user has write access to the current repository, which takes the Developer role or
 * higher, like Netlify/Decap CMS requires. The permission reflects the user’s effective role,
 * however it’s granted: direct membership, a parent group, or a group invited to the project or to
 * a parent group. It also works for service accounts, which the members API doesn’t return.
 * @throws {Error} If the user can’t push to the repository.
 * @see https://docs.gitlab.com/api/graphql/reference/#projectpermissions
 * @see https://docs.gitlab.com/user/permissions/
 */
export const checkRepositoryAccess = async () => {
  const { repo } = repository;

  const result = /** @type {{ project: { userPermissions: { pushCode: boolean } } | null }} */ (
    await fetchGraphQL(FETCH_USER_PERMISSIONS_QUERY)
  );

  if (!result.project?.userPermissions.pushCode) {
    throw createLocalizedError(NOT_COLLABORATOR_ERROR_MESSAGE, 'repository_no_access', { repo });
  }
};

/**
 * Check if the user can push to the configured branch, and record it in {@link lockedBranch}. The
 * Developer role is enough to sign in, but a protected branch may only allow Maintainers to push,
 * in which case everything that commits to the branch directly is made read-only up front, rather
 * than failing when the user saves. A failed request leaves the branch writable, as GitLab still
 * refuses a push the user isn’t allowed to make.
 * @see https://docs.gitlab.com/api/branches/#get-single-repository-branch
 * @see https://docs.gitlab.com/user/project/repository/branches/protected/
 */
export const checkBranchAccess = async () => {
  const { branch } = repository;
  let canPush = true;

  if (branch) {
    try {
      const result = /** @type {{ can_push?: boolean }} */ (
        await fetchAPI(
          `/projects/${getProjectId()}/repository/branches/${encodeURIComponent(branch)}`,
        )
      );

      canPush = result.can_push !== false;
    } catch {
      // Keep the branch writable, as said above
    }
  }

  lockedBranch.current = canPush ? undefined : branch;
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
  const result = /** @type {{ project: { repository?: { rootRef: string } } }} */ (
    await fetchGraphQL(FETCH_DEFAULT_BRANCH_NAME_QUERY)
  );

  const branch = applyDefaultBranch(repository, {
    found: !!result.project,
    branch: result.project?.repository?.rootRef,
    getBaseURLs,
  });

  Object.assign(graphqlVars, { branch });

  return branch;
};
