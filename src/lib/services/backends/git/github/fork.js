import { _ } from '@sveltia/i18n';
import { sleep } from '@sveltia/utils/misc';
import { get } from 'svelte/store';

import { fetchDefaultBranchName, repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { user } from '$lib/services/user/account.svelte';
import { forkedRepository, requestForkPermission } from '$lib/services/workflow/open-authoring';

/**
 * @import { RepositoryPath } from '$lib/types/private';
 */

/**
 * How long to wait for a newly requested fork to become available. Forking is asynchronous, and a
 * large repository can take a while to copy, so the polling is generous before giving up.
 */
const FORK_POLL = {
  interval: 1000,
  attempts: 30,
};

/**
 * Check whether Open Authoring is turned on in the site configuration. It doesn’t mean the
 * signed-in user is actually contributing through a fork: a user who can write to the configured
 * repository keeps working on it directly. Use the `openAuthoring` store for that.
 * @returns {boolean} `true` if the `open_authoring` backend option is enabled.
 */
export const isOpenAuthoringConfigured = () => {
  const { backend } = get(cmsConfig) ?? {};

  return backend?.name === 'github' && backend.open_authoring === true;
};

/**
 * Get the repository that receives the CMS’s commits: the signed-in user’s fork when the current
 * session is an Open Authoring one, and the configured repository otherwise. Content is always read
 * from the configured repository, so this is only for writes and for the branches behind them.
 * @returns {RepositoryPath} Repository owner and name.
 */
export const getWorkflowRepository = () => {
  const fork = get(forkedRepository);

  return fork ?? { owner: repository.owner, repo: repository.repo };
};

/**
 * HTTP statuses that mean the signed-in user can’t see the repository at all. A private repository
 * answers a request from someone without access with a 404 rather than a 403, so its existence
 * isn’t leaked.
 */
const NO_ACCESS_STATUSES = [403, 404];

/**
 * Check whether the given response was rejected because the API rate limit is exhausted. GitHub
 * answers a spent primary limit with a 403, the same status it uses to refuse access, so the
 * remaining-request count is what tells the two apart.
 * @param {Response} response Response to check.
 * @returns {boolean} `true` if the request was rate limited.
 * @see https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
 */
const isRateLimited = ({ status, headers }) =>
  status === 429 ||
  headers.get('retry-after') !== null ||
  headers.get('x-ratelimit-remaining') === '0';

/**
 * Check whether the signed-in user has an invitation to the configured repository that they haven’t
 * accepted yet. An invitation grants no access until it’s accepted, and the notification is easy to
 * miss, so it’s a likely reason for being unable to read a repository the user was told they can.
 * @returns {Promise<boolean>} `true` if an invitation is waiting.
 * @see https://docs.github.com/en/rest/collaborators/invitations#list-repository-invitations-for-the-authenticated-user
 */
export const hasPendingInvitation = async () => {
  const { owner, repo } = repository;
  const repoPath = `${owner}/${repo}`.toLowerCase();

  try {
    const invitations = /** @type {Record<string, any>[]} */ (
      await fetchAPI('/user/repository_invitations')
    );

    return invitations.some(
      ({ repository: invited }) => invited?.full_name?.toLowerCase() === repoPath,
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
 * @returns {Promise<string>} Message to show.
 */
const getNoAccessMessage = async (response) => {
  const { owner, repo } = repository;
  const repoPath = `${owner}/${repo}`;

  if (await hasPendingInvitation()) {
    return _('open_authoring.invitation_pending', { values: { repo: repoPath } });
  }

  // A public repository is readable by any authenticated request, so a refusal means the repository
  // is private. A sign-in that doesn’t cover private repositories is then worth calling out: the
  // account may well have access, while the token it was given doesn’t. The header is absent for a
  // fine-grained token, which reports its permissions differently
  const scopes = response.headers.get('x-oauth-scopes');

  if (scopes !== null && !scopes.split(/,\s*/).includes('repo')) {
    return _('open_authoring.private_repo_scope_required', { values: { repo: repoPath } });
  }

  return _('repository_no_access', { values: { repo: repoPath } });
};

/**
 * Fetch what the sign-in needs to know about the configured repository: whether the signed-in user
 * can commit to it, and whether it can be forked at all. Both come from the repository itself,
 * which reports the authenticated user’s own permissions. Asking the collaborator endpoint instead
 * would need administrator access to answer, so a maintainer who merely has write access would be
 * turned away as though they had none.
 * @returns {Promise<{ canWrite: boolean, allowForking: boolean }>} Repository access.
 * @throws {Error} When the user has no access to the repository, or the answer couldn’t be
 * determined — which is not the same thing.
 * @see https://docs.github.com/en/rest/repos/repos#get-a-repository
 */
export const fetchRepositoryAccess = async () => {
  const { owner, repo } = repository;
  const repoPath = `${owner}/${repo}`;

  const response = /** @type {Response} */ (
    await fetchAPI(`/repos/${owner}/${repo}`, {
      headers: { Accept: 'application/json' },
      responseType: 'raw',
    })
  );

  if (response.ok) {
    const {
      permissions,
      private: isPrivate,
      owner: repoOwner,
      allow_forking: allowForking,
    } = await response.json();

    // GitHub doesn’t offer read-only collaborators on a repository owned by a personal account, so
    // a private one has nobody for Open Authoring to serve: everyone invited can write to it and
    // keeps working on it directly, and everyone else can’t read it at all. The feature then sits
    // there doing nothing, with nothing on screen to say why, so point it out to whoever set it up
    if (isPrivate && repoOwner?.type === 'User') {
      // eslint-disable-next-line no-console
      console.warn(
        `Open Authoring is enabled, but the ${repoPath} repository is private and owned by a ` +
          'personal account. GitHub does not allow read-only collaborators there, so everyone ' +
          'who can sign in can also write to the repository and no one is treated as a ' +
          'contributor. Transfer the repository to an organization to use Open Authoring with it.',
      );
    }

    // `push` covers the write, maintain and admin roles
    return { canWrite: !!permissions?.push, allowForking: allowForking !== false };
  }

  // Open Authoring still needs the contributor to be able to read the repository, so being unable
  // to see it is a dead end rather than a reason to fall back to a fork
  if (NO_ACCESS_STATUSES.includes(response.status) && !isRateLimited(response)) {
    throw new Error('No access to the repository', {
      cause: new Error(await getNoAccessMessage(response)),
    });
  }

  // A rate limit or an outage leaves the question unanswered. Reading that as “no write access”
  // would send a maintainer down the fork path over something passing, and offer to create a copy
  // of a repository they can already write to, so make the failure visible instead
  throw new Error('Failed to check the repository permission.', {
    cause: new Error(_('open_authoring.permission_check_failed', { values: { repo: repoPath } })),
  });
};

/**
 * Look for the fork at the name GitHub gives it by default, which is the parent’s. This is where it
 * is unless the contributor renamed it, or already had a repository of that name when the fork was
 * made, in which case GitHub added a suffix. A repository that happens to share the name but isn’t
 * a fork of the configured one is ignored.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if it isn’t there.
 * @see https://docs.github.com/en/rest/repos/repos#get-a-repository
 */
export const fetchForkByName = async () => {
  const { owner, repo } = repository;
  const userName = /** @type {string} */ (user.account?.login);

  const response = /** @type {Response} */ (
    await fetchAPI(`/repos/${encodeURIComponent(userName)}/${repo}`, {
      headers: { Accept: 'application/json' },
      responseType: 'raw',
    })
  );

  if (!response.ok) {
    return undefined;
  }

  const result = await response.json();
  const parent = result.parent?.full_name?.toLowerCase();

  if (!result.fork || parent !== `${owner}/${repo}`.toLowerCase()) {
    return undefined;
  }

  const [forkOwner, forkRepo] = result.full_name.split('/');

  return { owner: forkOwner, repo: forkRepo };
};

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
 * only runs when {@link fetchForkByName} came up empty, so its worst case is the behavior without
 * it: no fork found, and the contributor asked whether to make one.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if there is none.
 * @see https://docs.github.com/en/graphql/reference/objects#repository
 */
export const fetchForkFromNetwork = async () => {
  const userName = user.account?.login;

  try {
    const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
      await fetchGraphQL(FETCH_USER_FORK_QUERY)
    );

    const [node] = result?.forks?.nodes ?? [];

    // Check the owner rather than trusting the filter to have applied: committing to someone
    // else’s fork would fail in a way that’s hard to make sense of
    if (node?.owner?.login !== userName) {
      return undefined;
    }

    const [forkOwner, forkRepo] = node.nameWithOwner.split('/');

    return { owner: forkOwner, repo: forkRepo };
  } catch {
    return undefined;
  }
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
 * @param {number} [attemptsLeft] Number of attempts remaining, used for the recursive retry.
 * @throws {Error} When the fork hasn’t appeared within the allotted time.
 */
export const waitForFork = async ({ owner, repo }, attemptsLeft = FORK_POLL.attempts) => {
  const response = /** @type {Response} */ (
    await fetchAPI(`/repos/${owner}/${repo}`, {
      headers: { Accept: 'application/json' },
      responseType: 'raw',
    })
  );

  if (response.ok) {
    return;
  }

  if (attemptsLeft <= 1) {
    throw new Error('Timed out waiting for the fork to be created.', {
      cause: new Error(_('open_authoring.fork_failed', { values: { repo: `${owner}/${repo}` } })),
    });
  }

  await sleep(FORK_POLL.interval);
  await waitForFork({ owner, repo }, attemptsLeft - 1);
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
      await fetchAPI(`/repos/${owner}/${repo}/forks`, { method: 'POST' })
    );
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to fork the repository.', ex);

    throw new Error('Failed to fork the repository.', {
      cause: new Error(_('open_authoring.fork_failed', { values: { repo: `${owner}/${repo}` } })),
    });
  }

  const [forkOwner, forkRepo] = result.full_name.split('/');
  /** @type {RepositoryPath} */
  const fork = { owner: forkOwner, repo: forkRepo };

  await waitForFork(fork);

  return fork;
};

/**
 * Bring the fork’s copy of the configured branch up to date with the configured repository, so a
 * new workflow branch starts from what’s currently on the site and the resulting pull request only
 * contains the entry being edited. A failure is logged rather than raised: a fork that has drifted
 * still works, it just makes for a noisier pull request.
 * @param {RepositoryPath} fork Fork to update.
 * @see https://docs.github.com/en/rest/branches/branches#sync-a-fork-branch-with-the-upstream-repository
 */
export const syncFork = async ({ owner, repo }) => {
  /** @type {Response | undefined} */
  let response;

  try {
    response = /** @type {Response} */ (
      await fetchAPI(`/repos/${owner}/${repo}/merge-upstream`, {
        method: 'POST',
        body: { branch: repository.branch },
        responseType: 'raw',
      })
    );
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to sync the ${owner}/${repo} fork with the upstream repository.`, ex);

    return;
  }

  // The request answers with a conflict when the fork has commits of its own on the branch, which
  // is a state the CMS can’t resolve on the contributor’s behalf
  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      `The ${owner}/${repo} fork could not be fast-forwarded to the upstream repository.`,
    );
  }
};

/**
 * Work out how the signed-in user is going to write to the repository, and set up a fork for them
 * if they can’t write to the configured one. This replaces the plain access check performed when
 * Open Authoring is turned off, because a contributor without write access is expected here rather
 * than turned away.
 * @throws {Error} When the fork could not be set up.
 * @see https://sveltiacms.app/en/docs/workflows/open
 */
export const initOpenAuthoring = async () => {
  forkedRepository.set(undefined);

  const { canWrite, allowForking } = await fetchRepositoryAccess();

  // A maintainer keeps working on the configured repository, as if Open Authoring was off
  if (canWrite) {
    return;
  }

  const { owner, repo } = repository;
  const repoPath = `${owner}/${repo}`;

  // Syncing the fork needs the branch name, which is otherwise resolved later in the data load
  if (!repository.branch) {
    await fetchDefaultBranchName();
  }

  const existingFork = await fetchFork();

  if (existingFork) {
    await syncFork(existingFork);
    forkedRepository.set(existingFork);

    return;
  }

  // Forking is turned off by default on a private repository, and can be turned off on a public
  // one. Say so rather than letting the fork request fail with nothing to act on
  if (!allowForking) {
    throw new Error('The repository does not allow forking', {
      cause: new Error(_('open_authoring.forking_disabled', { values: { repo: repoPath } })),
    });
  }

  if (!(await requestForkPermission(repoPath))) {
    throw new Error('Permission to fork the repository was declined', {
      cause: new Error(_('open_authoring.fork_declined')),
    });
  }

  forkedRepository.set(await createFork());
};
