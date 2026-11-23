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

/**
 * Split the given list into chunks of the given size.
 * @template T
 * @param {T[]} items Items to split.
 * @param {number} size Maximum number of items per chunk.
 * @returns {T[][]} Chunks, in the original order.
 */
export const splitIntoChunks = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

/**
 * Split the given list into chunks that each stay within the given number of items and the given
 * total size, keeping the original order. A chunk is closed before the item that would push it over
 * either limit, but never left empty, so an item that exceeds the size limit on its own gets a
 * chunk of its own.
 * @template T
 * @param {T[]} items Items to split.
 * @param {object} limits Limits.
 * @param {number} limits.maxItems Maximum number of items per chunk.
 * @param {number} limits.maxSize Maximum total size of the items per chunk.
 * @param {(item: T) => number} limits.getSize Function to get the size of an item.
 * @returns {T[][]} Chunks, in the original order.
 */
export const splitIntoSizedChunks = (items, { maxItems, maxSize, getSize }) => {
  /** @type {T[][]} */
  const chunks = [];
  /** @type {T[]} */
  let chunk = [];
  let chunkSize = 0;

  items.forEach((item) => {
    const size = getSize(item);

    if (chunk.length && (chunk.length === maxItems || chunkSize + size > maxSize)) {
      chunks.push(chunk);
      chunk = [];
      chunkSize = 0;
    }

    chunk.push(item);
    chunkSize += size;
  });

  if (chunk.length) {
    chunks.push(chunk);
  }

  return chunks;
};
