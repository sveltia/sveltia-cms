import { createDeepState, createRawState } from '$lib/services/utils/state.svelte';

/**
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
 * Whether the content details overlay is shown.
 */
export const showContentOverlay = createRawState(false);

/**
 * Whether to show the toast notification for a duplicated entry.
 */
export const showDuplicateToast = createRawState(false);

/**
 * Number of inline editors that are currently active in the entry editor, such as the file name
 * editor in a File/Image field. While any of them is active, the Escape key shortcut to close the
 * entry editor is disabled, so the key can be used to cancel the inline editing instead.
 */
export const activeInlineEditors = createRawState(0);

/**
 * @type {{ current: { show: boolean, multiple: boolean, resolve?: (value?: string) => void } }}
 */
export const translatorApiKeyDialogState = createDeepState({ show: false, multiple: false });

/**
 * Copy/translation toast state.
 * @type {{ current: CopyToastState }}
 */
export const copyFromLocaleToast = createDeepState({
  id: undefined,
  show: false,
  status: 'success',
  message: undefined,
  count: 1,
  sourceLanguage: undefined,
});

/**
 * @type {{ current: ?EntryEditorPane }}
 */
export const editorFirstPane = createRawState(null);

/**
 * @type {{ current: ?EntryEditorPane }}
 */
export const editorSecondPane = createRawState(null);

/**
 * View settings for the Select Assets dialog.
 * @type {{ current: SelectAssetsView | undefined }}
 */
export const selectAssetsView = createRawState();
