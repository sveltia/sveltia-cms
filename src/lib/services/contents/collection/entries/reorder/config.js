import { isObject } from '@sveltia/utils/object';

/**
 * The default field key used to store an entry’s display order when reordering is enabled and no
 * custom key is configured.
 * @type {string}
 */
export const DEFAULT_ORDER_FIELD_KEY = 'order';

/**
 * Get the field key used to persist an entry’s display order for the given collection.
 * @param {any} collection Collection (typically an entry collection). Anything else returns
 * `undefined`.
 * @returns {string | undefined} Field key, or `undefined` if reordering is not enabled.
 */
export const getOrderFieldKey = (collection) => {
  const reorder = collection?.reorder;

  if (!reorder) {
    return undefined;
  }

  if (isObject(reorder) && typeof reorder.key === 'string' && reorder.key) {
    return reorder.key;
  }

  return DEFAULT_ORDER_FIELD_KEY;
};

/**
 * Get the name of the view group that entries should be grouped by while the given collection is in
 * reorder mode, as configured with `reorder: { group: '…' }`. The group is named explicitly rather
 * than reusing whatever grouping the user has active, because the order field is renumbered group
 * by group: an arbitrary grouping would produce a different numbering every time and the values
 * would conflict.
 * @param {any} collection Collection (typically an entry collection). Anything else returns
 * `undefined`.
 * @returns {string | undefined} Group name, or `undefined` if reorder grouping is not configured.
 */
export const getReorderGroupName = (collection) => {
  const reorder = collection?.reorder;

  if (isObject(reorder) && typeof reorder.group === 'string' && reorder.group) {
    return reorder.group;
  }

  return undefined;
};
