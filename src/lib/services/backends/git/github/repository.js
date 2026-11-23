import { recordBranchAccess } from '$lib/services/backends/branch-access';
import { fetchAPI, fetchGraphQL, graphqlVars } from '$lib/services/backends/git/shared/api';
import {
  createPermissionError,
  toRepositoryAccessError,
} from '$lib/services/backends/git/shared/errors';
import {
  applyDefaultBranch,
  createBaseURLsGetter,
  getRepositoryPath,
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
export const getBaseURLs = createBaseURLsGetter({
  tree: '/tree',
  blob: '/blob',
  commit: '/commit',
});

/**
 * Check whether the given response was rejected because the API rate limit is exhausted. GitHub
 * answers a spent primary limit with a 403, the same status it uses to refuse access, so the
 * remaining-request count is what tells the two apart.
 * @param {Response} response Response to check.
 * @returns {boolean} `true` if the request was rate limited.
 * @see https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
 */
export const isRateLimited = ({ status, headers }) =>
  status === 429 ||
  headers.get('retry-after') !== null ||
  headers.get('x-ratelimit-remaining') === '0';

/**
 * Fetch the signed-in user’s access to the configured repository, and whether it can be forked at
 * all. The repository reports the authenticated user’s own permissions, however they’re granted,
 * including through an organization team. Asking the collaborator endpoint instead would let a
 * read-only collaborator in, and would need administrator access to answer, so a maintainer who
 * merely has write access would be turned away as though they had none.
 * @param {(response: Response) => Promise<Error>} [getRefusalError] Function to create the error
 * to throw when the request is refused with a 403 or 404, in place of the plain “no access” one.
 * @returns {Promise<{ canRead: boolean, canWrite: boolean, allowForking: boolean,
 * isPersonalPrivate: boolean }>} Repository access. `canWrite` takes the write, maintain or admin
 * role. `isPersonalPrivate` is whether the repository is private and owned by a personal account.
 * @throws {Error} When the user has no access to the repository, or the answer couldn’t be
 * determined — which is not the same thing.
 * @see https://docs.github.com/en/rest/repos/repos#get-a-repository
 */
export const fetchRepositoryAccess = async (getRefusalError) => {
  const response = /** @type {Response} */ (
    await fetchAPI(getRepositoryPath(repository), {
      headers: { Accept: 'application/json' },
      responseType: 'raw',
    })
  );

  if (!response.ok) {
    // A rate limit shares the 403 status with a refusal, so it’s reported as a failed check rather
    // than as no access, as reading it as “no write access” would send a maintainer down the fork
    // path over something passing. A `raw` response skips the token refresh, so an expired token
    // (401) still counts as no access, sending the user back to the sign-in form
    const status = isRateLimited(response) ? undefined : response.status;

    if (getRefusalError && (status === 403 || status === 404)) {
      throw await getRefusalError(response);
    }

    throw toRepositoryAccessError(repository, status);
  }

  const {
    permissions,
    private: isPrivate,
    owner,
    allow_forking: allowForking,
  } = await response.json();

  return {
    // A response without the user’s permissions doesn’t say they can read the repository
    canRead: !!permissions?.pull,
    canWrite: !!permissions?.push,
    allowForking: allowForking !== false,
    isPersonalPrivate: !!isPrivate && owner?.type === 'User',
  };
};

/**
 * Check if the user has write access to the current repository, like Netlify/Decap CMS requires.
 * @throws {Error} If the user can’t push to the repository, or the access couldn’t be checked.
 */
export const checkRepositoryAccess = async () => {
  const { canRead, canWrite } = await fetchRepositoryAccess();

  if (!canWrite) {
    // A read or triage collaborator can read the repository
    throw createPermissionError(repository.repo, canRead);
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
  await recordBranchAccess(repository.branch, async (branch) => {
    const result = /** @type {{ repository?: { ref?: { refUpdateRule?: any } } }} */ (
      await fetchGraphQL(FETCH_BRANCH_ACCESS_QUERY, { qualifiedName: `refs/heads/${branch}` })
    );

    return { canPush: result.repository?.ref?.refUpdateRule?.viewerCanPush };
  });
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
