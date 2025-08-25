import { writable } from 'svelte/store';

/**
 * @import { Writable } from 'svelte/store';
 * @import { EntryEditorPane, InternalLocaleCode, SelectAssetsView } from '$lib/types/private';
 */

/**
 * @typedef {object} CopyToastState
 * @property {number | undefined} id Unique identifier for the toast.
 * @property {boolean} show Whether the toast is currently visible.
 * @property {'info' | 'success' | 'error'} status Status of the toast.
 * @property {string | undefined} message Message to display in the toast.
 * @property {number} count Number of copies made.
 * @property {InternalLocaleCode | undefined} sourceLocale Source locale for the copy.
 */

/**
 * @type {Writable<boolean>}
 */
export const showContentOverlay = writable(false);

/**
 * @type {Writable<boolean>}
 */
export const showDuplicateToast = writable(false);

/**
 * @type {Writable<{ show: boolean, multiple: boolean, resolve?: Function }>}
 */
export const translatorApiKeyDialogState = writable({ show: false, multiple: false });

/**
 * Copy/translation toast state.
 * @type {Writable<CopyToastState>}
 */
export const copyFromLocaleToast = writable({
  id: undefined,
  show: false,
  status: 'success',
  message: undefined,
  count: 1,
  sourceLocale: undefined,
});

/**
 * @type {Writable<?EntryEditorPane>}
 */
export const editorLeftPane = writable(null);

/**
 * @type {Writable<?EntryEditorPane>}
 */
export const editorRightPane = writable(null);

/**
 * View settings for the Select Assets dialog.
 * @type {Writable<SelectAssetsView | undefined>}
 */
export const selectAssetsView = writable();

/**
 * Custom entry preview stylesheet URLs registered with the `CMS.registerPreviewStyle()` API.
 * @type {Set<string>}
 * @see https://decapcms.org/docs/customization/
 */
export const customPreviewStyleRegistry = new Set();
