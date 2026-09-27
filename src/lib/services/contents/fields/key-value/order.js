import {
  getKeyValueField,
  PAIR_KEY_PATH_REGEX,
} from '$lib/services/contents/fields/key-value/pairs';

/**
 * @import { EntryDraft, FlattenedEntryContent } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Group the key paths in the given value map by their parent key path, keeping the order they are
 * stored in. Top-level key paths have no parent, so they are left out.
 * @param {FlattenedEntryContent} valueMap Value map.
 * @param {(valueMap: FlattenedEntryContent, key: string) => boolean} isRealKey Function to check
 * whether a key holds content.
 * @returns {Map<FieldKeyPath, FieldKeyPath[]>} Key paths grouped by their parent key path.
 */
const groupKeyPathsByParent = (valueMap, isRealKey) => {
  /** @type {Map<FieldKeyPath, FieldKeyPath[]>} */
  const groups = new Map();

  Object.keys(valueMap).forEach((keyPath) => {
    if (!keyPath.includes('.') || !isRealKey(valueMap, keyPath)) {
      return;
    }

    const parentKeyPath = keyPath.replace(PAIR_KEY_PATH_REGEX, '');
    const group = groups.get(parentKeyPath);

    if (group) {
      group.push(keyPath);
    } else {
      groups.set(parentKeyPath, [keyPath]);
    }
  });

  return groups;
};

/**
 * Check whether the key-value pairs of any KeyValue field in the draft have been reordered. The
 * pairs are stored as the children of the field’s key path, so the order they are stored in is the
 * order they are saved in, but a value comparison can’t tell. This is only meaningful once the
 * values themselves are known to be the same, in which case every parent key path has the very same
 * children in both value maps and only their order can differ. The field lookup is skipped for the
 * groups whose order is unchanged, which is all of them unless something has been reordered.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {(valueMap: FlattenedEntryContent, key: string) => boolean} args.isRealKey Function to
 * check whether a key holds content that has to be compared.
 * @returns {boolean} Whether any pairs have been reordered.
 */
export const isPairOrderModified = ({ draft, isRealKey }) => {
  const { collectionName, fileName, isIndexFile, originalValues, currentValues } = draft;

  return Object.entries(currentValues).some(([locale, currentValueMap]) => {
    // The locales are known to be the same in both value stores by now
    const originalGroups = groupKeyPathsByParent(originalValues[locale], isRealKey);
    const currentGroups = groupKeyPathsByParent(currentValueMap, isRealKey);

    return [...currentGroups].some(([parentKeyPath, keyPaths]) => {
      const originalKeyPaths = /** @type {FieldKeyPath[]} */ (originalGroups.get(parentKeyPath));

      return (
        keyPaths.some((keyPath, index) => keyPath !== originalKeyPaths[index]) &&
        !!getKeyValueField({
          collectionName,
          fileName,
          isIndexFile,
          keyPath: keyPaths[0],
          valueMap: currentValueMap,
        })
      );
    });
  });
};
