import {
  fetchDefaultBranchName,
  fetchRepositoryAccess,
  repository,
} from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import {
  createLocalizedError,
  NOT_COLLABORATOR_ERROR_MESSAGE,
} from '$lib/services/backends/git/shared/errors';
import {
  createForkError,
  fetchForkByNameFor,
  isOpenAuthoringConfiguredFor,
  pollForFork,
  resolveWorkflowRepository,
  runOpenAuthoringSetUp,
  setUpForkFor,
  syncForkWith,
} from '$lib/services/backends/git/shared/fork';
import {
  getRepositoryPath,
  isSameRepository,
  toRepositoryPath,
} from '$lib/services/backends/git/shared/repository';
import { user } from '$lib/services/user/account.svelte';

/**
 * @import { RepositoryPath } from '$lib/types/private';
 */

/**
 * Check whether Open Authoring is turned on for this backend in the site configuration: see
 * {@link isOpenAuthoringConfiguredFor}.
 * @returns {boolean} `true` if the `open_authoring` backend option is enabled.
 */
export const isOpenAuthoringConfigured = () => isOpenAuthoringConfiguredFor('github');

/**
 * Get the repository that receives the CMS’s commits: the signed-in user’s fork when the current
 * session is an Open Authoring one, and the configured repository otherwise. Content is always read
 * from the configured repository, so this is only for writes and for the branches behind them.
 * @returns {RepositoryPath} Repository owner and name.
 */
export const getWorkflowRepository = () => resolveWorkflowRepository(repository);

/**
 * Check whether the signed-in user has an invitation to the configured repository that they haven’t
 * accepted yet. An invitation grants no access until it’s accepted, and the notification is easy to
 * miss, so it’s a likely reason for being unable to read a repository the user was told they can.
 * @returns {Promise<boolean>} `true` if an invitation is waiting.
 * @see https://docs.github.com/en/rest/collaborators/invitations#list-repository-invitations-for-the-authenticated-user
 */
export const hasPendingInvitation = async () => {
  try {
    const invitations = /** @type {Record<string, any>[]} */ (
      await fetchAPI('/user/repository_invitations')
    );

    return invitations.some(({ repository: invited }) =>
      isSameRepository(invited?.full_name, repository),
    );
  } catch {
    // The list is a nicety; failing to read it just means there’s nothing extra to say
    return false;
  }
};

/**
 * Work out the most useful thing to tell a user whose request for the configured repository was
 * refused. The bare “no access” is true but rarely actionable, and the two cases below are the ones
 * that come up while setting Open Authoring up.
 * @param {Response} response The refused response.
 * @returns {Promise<Error>} Error to throw, with the message to show.
 */
const getNoAccessError = async (response) => {
  const { owner, repo } = repository;
  const repoPath = `${owner}/${repo}`;

  /**
   * Create the error with the given message. It carries the shared message, which the sign-in flow
   * looks for to drop the cached credentials, so the user gets the sign-in form rather than the
   * same error on every reload, and can sign in again once the cause has been dealt with.
   * @param {string} key Localized string key.
   * @returns {Error} Error.
   */
  const createError = (key) =>
    createLocalizedError(NOT_COLLABORATOR_ERROR_MESSAGE, key, { repo: repoPath });

  if (await hasPendingInvitation()) {
    return createError('open_authoring.invitation_pending');
  }

  // A public repository is readable by any authenticated request, so a refusal means the repository
  // is private. A sign-in that doesn’t cover private repositories is then worth calling out: the
  // account may well have access, while the token it was given doesn’t. The header is absent for a
  // fine-grained token, which reports its permissions differently
  const scopes = response.headers.get('x-oauth-scopes');

  if (scopes !== null && !scopes.split(/,\s*/).includes('repo')) {
    return createError('open_authoring.private_repo_scope_required');
  }

  return createError('repository_no_access');
};

/**
 * Fetch what the sign-in needs to know about the configured repository: whether the signed-in user
 * can commit to it, and whether it can be forked at all. See {@link fetchRepositoryAccess}. Open
 * Authoring still needs the contributor to be able to read the repository, so being unable to see
 * it is a dead end rather than a reason to fall back to a fork. A refusal is worth a hint.
 * @returns {Promise<{ canRead: boolean, canWrite: boolean, allowForking: boolean,
 * isPersonalPrivate: boolean }>} Repository access.
 * @throws {Error} When the user has no access to the repository, or the answer couldn’t be
 * determined — which is not the same thing.
 */
export const fetchOpenAuthoringAccess = async () => {
  const access = await fetchRepositoryAccess(getNoAccessError);

  // GitHub doesn’t offer read-only collaborators on a repository owned by a personal account, so
  // a private one has nobody for Open Authoring to serve: everyone invited can write to it and
  // keeps working on it directly, and everyone else can’t read it at all. The feature then sits
  // there doing nothing, with nothing on screen to say why, so point it out to whoever set it up
  if (access.isPersonalPrivate) {
    // eslint-disable-next-line no-console
    console.warn(
      `Open Authoring is enabled, but the ${repository.owner}/${repository.repo} repository is ` +
        'private and owned by a personal account. GitHub does not allow read-only collaborators ' +
        'there, so everyone who can sign in can also write to the repository and no one is ' +
        'treated as a contributor. Transfer the repository to an organization to use Open ' +
        'Authoring with it.',
    );
  }

  return access;
};

/**
 * Look for the fork at the name GitHub gives it by default: see {@link fetchForkByNameFor}.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if it isn’t there.
 */
export const fetchForkByName = () =>
  fetchForkByNameFor(repository, { headers: { Accept: 'application/json' } });

const FETCH_USER_FORK_QUERY = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      forks(ownerAffiliations: [OWNER], first: 1) {
        nodes {
          nameWithOwner
          owner {
            login
          }
        }
      }
    }
  }
`;

/**
 * Ask the configured repository for the fork the signed-in user owns, wherever it’s named. This
 * only runs when {@link fetchForkByName} came up empty. A failed query is passed on rather than
 * taken for no fork, which would have the contributor asked to create another one.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if there is none.
 * @see https://docs.github.com/en/graphql/reference/objects#repository
 */
export const fetchForkFromNetwork = async () => {
  const userName = user.account?.login;

  const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(FETCH_USER_FORK_QUERY)
  );

  const [node] = result?.forks?.nodes ?? [];

  // Check the owner rather than trusting the filter to have applied: committing to someone
  // else’s fork would fail in a way that’s hard to make sense of
  if (node?.owner?.login !== userName) {
    return undefined;
  }

  return toRepositoryPath(node.nameWithOwner);
};

/**
 * Look for an existing fork of the configured repository on the signed-in user’s account.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if there is none.
 */
export const fetchFork = async () => (await fetchForkByName()) ?? fetchForkFromNetwork();

/**
 * Wait until a newly requested fork can be read back. GitHub creates a fork asynchronously and the
 * request returns before the copy is complete, so committing to it right away could fail.
 * @param {RepositoryPath} fork Fork to wait for.
 * @param {number} [attemptsLeft] Number of checks at most, including the first one.
 * @throws {Error} When the fork hasn’t appeared within the allotted time.
 */
export const waitForFork = async ({ owner, repo }, attemptsLeft) => {
  await pollForFork({
    repoPath: `${owner}/${repo}`,
    attemptsLeft,
    /**
     * Ask GitHub whether the fork can be read back yet.
     * @returns {Promise<'ready' | 'pending'>} Whether the copy is complete.
     */
    checkFork: async () => {
      const response = /** @type {Response} */ (
        await fetchAPI(getRepositoryPath({ owner, repo }), {
          headers: { Accept: 'application/json' },
          responseType: 'raw',
        })
      );

      // GitHub reports no state of its own while the copy is in progress, so a repository that
      // can’t be read yet is simply one to come back to
      return response.ok ? 'ready' : 'pending';
    },
  });
};

/**
 * Fork the configured repository onto the signed-in user’s account.
 * @returns {Promise<RepositoryPath>} The new fork.
 * @throws {Error} When the fork could not be created.
 * @see https://docs.github.com/en/rest/repos/forks#create-a-fork
 */
export const createFork = async () => {
  const { owner, repo } = repository;
  /** @type {Record<string, any>} */
  let result;

  try {
    result = /** @type {Record<string, any>} */ (
      await fetchAPI(`${getRepositoryPath(repository)}/forks`, { method: 'POST' })
    );
  } catch (/** @type {any} */ ex) {
    throw createForkError(`${owner}/${repo}`, ex);
  }

  const fork = toRepositoryPath(result.full_name);

  await waitForFork(fork);

  return fork;
};

/**
 * Bring the fork’s copy of the configured branch up to date: see {@link syncForkWith}.
 * @param {RepositoryPath} fork Fork to update.
 * @returns {Promise<void>} Nothing.
 */
export const syncFork = (fork) => syncForkWith(fork, repository.branch);

/**
 * Work out how the signed-in user is going to write to the repository, and set up a fork for them
 * if they can’t write to the configured one. This replaces the plain access check performed when
 * Open Authoring is turned off, because a contributor without write access is expected here rather
 * than turned away.
 * @throws {Error} When the fork could not be set up.
 * @see https://sveltiacms.app/en/docs/workflows/open
 */
const setUpOpenAuthoring = async () => {
  await setUpForkFor({
    repository,
    fetchAccess: fetchOpenAuthoringAccess,
    // Syncing the fork needs the branch name
    fetchDefaultBranchName,
    fetchFork,
    prepareFork: syncFork,
    /**
     * Tell whether the repository can be forked, which the access check has read already. Forking
     * is turned off by default on a private repository, and can be turned off on a public one.
     * @param {{ allowForking: boolean }} access Repository access.
     * @returns {boolean} Result.
     */
    fetchForkingAllowed: ({ allowForking }) => allowForking,
    createFork,
  });
};

/**
 * Set up Open Authoring for the signed-in user: see {@link setUpOpenAuthoring}.
 * @throws {Error} When the fork could not be set up.
 */
export const initOpenAuthoring = async () => {
  await runOpenAuthoringSetUp(setUpOpenAuthoring);
};
