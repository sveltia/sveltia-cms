import { derived, get, writable } from 'svelte/store';

import { OPEN_AUTHORING_STAGES, WORKFLOW_STAGES } from '$lib/services/workflow/constants';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { ForkPermissionRequest, RepositoryPath, WorkflowStatus } from '$lib/types/private';
 */

/**
 * The signed-in user’s fork of the configured repository, which holds the branches their changes
 * are committed to. It’s `undefined` unless the current session is an Open Authoring one.
 * @type {Writable<RepositoryPath | undefined>}
 */
export const forkedRepository = writable();

/**
 * Whether the signed-in user is contributing through a forked repository. Such a user can’t write
 * to the configured repository, so every change goes to their fork and reaches the site through a
 * pull request that a maintainer merges.
 * @type {Readable<boolean>}
 */
export const openAuthoring = derived([forkedRepository], ([fork]) => !!fork);

/**
 * The review stages an unpublished entry can move through, which are the board columns and the
 * options in the editor’s status menu. An Open Authoring contributor can’t merge a pull request, so
 * the stage that says an entry is ready to be published is left out.
 * @type {Readable<WorkflowStatus[]>}
 */
export const workflowStages = derived([openAuthoring], ([_openAuthoring]) =>
  _openAuthoring ? OPEN_AUTHORING_STAGES : WORKFLOW_STAGES,
);

/**
 * The pending request for permission to fork the configured repository, which the UI turns into a
 * confirmation dialog. It’s `undefined` while no request is outstanding.
 * @type {Writable<ForkPermissionRequest | undefined>}
 */
export const forkPermissionRequest = writable();

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
  get(forkPermissionRequest)?.respond(false);

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
        if (get(forkPermissionRequest) === request) {
          forkPermissionRequest.set(undefined);
        }

        resolve(granted);
      },
    };

    forkPermissionRequest.set(request);
  });
};
