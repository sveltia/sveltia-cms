import { isNumeric } from '$lib/services/utils/number';

/**
 * @import { ContentIndex, FlattenedEntryContent, ListItemIndex } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Our internal representation of an entry is a flat map from key path to value, so a caller
 * walking the field configuration has to ask the content what shape it holds: whether a key path
 * holds anything at all, and which list items exist under it. A plain scan would be O(keys) per
 * field, and such a walk visits every configured field, so the content is indexed once up front.
 *
 * Two shapes are offered because the full index isn’t cheap: it records every parent/child pair,
 * and building it for a large entry takes a couple of milliseconds. A caller that only needs the
 * list question — the common case on a hot path — gets {@link indexListItems}, which skips the
 * rest.
 */

/**
 * Index the given content so that both {@link hasChildKeys} and {@link getItemIndexes} answer in
 * constant time.
 * @param {FlattenedEntryContent} content Flattened entry content.
 * @returns {ContentIndex} Index of the content.
 */
export const indexContent = (content) => {
  /** @type {Map<FieldKeyPath, Set<string>>} */
  const childSegmentMap = new Map();

  Object.keys(content).forEach((key) => {
    const segments = key.split('.');
    let path = '';

    segments.forEach((segment, index) => {
      if (index > 0) {
        const siblings = childSegmentMap.get(path);

        if (siblings) {
          siblings.add(segment);
        } else {
          childSegmentMap.set(path, new Set([segment]));
        }
      }

      path = index === 0 ? segment : `${path}.${segment}`;
    });
  });

  return { childSegmentMap };
};

/**
 * Check whether the given key path has any child key paths in the indexed content.
 * @param {ContentIndex} index Index of the content.
 * @param {FieldKeyPath} keyPath Key path.
 * @returns {boolean} Result.
 */
export const hasChildKeys = (index, keyPath) => index.childSegmentMap.has(keyPath);

/**
 * Get the indexes of the list items stored under the given key path, in ascending order.
 * @param {ContentIndex} index Index of the content.
 * @param {FieldKeyPath} keyPath Key path of the list field.
 * @returns {number[]} Item indexes.
 */
export const getItemIndexes = (index, keyPath) =>
  [...(index.childSegmentMap.get(keyPath) ?? [])]
    .filter(isNumeric)
    .map(Number)
    .sort((a, b) => a - b);

/**
 * Index only the list items in the given content, which is around twice as fast as
 * {@link indexContent}: the key paths are scanned in place rather than split, and only the numeric
 * segments are recorded.
 * @param {FlattenedEntryContent} content Flattened entry content.
 * @returns {ListItemIndex} Index of the list items, keyed by the key path holding them.
 */
export const indexListItems = (content) => {
  /** @type {ListItemIndex} */
  const itemMap = new Map();

  Object.keys(content).forEach((key) => {
    let start = 0;

    for (;;) {
      const dotIndex = key.indexOf('.', start);

      if (dotIndex === -1) {
        return;
      }

      const nextDotIndex = key.indexOf('.', dotIndex + 1);
      const end = nextDotIndex === -1 ? key.length : nextDotIndex;
      const segment = key.slice(dotIndex + 1, end);

      if (isNumeric(segment)) {
        const keyPath = key.slice(0, dotIndex);
        const indexes = itemMap.get(keyPath);

        if (indexes) {
          indexes.add(Number(segment));
        } else {
          itemMap.set(keyPath, new Set([Number(segment)]));
        }
      }

      start = dotIndex + 1;
    }
  });

  return itemMap;
};

/**
 * Get the indexes of the list items stored under the given key path, in ascending order.
 * @param {ListItemIndex} index Index of the list items.
 * @param {FieldKeyPath} keyPath Key path of the list field.
 * @returns {number[]} Item indexes.
 */
export const getListItemIndexes = (index, keyPath) =>
  [...(index.get(keyPath) ?? [])].sort((a, b) => a - b);
