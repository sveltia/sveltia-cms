import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import {
  getEntryRelationValues,
  getReferencingRelationFields,
  getRelationValues,
} from '$lib/services/contents/entry/relations';
import { getEntrySummary } from '$lib/services/contents/entry/summary';

/**
 * @import { Entry, EntryBacklink } from '$lib/types/private';
 */

/**
 * Find all entries that reference the given target entry through Relation fields.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Target collection name.
 * @param {string} [args.fileName] Target file name, for file/singleton collections.
 * @param {Entry} args.entry Target entry.
 * @returns {EntryBacklink[]} Backlinks referencing the target entry. Each referencing entry appears
 * once, even if several of its Relation fields point at the target.
 */
export const getBacklinks = ({ collectionName, fileName, entry }) => {
  /** @type {Set<string>} */
  const seenEntryIds = new Set();

  return getReferencingRelationFields({ collectionName, fileName }).flatMap(
    ({ fieldConfig, sourceCollection, sourceCollectionFile, keyPath, valuePattern, multiple }) => {
      // Relation values can vary by the locale of the entry holding the field, e.g. when the
      // `value_field` template contains `{{locale}}`. Only the default locale is inspected here:
      // the panel lists entries, not individual locale files
      const locale = (sourceCollectionFile ?? sourceCollection)._i18n.defaultLocale;
      const targetValues = new Set(getEntryRelationValues({ fieldConfig, entry, locale }));

      if (!targetValues.size) {
        return [];
      }

      const sourceCollectionName = sourceCollection.name;
      const sourceFileName = sourceCollectionFile?.name;

      return getEntriesByCollection(sourceCollectionName)
        .filter(
          (sourceEntry) =>
            // An entry never counts as a backlink to itself
            sourceEntry.id !== entry.id &&
            // An entry already found through another Relation field is not listed again
            !seenEntryIds.has(sourceEntry.id) &&
            // In a file/singleton collection, only the file holding the field can reference it
            (!sourceFileName || sourceEntry.slug === sourceFileName),
        )
        .map((sourceEntry) => {
          const content =
            sourceEntry.locales[locale]?.content ?? Object.values(sourceEntry.locales)[0]?.content;

          if (
            !content ||
            !getRelationValues({ content, keyPath, valuePattern, multiple }).some((value) =>
              targetValues.has(value),
            )
          ) {
            return undefined;
          }

          seenEntryIds.add(sourceEntry.id);

          return /** @type {EntryBacklink} */ ({
            collectionName: sourceCollectionName,
            collectionLabel: sourceCollection.label || sourceCollectionName,
            fieldLabel: fieldConfig.label || fieldConfig.name,
            entry: sourceEntry,
            summary: getEntrySummary(sourceCollection, sourceEntry),
          });
        })
        .filter((backlink) => !!backlink);
    },
  );
};
