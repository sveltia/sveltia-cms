import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { validateAnyField } from '$lib/services/contents/draft/validate/fields';
import { getFieldValidationMessages } from '$lib/services/contents/draft/validate/messages';
import {
  buildEntryUpdateChanges,
  createSyntheticDraft,
  resolveCacheDB,
} from '$lib/services/contents/entry/changes';
import { getListItemKeys } from '$lib/services/contents/entry/key-paths';
import { getEntrySummary } from '$lib/services/contents/entry/summary';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import {
 * CascadeDeleteBlocker,
 * CascadeTarget,
 * Entry,
 * FileChange,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Matches the index suffix of a multi-value field’s item key path, e.g. `.1` in `tags.1`.
 */
export const ITEM_INDEX_SUFFIX_REGEX = /\.\d+$/;

/**
 * Remove some items from a multi-value field, which stores each of its values under its own index,
 * and renumber the rest, so that the remaining items are stored under consecutive indexes again.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Flattened entry content, modified in place.
 * @param {FieldKeyPath} args.listKeyPath Key path of the multi-value field.
 * @param {(key: FieldKeyPath, value: any) => boolean} args.isStale Whether the item stored under
 * the given key path is to be removed.
 */
export const compactList = ({ content, listKeyPath, isStale }) => {
  // The content is being rewritten, so its keys are scanned rather than read from an index
  const itemKeys = getListItemKeys(content, listKeyPath, { live: true });

  const remainingValues = itemKeys
    .filter((key) => !isStale(key, content[key]))
    .map((key) => content[key]);

  itemKeys.forEach((key) => {
    delete content[key];
  });

  if (remainingValues.length) {
    remainingValues.forEach((value, index) => {
      content[`${listKeyPath}.${index}`] = value;
    });
  } else {
    // This is how an emptied multi-value field is stored in a draft
    content[listKeyPath] = [];
  }
};

/**
 * Check the fields that lost a reference against their own validation rules, such as `required`
 * and `min`, the way a save of the entry would, and describe each one that no longer passes.
 * @param {object} args Arguments.
 * @param {any} args.draft Synthetic draft for the entry holding the fields, from
 * {@link createSyntheticDraft}.
 * @param {Entry} args.entry Entry holding the fields, as stored.
 * @param {InternalCollection} args.collection Collection the entry is edited under.
 * @param {InternalLocaleCode} args.locale Locale of the updated content.
 * @param {FlattenedEntryContent} args.content Updated content.
 * @param {Map<FieldKeyPath, Field>} args.fields Fields to check, keyed by key path — the field
 * itself rather than an item within it, which is what the validator looks at.
 * @returns {CascadeDeleteBlocker[]} Blockers, one per invalid field.
 */
export const getFieldBlockers = ({ draft, entry, collection, locale, content, fields }) =>
  [...fields].flatMap(([keyPath, fieldConfig]) => {
    const validity = validateAnyField({
      draft,
      locale,
      keyPath,
      value: content[keyPath],
      valueMap: content,
      // A fresh map, so the field is validated rather than skipped as already validated
      validities: { [locale]: {} },
    });

    // The validator declines a field it doesn’t validate in this locale, e.g. a non-i18n field in
    // a non-default locale, in which case the field is fine by definition
    if (!validity || validity.valid) {
      return [];
    }

    const collectionName = collection.name;

    return [
      /** @type {CascadeDeleteBlocker} */ ({
        collectionName,
        collectionLabel: collection.label || collectionName,
        fieldLabel: fieldConfig.label || fieldConfig.name,
        entry,
        summary: getEntrySummary(collection, entry),
        locale,
        keyPath,
        messages: getFieldValidationMessages({ validity, fieldConfig }),
      }),
    ];
  });

/**
 * Report a field invalid in more than one locale once: the message is the same, and the editor
 * shows the errors locale by locale once the entry is opened.
 * @param {CascadeDeleteBlocker[]} blockers Blockers.
 * @returns {CascadeDeleteBlocker[]} Blockers, without the duplicates.
 */
export const dedupeBlockers = (blockers) => {
  /** @type {Set<string>} */
  const seen = new Set();

  return blockers.filter(({ entry, keyPath }) => {
    const key = `${entry.id}\0${keyPath}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
};

/**
 * Build the `update` file changes that write the given cascade targets back, one per file the
 * entry occupies.
 * @param {object} args Arguments.
 * @param {CascadeTarget[]} args.targets Cascade targets.
 * @param {IndexedDB} [args.cacheDB] Pre-opened file-cache database to reuse.
 * @returns {Promise<{ changes: FileChange[], savingEntries: Entry[] }>} Collected changes and the
 * entries to be saved.
 */
export const buildTargetChanges = async ({ targets, cacheDB }) => {
  if (!targets.length) {
    return { changes: [], savingEntries: [] };
  }

  const db = resolveCacheDB(cacheDB);

  const perEntryChanges = await Promise.all(
    targets.map(({ entry, collection, collectionFile }) =>
      buildEntryUpdateChanges({
        collection,
        collectionFile,
        entry,
        draft: createSyntheticDraft({
          collection,
          collectionFile,
          isIndexFile: isCollectionIndexFile(collection, entry),
        }),
        cacheDB: db,
      }),
    ),
  );

  return {
    changes: perEntryChanges.flat(),
    savingEntries: targets.map(({ entry }) => entry),
  };
};
