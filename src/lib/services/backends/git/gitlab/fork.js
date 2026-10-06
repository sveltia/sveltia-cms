import {
  fetchProjectPermissions,
  getProjectId,
  parseProjectPath,
  repository,
} from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import {
  createLocalizedError,
  NOT_COLLABORATOR_ERROR_MESSAGE,
} from '$lib/services/backends/git/shared/errors';
import {
  ensureForkPermission,
  pollForFork,
  resolveWorkflowRepository,
  runOpenAuthoringSetUp,
} from '$lib/services/backends/git/shared/fork';
import { cmsConfig } from '$lib/services/config';
import { user } from '$lib/services/user/account.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * @import { RepositoryPath } from '$lib/types/private';
 */

/**
 * Maximum number of forks to look at when searching for the signed-in user’s own copy of the
 * configured project. The list is already narrowed to the projects they own.
 */
const MAX_FORKS = 100;

/**
 * Numeric project ID of the configured project, which is filled in by
 * {@link fetchProjectDetails} — so it’s only set once the signed-in user turns out to be a
 * contributor, as a maintainer never reaches the code that needs it. A couple of GitLab
 * endpoints — opening a merge request across projects, and comparing a fork’s branch with the
 * configured one — take an ID rather than the encoded path every other request uses. `fork` is the
 * contributor’s fork, recorded while it’s looked up, so a merge request can be checked to have come
 * from it rather than from some other project of theirs.
 * @type {{ base: number | undefined, fork: number | undefined }}
 */
export const projectIds = { base: undefined, fork: undefined };

/**
 * Check whether Open Authoring is turned on in the site configuration. It doesn’t mean the
 * signed-in user is actually contributing through a fork: a user who can write to the configured
 * project keeps working on it directly. Use the `openAuthoring` store for that.
 * @returns {boolean} `true` if the `open_authoring` backend option is enabled.
 */
export const isOpenAuthoringConfigured = () => {
  const { backend } = cmsConfig.current ?? {};

  return backend?.name === 'gitlab' && backend.open_authoring === true;
};

/**
 * Get the project that receives the CMS’s commits: the signed-in user’s fork when the current
 * session is an Open Authoring one, and the configured project otherwise. Content is always read
 * from the configured project, so this is only for writes and for the branches behind them.
 * @returns {RepositoryPath} Project namespace and name.
 */
export const getWorkflowRepository = () => resolveWorkflowRepository(repository);

/**
 * Fetch whether the signed-in user can commit to the configured project. The permission query
 * answers both of the questions the sign-in has: a project it can’t see at all is a dead end, while
 * one the user can read but not push to is what Open Authoring is for.
 * @returns {Promise<{ canWrite: boolean }>} Project access.
 * @throws {Error} When the user has no access to the project, or the answer couldn’t be
 * determined — which is not the same thing.
 */
export const fetchRepositoryAccess = async () => {
  const { owner, repo } = repository;
  const repoPath = `${owner}/${repo}`;
  /** @type {{ found: boolean, canPush: boolean }} */
  let permissions;

  try {
    permissions = await fetchProjectPermissions();
  } catch {
    // A spent rate limit or an outage leaves the question unanswered. Reading that as “no write
    // access” would send a maintainer down the fork path over something passing, and offer to make
    // a copy of a project they can already write to, so make the failure visible instead
    throw createLocalizedError(
      'Failed to check the repository permission.',
      'open_authoring.permission_check_failed',
      { repo: repoPath },
    );
  }

  // Open Authoring still needs the contributor to be able to read the project, so being unable to
  // see it is a dead end rather than a reason to fall back to a fork. The shared message is what
  // the sign-in flow looks for to drop the cached credentials, the same as the regular access check
  // does, so the user gets the sign-in form rather than the same error on every reload
  if (!permissions.found) {
    throw createLocalizedError(NOT_COLLABORATOR_ERROR_MESSAGE, 'repository_no_access', {
      repo: repoPath,
    });
  }

  return { canWrite: permissions.canPush };
};

/**
 * Fetch what setting a fork up needs from the configured project: its numeric ID, which a couple of
 * endpoints take instead of the encoded path, and whether it can be forked at all. Only a
 * contributor gets this far, so a maintainer’s sign-in doesn’t pay for the request.
 * @returns {Promise<{ allowForking: boolean }>} Whether the project allows forks.
 * @see https://docs.gitlab.com/api/projects/#get-a-single-project
 */
export const fetchProjectDetails = async () => {
  const { owner, repo } = repository;
  /** @type {Record<string, any>} */
  let project;

  try {
    project = /** @type {Record<string, any>} */ (await fetchAPI(`/projects/${getProjectId()}`));
  } catch {
    // Nothing can be set up without the project’s ID, and a spent rate limit or an outage is worth
    // trying again, so say so rather than letting a bare API error reach the contributor
    throw createLocalizedError(
      'Failed to read the repository.',
      'open_authoring.permission_check_failed',
      { repo: `${owner}/${repo}` },
    );
  }

  const { id, forking_access_level: forkingAccessLevel } = project;

  projectIds.base = id;

  // The feature is reported as `enabled`, `private` or `disabled`. An older instance may not report
  // it at all, in which case the fork request is left to say whether it’s allowed
  return { allowForking: forkingAccessLevel !== 'disabled' };
};

/**
 * Look for the fork at the path GitLab gives it by default, which is the parent’s project name
 * under the contributor’s own namespace. This is where it is unless they renamed or moved it. A
 * project that happens to share the name but isn’t a fork of the configured one is ignored.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if it isn’t there.
 * @see https://docs.gitlab.com/api/projects/#get-a-single-project
 */
export const fetchForkByName = async () => {
  const { owner, repo } = repository;
  const userName = /** @type {string} */ (user.account?.login);
  /** @type {Record<string, any>} */
  let result;

  try {
    result = /** @type {Record<string, any>} */ (
      await fetchAPI(`/projects/${getProjectId({ owner: userName, repo })}`)
    );
  } catch {
    // The contributor has no project of that name, which is the common case on a first visit
    return undefined;
  }

  const parent = result.forked_from_project?.path_with_namespace?.toLowerCase();

  if (parent !== `${owner}/${repo}`.toLowerCase()) {
    return undefined;
  }

  // GitLab keeps a redirect for a project that was renamed or transferred, so the path it resolved
  // can sit in a namespace other than the one asked for. Everything the CMS writes goes to this
  // project, so take it only once it’s confirmed to be the signed-in user’s own
  if (result.namespace?.kind !== 'user' || result.namespace?.full_path !== userName) {
    return undefined;
  }

  projectIds.fork = result.id;

  return parseProjectPath(result.path_with_namespace);
};

/**
 * Ask the configured project for the fork the signed-in user owns, wherever it’s named. This only
 * runs when {@link fetchForkByName} came up empty, so its worst case is the behavior without it: no
 * fork found, and the contributor asked whether to make one.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if there is none.
 * @see https://docs.gitlab.com/api/project_forks/#list-forks-of-a-project
 */
export const fetchForkFromNetwork = async () => {
  const userName = user.account?.login;

  try {
    const forks = /** @type {Record<string, any>[]} */ (
      await fetchAPI(`/projects/${getProjectId()}/forks?owned=true&per_page=${MAX_FORKS}`)
    );

    // Check the namespace rather than trusting the filter to have applied: committing to a fork in
    // a group the contributor merely belongs to would put their drafts somewhere unexpected
    const fork = forks.find(
      ({ namespace }) => namespace?.kind === 'user' && namespace?.full_path === userName,
    );

    if (!fork) {
      return undefined;
    }

    projectIds.fork = fork.id;

    return parseProjectPath(fork.path_with_namespace);
  } catch {
    return undefined;
  }
};

/**
 * Look for an existing fork of the configured project on the signed-in user’s namespace.
 * @returns {Promise<RepositoryPath | undefined>} The fork, or `undefined` if there is none.
 */
export const fetchFork = async () => (await fetchForkByName()) ?? fetchForkFromNetwork();

/**
 * Import states that mean the fork is ready to be committed to. `none` is what a project that was
 * never imported reports, which is what an older GitLab says about a finished fork.
 */
const FORK_READY_STATUSES = ['none', 'finished'];

/**
 * Wait until a newly requested fork can be committed to. GitLab copies the repository in the
 * background and the request returns before the copy is complete, so committing to it right away
 * could fail.
 * @param {RepositoryPath} fork Fork to wait for.
 * @param {number} [attemptsLeft] Number of attempts remaining, used for the recursive retry.
 * @throws {Error} When the fork hasn’t become available within the allotted time, or the import
 * failed outright.
 * @see https://docs.gitlab.com/api/project_import_export/#import-status
 */
export const waitForFork = async (fork, attemptsLeft) => {
  await pollForFork({
    repoPath: `${fork.owner}/${fork.repo}`,
    attemptsLeft,
    /**
     * Ask GitLab how far the copy has got.
     * @returns {Promise<'ready' | 'pending' | 'failed'>} Import status, normalized.
     */
    checkFork: async () => {
      /** @type {string | undefined} */
      let importStatus;

      try {
        ({ import_status: importStatus } = /** @type {Record<string, any>} */ (
          await fetchAPI(`/projects/${getProjectId(fork)}`)
        ));
      } catch {
        // The fork isn’t readable yet, which is what the polling is for
        return 'pending';
      }

      if (importStatus === undefined || FORK_READY_STATUSES.includes(importStatus)) {
        return 'ready';
      }

      return importStatus === 'failed' ? 'failed' : 'pending';
    },
  });
};

/**
 * Fork the configured project onto the signed-in user’s namespace.
 * @returns {Promise<RepositoryPath>} The new fork.
 * @throws {Error} When the fork could not be created.
 * @see https://docs.gitlab.com/api/project_forks/#fork-a-project
 */
export const createFork = async () => {
  const { owner, repo } = repository;
  /** @type {Record<string, any>} */
  let result;

  try {
    result = /** @type {Record<string, any>} */ (
      await fetchAPI(`/projects/${getProjectId()}/fork`, { method: 'POST' })
    );
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to fork the repository.', ex);

    throw createLocalizedError('Failed to fork the repository.', 'open_authoring.fork_failed', {
      repo: `${owner}/${repo}`,
    });
  }

  const fork = parseProjectPath(result.path_with_namespace);

  projectIds.fork = result.id;

  await waitForFork(fork);

  return fork;
};

/**
 * Work out how the signed-in user is going to write to the project, and set up a fork for them if
 * they can’t write to the configured one. This replaces the plain access check performed when Open
 * Authoring is turned off, because a contributor without write access is expected here rather than
 * turned away.
 *
 * Unlike GitHub, GitLab has no API to bring a fork up to date with its parent, so nothing is done
 * about one that has drifted. It doesn’t affect what a contributor submits: a workflow branch is
 * created from the configured project’s branch rather than from the fork’s copy of it, so the merge
 * request only contains the entry being edited either way.
 * @throws {Error} When the fork could not be set up.
 * @see https://sveltiacms.app/en/docs/workflows/open
 */
const setUpOpenAuthoring = async () => {
  const { canWrite } = await fetchRepositoryAccess();

  // A maintainer keeps working on the configured project, as if Open Authoring was off
  if (canWrite) {
    return;
  }

  const { owner, repo } = repository;
  const [{ allowForking }, existingFork] = await Promise.all([fetchProjectDetails(), fetchFork()]);

  if (existingFork) {
    forkedRepository.current = existingFork;

    return;
  }

  await ensureForkPermission({ repoPath: `${owner}/${repo}`, allowForking });

  forkedRepository.current = await createFork();
};

/**
 * Set up Open Authoring for the signed-in user: see {@link setUpOpenAuthoring}.
 * @throws {Error} When the fork could not be set up.
 */
export const initOpenAuthoring = async () => {
  // The IDs belong to the user being signed out, so don’t let a stale fork ID vouch for the next
  // user’s merge requests
  projectIds.base = undefined;
  projectIds.fork = undefined;

  await runOpenAuthoringSetUp(setUpOpenAuthoring);
};
