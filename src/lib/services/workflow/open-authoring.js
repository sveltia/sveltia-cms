import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';
import { OPEN_AUTHORING_STAGES, WORKFLOW_STAGES } from '$lib/services/workflow/constants';

/**
 * @import {
 * ForkPermissionRequest,
 * RepositoryInfo,
 * RepositoryPath,
 * WorkflowStatus,
 * } from '$lib/types/private';
 */

/**
 * The signed-in user’s fork of the configured repository, which holds the branches their changes
 * are committed to. It’s `undefined` unless the current session is an Open Authoring one.
 * @type {{ current: RepositoryPath | undefined }}
 */
export const forkedRepository = createRawState();

/**
 * Whether the signed-in user is contributing through a forked repository. Such a user can’t write
 * to the configured repository, so every change goes to their fork and reaches the site through a
 * pull request that a maintainer merges.
 */
export const openAuthoring = createDerivedState(() => !!forkedRepository.current);

/**
 * Whether the Open Authoring set-up has completed for the current session, so that it’s known
 * whether the user works on a fork or, having write access, on the configured repository itself.
 * Anything that depends on that — such as where to look for the user’s pull requests — has to wait
 * for this rather than for a fork, which a maintainer never gets.
 * @type {{ current: boolean }}
 */
export const openAuthoringInitialized = createRawState(false);

/**
 * The review stages an unpublished entry can move through, which are the board columns and the
 * options in the editor’s status menu. An Open Authoring contributor can’t merge a pull request, so
 * the stage that says an entry is ready to be published is left out.
 * @type {{ readonly current: WorkflowStatus[] }}
 */
export const workflowStages = createDerivedState(() =>
  openAuthoring.current ? OPEN_AUTHORING_STAGES : WORKFLOW_STAGES,
);

/**
 * Message of the error thrown when an Open Authoring contributor moves an entry whose request a
 * maintainer has merged since the board was loaded, with nothing committed to its branch since: the
 * entry is published, and there’s nothing left to review.
 */
export const ENTRY_ALREADY_PUBLISHED = 'entry_already_published';

/**
 * Check whether the given error says that an entry turned out to have been published when its
 * status was changed.
 * @param {any} ex Error thrown by the status change.
 * @returns {boolean} Result.
 */
export const isEntryAlreadyPublished = (ex) => ex?.message === ENTRY_ALREADY_PUBLISHED;

/**
 * Get the path of the signed-in user’s fork, e.g. `contributor/site`, which is what the UI names
 * when it says where their changes are saved.
 * @param {RepositoryPath | undefined} fork Fork, from {@link forkedRepository}.
 * @returns {string} Path, or an empty string when the session isn’t an Open Authoring one.
 */
export const getForkPath = (fork) => (fork ? `${fork.owner}/${fork.repo}` : '');

/**
 * Get the URL of the signed-in user’s fork on the backend service, which can be a GitHub Enterprise
 * Server or self-hosted GitLab instance rather than github.com or gitlab.com. The configured
 * repository’s URL ends with its path, which the fork’s path takes the place of. Resolving the fork
 * against the origin instead would drop a path prefix the instance itself sits under — what GitLab
 * calls a relative URL root — and a GitLab fork lands directly under the contributor’s namespace,
 * so the configured path can’t be swapped segment by segment either.
 * @param {RepositoryInfo | undefined} repository Configured repository.
 * @param {RepositoryPath | undefined} fork Fork, from {@link forkedRepository}.
 * @returns {string} URL, or an empty string while the repository isn’t known yet, or when the
 * session isn’t an Open Authoring one.
 */
export const getForkURL = (repository, fork) => {
  const { repoURL, owner, repo } = repository ?? {};

  if (!fork || !repoURL) {
    return '';
  }

  return repoURL.slice(0, -`${owner}/${repo}`.length) + getForkPath(fork);
};

/**
 * The pending request for permission to fork the configured repository, which the UI turns into a
 * confirmation dialog. It’s `undefined` while no request is outstanding.
 * @type {{ current: ForkPermissionRequest | undefined }}
 */
export const forkPermissionRequest = createRawState();

/**
 * Ask the user for permission to create a fork of the configured repository, and wait for the
 * answer. Creating a repository on someone’s account is not something to do behind their back, so
 * the sign-in stops here until they decide.
 * @param {string} repo Repository path to be forked, e.g. `owner/repo`.
 * @returns {Promise<boolean>} `true` if the user granted permission.
 */
export const requestForkPermission = async (repo) => {
  // A second request can’t be outstanding, because the sign-in flow awaits the first one, but be
  // defensive: leaving an earlier request unresolved would hang that flow forever
  forkPermissionRequest.current?.respond(false);

  return new Promise((resolve) => {
    /** @type {ForkPermissionRequest} */
    const request = {
      repo,
      /**
       * Answer the request.
       * @param {boolean} granted Whether the user granted permission.
       */
      respond: (granted) => {
        // Only take down the dialog that belongs to this request, so answering a stale one can’t
        // dismiss a newer one. Resolving an already settled promise does nothing
        if (forkPermissionRequest.current === request) {
          forkPermissionRequest.current = undefined;
        }

        resolve(granted);
      },
    };

    forkPermissionRequest.current = request;
  });
};
