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
 * @property {InternalLocaleCode | undefined} sourceLanguage Source locale for the copy.
 */

/**
 * Minimum width for entry editor panes in percentage. This ensures that panes remain usable and
 * prevents them from being resized to an unusable width.
 * @constant {number}
 */
export const MIN_PANE_SIZE = 30;

/**
 * @type {Writable<boolean>}
 */
export const showContentOverlay = writable(false);

/**
 * @type {Writable<boolean>}
 */
export const showDuplicateToast = writable(false);

/**
 * @type {Writable<{ show: boolean, multiple: boolean, resolve?: (value?: string) => void }>}
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
  sourceLanguage: undefined,
});

/**
 * @type {Writable<?EntryEditorPane>}
 */
export const editorFirstPane = writable(null);

/**
 * @type {Writable<?EntryEditorPane>}
 */
export const editorSecondPane = writable(null);

/**
 * View settings for the Select Assets dialog.
 * @type {Writable<SelectAssetsView | undefined>}
 */
export const selectAssetsView = writable();
