import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import {
 * CascadeTarget,
 * Entry,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * ResolvedRelationField,
 * } from '$lib/types/private';
 */

/**
 * Get the entries that may hold a reference to the given entries through the given Relation field.
 * @param {object} args Arguments.
 * @param {ResolvedRelationField} args.relation Relation field.
 * @param {Set<string>} args.excludeIds IDs of the entries being saved or deleted on their own,
 * which are never rewritten here: a renamed entry is saved along with any self-reference it holds,
 * and a deleted entry takes its references away with it.
 * @returns {Entry[]} Candidate entries. Whether each one actually holds a reference is up to the
 * caller to find out.
 */
export const getCandidateEntries = ({ relation, excludeIds }) => {
  const { sourceCollection, sourceCollectionFile } = relation;
  const sourceFileName = sourceCollectionFile?.name;

  return getEntriesByCollection(sourceCollection.name).filter(
    (entry) =>
      !excludeIds.has(entry.id) &&
      // In a file/singleton collection, only the file holding the field can reference it
      (!sourceFileName || entry.slug === sourceFileName),
  );
};

/**
 * Update a copy of the content of an entry holding a Relation field in the given locale.
 * @template T
 * @callback CascadeContentUpdater
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Locale of the content.
 * @param {FlattenedEntryContent} args.content Flattened entry content. Not modified.
 * @param {T} args.values Values to look for in the locale, from `getLocaleValues`.
 * @returns {FlattenedEntryContent | undefined} Updated content, or `undefined` if the content holds
 * no reference.
 */

/**
 * Update every entry that may hold a reference through the given Relation field, collecting the
 * results into the shared target map so that an entry referencing the same entries through more
 * than one field is only written once.
 * @template {{ size: number }} T
 * @param {object} args Arguments.
 * @param {ResolvedRelationField} args.relation Relation field to update.
 * @param {Set<string>} args.excludeIds IDs of the entries never to update. See
 * {@link getCandidateEntries}.
 * @param {Map<string, CascadeTarget>} args.targets Cascade targets, keyed by entry ID.
 * @param {(locale: InternalLocaleCode) => T} args.getLocaleValues Function to get the values to
 * look for in the entries holding the field in the given locale, such as a map of old value to new
 * value. An empty collection means there’s nothing to update in that locale.
 * @param {(sourceEntry: Entry) => CascadeContentUpdater<T>} args.getContentUpdater Function to get
 * the content updater for a candidate entry.
 */
export const collectCascadeTargets = ({
  relation,
  excludeIds,
  targets,
  getLocaleValues,
  getContentUpdater,
}) => {
  const { sourceCollection, sourceCollectionFile } = relation;
  const { allLocales } = sourceCollectionFile?._i18n ?? sourceCollection._i18n;
  // Relation values can vary by the locale of the entry holding the field, e.g. when the
  // `value_field` template contains `{{locale}}`, so each locale gets its own values. Building them
  // up front means a field with nothing to look for is skipped without touching a single entry
  /** @type {Map<InternalLocaleCode, T>} */
  const valueCache = new Map(allLocales.map((locale) => [locale, getLocaleValues(locale)]));

  if (![...valueCache.values()].some(({ size }) => size > 0)) {
    return;
  }

  getCandidateEntries({ relation, excludeIds }).forEach((sourceEntry) => {
    // Pick up any update another Relation field has already made to the same entry
    const entry = targets.get(sourceEntry.id)?.entry ?? sourceEntry;
    /** @type {Entry['locales']} */
    const updatedLocales = {};
    const updateContent = getContentUpdater(sourceEntry);

    Object.entries(entry.locales).forEach(([locale, localizedEntry]) => {
      const { content } = localizedEntry;

      if (!content) {
        return;
      }

      // A locale that’s no longer configured can still exist in an entry loaded earlier
      const values = getOrCreate(valueCache, locale, () => getLocaleValues(locale));

      if (!values.size) {
        return;
      }

      const updatedContent = updateContent({ locale, content, values });

      if (updatedContent) {
        updatedLocales[locale] = { ...localizedEntry, content: updatedContent };
      }
    });

    if (Object.keys(updatedLocales).length) {
      targets.set(sourceEntry.id, {
        entry: { ...entry, locales: { ...entry.locales, ...updatedLocales } },
        collection: sourceCollection,
        collectionFile: sourceCollectionFile,
      });
    }
  });
};
