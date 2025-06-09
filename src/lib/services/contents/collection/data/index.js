import { writable } from 'svelte/store';

/**
 * @import { Writable } from 'svelte/store';
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
  published: false,
  count: 1,
};

/**
 * @type {Writable<UpdateToastState>}
 */
export const contentUpdatesToast = writable({ ...UPDATE_TOAST_DEFAULT_STATE });
