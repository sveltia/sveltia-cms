/**
 * @import { RemovedListItem } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Add a removed item to the list of removed items, which are shown in place of the items until
 * they’re restored. The removed items at a later position move up by one along with the items
 * after the removed one, while the new entry goes after the removed items already shown in the same
 * place, as they were before the removed item.
 * @param {RemovedListItem[]} removedItems Removed items, in the order they’re shown.
 * @param {RemovedListItem} removedItem Item just removed, whose `index` is the position it was
 * removed from.
 * @returns {RemovedListItem[]} New list of removed items.
 */
export const addRemovedItem = (removedItems, removedItem) => {
  const { index } = removedItem;
  const position = removedItems.findIndex((item) => item.index > index);

  const shifted = removedItems.map((item) =>
    item.index > index ? { ...item, index: item.index - 1 } : item,
  );

  if (position === -1) {
    return [...shifted, removedItem];
  }

  return [...shifted.slice(0, position), removedItem, ...shifted.slice(position)];
};

/**
 * Update the positions of the removed items once a new item has been added to the list. The removed
 * items after the new one move down by one, while those shown right where it was added stay before
 * it.
 * @param {RemovedListItem[]} removedItems Removed items, in the order they’re shown.
 * @param {number} index Position the new item was added to.
 * @returns {RemovedListItem[]} New list of removed items.
 */
export const shiftRemovedItems = (removedItems, index) =>
  removedItems.map((item) => (item.index > index ? { ...item, index: item.index + 1 } : item));

/**
 * Remove a restored item from the list of removed items. The removed items shown after it move down
 * by one, as the restored item is put back before them.
 * @param {RemovedListItem[]} removedItems Removed items, in the order they’re shown.
 * @param {string} id ID of the restored item.
 * @returns {RemovedListItem[]} New list of removed items.
 */
export const dropRestoredItem = (removedItems, id) => {
  const position = removedItems.findIndex((item) => item.id === id);

  return removedItems
    .filter((_item, i) => i !== position)
    .map((item, i) =>
      position !== -1 && i >= position ? { ...item, index: item.index + 1 } : item,
    );
};

/**
 * Get the expander states of the objects and lists nested in a list item, so they can be put back
 * once the item is restored. The item’s own state is restored along with its value.
 * @param {Record<string, boolean>} states Flattened expander states.
 * @param {FieldKeyPath} keyPath Key path of the List field.
 * @param {number} index Item index.
 * @returns {[suffix: string, state: boolean][]} Key path suffixes after the item’s own key path,
 * e.g. `.details#` or `.books.0`, and states.
 */
export const getNestedExpanderStates = (states, keyPath, index) => {
  const prefix = `${keyPath}.${index}`;

  return Object.entries(states)
    .filter(([key]) => key.startsWith(prefix) && /^[.#]/.test(key.slice(prefix.length)))
    .map(([key, state]) => [key.slice(prefix.length), state]);
};
