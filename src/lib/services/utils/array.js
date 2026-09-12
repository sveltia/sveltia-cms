/**
 * Add an item to a list or remove it from the list, without mutating the list. Used to keep a
 * selection in sync with a checkbox: the item is added when it becomes selected, and removed when
 * it’s deselected. Nothing changes when the item is already in the requested state.
 * @template T
 * @param {T[]} list Original list.
 * @param {T} item Item to add or remove.
 * @param {boolean} include Whether the item should be in the list.
 * @param {(a: T, b: T) => boolean} [isEqual] Function to compare the items. Default: identity.
 * @returns {T[]} New list, or the original list if nothing has changed.
 */
export const toggleListItem = (list, item, include, isEqual = (a, b) => a === b) => {
  const included = list.some((i) => isEqual(i, item));

  if (include && !included) {
    return [...list, item];
  }

  if (!include && included) {
    return list.filter((i) => !isEqual(i, item));
  }

  return list;
};
