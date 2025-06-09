import { writable } from 'svelte/store';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';

/**
 * @import { Writable } from 'svelte/store';
 * @import { UpdateToastState } from '$lib/types/private';
 */

/**
 * @type {Writable<UpdateToastState>}
 */
export const assetUpdatesToast = writable({ ...UPDATE_TOAST_DEFAULT_STATE });
