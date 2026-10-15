import {
  createListItemClipboardData,
  parseListItemClipboardData,
} from '$lib/services/contents/fields/list/clipboard/data';

/**
 * @import { ListItemClipboardData } from '$lib/services/contents/fields/list/clipboard/data';
 */

/**
 * Item copied in this tab, along with the unsaved files it references, keyed by blob URL. Those are
 * pending uploads of the source draft, which can’t be put to the clipboard.
 * @type {{ data: ListItemClipboardData, files: Map<string, File> } | undefined}
 */
let lastCopied;

/**
 * Copy a list item to the clipboard. The item is also kept in this tab, so it can be pasted even if
 * the clipboard can’t be read, along with the unsaved files it references.
 * @param {Parameters<typeof createListItemClipboardData>[0]} args Arguments.
 * @returns {Promise<boolean>} Whether the item was written to the clipboard as well.
 */
export const copyListItem = async (args) => {
  lastCopied = createListItemClipboardData(args);

  try {
    await navigator.clipboard.writeText(JSON.stringify(lastCopied.data));

    return true;
  } catch {
    return false;
  }
};

/**
 * Get the list item to be pasted: the one in the clipboard, or the one last copied in this tab if
 * the clipboard can’t be read or holds something else.
 * @returns {Promise<{ data: ListItemClipboardData, files: Map<string, File> } | undefined>} Item
 * and the unsaved files it references, or `undefined` if there’s nothing to paste.
 */
export const readListItem = async () => {
  /** @type {ListItemClipboardData | undefined} */
  let data;

  try {
    data = parseListItemClipboardData(await navigator.clipboard.readText());
  } catch {
    // Clipboard access denied
  }

  // An item copied elsewhere is pasted unless it’s older than the one copied here, which the
  // clipboard doesn’t hold if it couldn’t be written
  if (
    data &&
    data.id !== lastCopied?.data.id &&
    !(lastCopied && (data.copiedAt ?? 0) < /** @type {number} */ (lastCopied.data.copiedAt))
  ) {
    return { data, files: new Map() };
  }

  return lastCopied;
};

/**
 * Reset the item last copied in this tab. For testing purposes.
 */
export const resetCopiedListItem = () => {
  lastCopied = undefined;
};
