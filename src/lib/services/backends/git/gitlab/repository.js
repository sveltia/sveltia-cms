import { recordBranchAccess } from '$lib/services/backends/branch-access';
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
 * @import { RepositoryBaseURLs, RepositoryInfo, RepositoryPath } from '$lib/types/private';
 */

/**
 * Regular expression to split a GitLab project path into a namespace and a project name. In GitLab
 * terminology, an owner is called a namespace, and a repository is called a project. A namespace
 * can contain a group and a subgroup concatenated with a `/` so we cannot simply use `split('/')`
 * here. A project name should not contain a `/`.
 * @see https://docs.gitlab.com/user/namespace/
 * @see https://gitlab.com/gitlab-org/gitlab/-/merge_requests/80055
 */
const REPO_PATH_REGEX = /(?<owner>.+)\/(?<repo>[^/]+)$/;

/** @type {RepositoryInfo} */
export const repository = { ...REPOSITORY_INFO_PLACEHOLDER };

/**
 * Split a full project path, such as `group/subgroup/project`, into a namespace and a project name.
 * @param {string} path Full project path.
 * @returns {RepositoryPath} Namespace and project name. Both are `undefined` if the path doesn’t
 * contain a slash.
 */
export const parseProjectPath = (path) =>
  /** @type {RepositoryPath} */ (path.match(REPO_PATH_REGEX)?.groups ?? {});

/**
 * Get the URL-encoded project identifier used in the REST API paths, e.g. the `group/project` path
 * with the slash percent-encoded.
 * @param {RepositoryPath} [repoPath] Project to address. Default: the configured project. With Open
 * Authoring the contributor’s fork is passed here, as that’s where their branches live.
 * @returns {string} Project ID.
 */
export const getProjectId = (repoPath) => {
  const { owner, repo } = repoPath ?? repository;

  return encodeURIComponent(`${owner}/${repo}`);
};

/**
 * Get the REST API path of the given branch.
 * @param {string} branch Branch name.
 * @param {RepositoryPath} [repoPath] Project holding the branch. Default: the configured project.
 * @returns {string} Path.
 * @see https://docs.gitlab.com/api/branches/
 */
export const getBranchPath = (branch, repoPath) =>
  `/projects/${getProjectId(repoPath)}/repository/branches/${encodeURIComponent(branch)}`;

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
 * Ask what the signed-in user may do with the configured project: whether they can see it at all,
 * and whether they can push to it, which takes the Developer role or higher, like Netlify/Decap CMS
 * requires. The permission reflects the user’s effective role, however it’s granted: direct
 * membership, a parent group, or a group invited to the project or to a parent group. It also works
 * for service accounts, which the members API doesn’t return.
 * @returns {Promise<{ found: boolean, canPush: boolean }>} Whether the project is visible to the
 * user, and whether they can push to it. Open Authoring tells the two apart — a contributor can
 * read the project but not push to it — while the regular access check needs both.
 * @see https://docs.gitlab.com/api/graphql/reference/#projectpermissions
 * @see https://docs.gitlab.com/user/permissions/
 */
export const fetchProjectPermissions = async () => {
  const result = /** @type {{ project: { userPermissions: { pushCode: boolean } } | null }} */ (
    await fetchGraphQL(FETCH_USER_PERMISSIONS_QUERY)
  );

  return { found: !!result.project, canPush: !!result.project?.userPermissions.pushCode };
};

/**
 * Check if the user has write access to the current repository.
 * @throws {Error} If the user can’t push to the repository.
 */
export const checkRepositoryAccess = async () => {
  const { repo } = repository;

  if (!(await fetchProjectPermissions()).canPush) {
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
  await recordBranchAccess(repository.branch, async (branch) => {
    const result = /** @type {{ can_push?: boolean }} */ (await fetchAPI(getBranchPath(branch)));

    return { canPush: result.can_push };
  });
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
