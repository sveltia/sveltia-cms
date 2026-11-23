import { _ } from '@sveltia/i18n';

import { listItemClipboardToast } from '$lib/services/contents/editor';

/**
 * @typedef {typeof listItemClipboardToast.current.status} ListItemClipboardToastStatus
 */

/**
 * Show a notification once a List field item is copied or pasted.
 * @param {ListItemClipboardToastStatus} status Status.
 * @param {string} message Message.
 */
export const showListItemClipboardToast = (status, message) => {
  listItemClipboardToast.current = {
    id: listItemClipboardToast.current.id + 1,
    show: true,
    status,
    message,
  };
};

/**
 * Get the notification to show after a List field item has been pasted. Files missing from the
 * entry take precedence over values left out, as they are the bigger loss.
 * @param {object} result Result of preparing the paste.
 * @param {number} result.droppedCount Number of values that didn’t fit the list and were left out.
 * @param {number} result.missingFileCount Number of referenced files that could not be copied.
 * @returns {{ status: ListItemClipboardToastStatus, message: string } | undefined} Notification, or
 * `undefined` if the item was pasted as it was copied.
 */
export const getPastedItemToast = ({ droppedCount, missingFileCount }) => {
  if (missingFileCount) {
    return {
      status: 'warning',
      message: _('list_item_pasted_without_files', { values: { count: missingFileCount } }),
    };
  }

  if (droppedCount) {
    return {
      status: 'info',
      message: _('list_item_pasted_without_values', { values: { count: droppedCount } }),
    };
  }

  return undefined;
};
