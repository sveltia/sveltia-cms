import { createDeepState } from '$lib/services/utils/state.svelte';

/**
 * @import { UpdateToastState } from '$lib/types/private';
 */

/**
 * @type {UpdateToastState}
 */
export const UPDATE_TOAST_DEFAULT_STATE = {
  saved: false,
  moved: false,
  renamed: false,
  deleted: false,
  deletionPending: false,
  discarded: false,
  deletionCancelled: false,
  published: false,
  count: 1,
};

/**
 * State of the content updates toast notification.
 * @type {{ current: UpdateToastState }}
 */
export const contentUpdatesToast = createDeepState({ ...UPDATE_TOAST_DEFAULT_STATE });
