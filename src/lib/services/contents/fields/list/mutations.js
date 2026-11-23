import { tagListItems } from '$lib/services/contents/fields/list/helpers';

/**
 * @import { ExpanderStateList } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Items of a List field in one locale, along with their expander states, as handed to a list
 * update. Both lists are mutated in place. The expander states are only kept with the default
 * locale, so the list may be empty in the others.
 * @typedef {object} ListMutationTarget
 * @property {any[]} valueList List items.
 * @property {ExpanderStateList} expanderStateList Expander states of the items.
 */

/**
 * Insert an item into the list, or replace the item at the index with it. The new item is expanded.
 * @param {ListMutationTarget} target List items and their expander states.
 * @param {object} args Arguments.
 * @param {number} args.index List index where the item goes.
 * @param {any} args.item New item.
 * @param {boolean} [args.replace] Whether to replace the item at the index.
 */
export const insertListItem = (
  { valueList, expanderStateList },
  { index, item, replace = false },
) => {
  valueList.splice(index, replace ? 1 : 0, item);
  expanderStateList.splice(index, replace ? 1 : 0, true);
};

/**
 * Remove the item at the given index from the list.
 * @param {ListMutationTarget} target List items and their expander states.
 * @param {object} args Arguments.
 * @param {number} args.index List index of the item.
 * @param {FieldKeyPath} args.keyPath Key path of the List field.
 * @param {boolean} args.tagItems Whether the items are objects to tag with their original key path
 * and an ID before they shift, to revert the change and tell whether they’re replaced later. A
 * list with a single subfield holds primitive values, which can’t be tagged.
 * @returns {any} Removed item, or `undefined` if there was none at the index.
 */
export const removeListItem = ({ valueList, expanderStateList }, { index, keyPath, tagItems }) => {
  if (tagItems) {
    tagListItems(valueList, keyPath, { assignIds: true });
  }

  const [value] = valueList.splice(index, 1);

  expanderStateList.splice(index, 1);

  return value;
};

/**
 * Put a removed item back at the given index.
 * @param {ListMutationTarget} target List items and their expander states.
 * @param {object} args Arguments.
 * @param {number} args.index List index where the item goes.
 * @param {any} args.item Removed item.
 * @param {boolean} args.expanded Whether the item was expanded.
 * @param {FieldKeyPath} args.keyPath Key path of the List field.
 * @param {boolean} args.tagItems Whether the items are objects to tag with their original key path
 * before they shift.
 */
export const restoreListItem = (
  { valueList, expanderStateList },
  { index, item, expanded, keyPath, tagItems },
) => {
  if (tagItems) {
    tagListItems(valueList, keyPath);
  }

  valueList.splice(index, 0, item);
  expanderStateList.splice(index, 0, expanded);
};

/**
 * Move an item to another position in the list.
 * @param {ListMutationTarget} target List items and their expander states.
 * @param {object} args Arguments.
 * @param {number} args.from Source index.
 * @param {number} args.to Destination index.
 * @param {FieldKeyPath} args.keyPath Key path of the List field.
 * @param {boolean} args.tagItems Whether the items are objects to tag with their original key path
 * and a unique ID before they’re reordered, so a keyed `each` block keeps following each item
 * rather than its position, and the change can be reverted.
 */
export const moveListItem = ({ valueList, expanderStateList }, { from, to, keyPath, tagItems }) => {
  if (tagItems) {
    tagListItems(valueList, keyPath, { assignIds: true });
  }

  valueList.splice(to, 0, ...valueList.splice(from, 1));
  expanderStateList.splice(to, 0, ...expanderStateList.splice(from, 1));
};
