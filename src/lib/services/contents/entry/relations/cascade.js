import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import {
  buildEntryUpdateChanges,
  createSyntheticDraft,
  resolveCacheDB,
} from '$lib/services/contents/entry/changes';
import {
  getEntryRelationValues,
  getReferencingRelationFields,
  getRelationKeyPaths,
} from '$lib/services/contents/entry/relations';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import {
 * Entry,
 * FileChange,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * ResolvedRelationField,
 * } from '$lib/types/private';
 * @import { RelationField } from '$lib/types/public';
 */

/**
 * An entry in another collection that references the renamed entry, with the updated references
 * already applied, along with where it lives so its file(s) can be written back.
 * @typedef {object} CascadeTarget
 * @property {Entry} entry Updated entry.
 * @property {InternalCollection} collection Collection the entry belongs to.
 * @property {InternalCollectionFile} [collectionFile] Collection file, for file/singleton
 * collections.
 */

/**
 * Build a copy of the entry as it will exist once the save completes, but with everything except
 * its identity left untouched. Relation values are derived from templates that may combine the
 * entry slug with content fields, so recomputing them against the original content isolates the
 * effect of the rename: the two value lists are then guaranteed to line up one to one, whereas
 * content edits made in the same save could add or remove values and make them impossible to pair.
 * @param {object} args Arguments.
 * @param {Entry} args.originalEntry Entry as it was before the save.
 * @param {Entry} args.savingEntry Entry being saved.
 * @param {string} [args.canonicalSlugKey] Property name of the canonical slug, which mirrors the
 * default locale’s slug and therefore changes along with it.
 * @returns {Entry} Renamed entry.
 */
export const createRenamedEntry = ({ originalEntry, savingEntry, canonicalSlugKey }) => ({
  ...originalEntry,
  slug: savingEntry.slug,
  locales: Object.fromEntries(
    Object.entries(originalEntry.locales).map(([locale, localizedEntry]) => {
      const { slug, content } = savingEntry.locales[locale] ?? {};
      const canonicalSlug = canonicalSlugKey ? content?.[canonicalSlugKey] : undefined;

      return [
        locale,
        {
          ...localizedEntry,
          slug: slug ?? localizedEntry.slug,
          content:
            canonicalSlugKey && canonicalSlug !== undefined && localizedEntry.content
              ? { ...localizedEntry.content, [canonicalSlugKey]: canonicalSlug }
              : localizedEntry.content,
        },
      ];
    }),
  ),
});

/**
 * Work out how the values identifying the renamed entry in a Relation field change, for entries
 * holding the field in the given locale.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Relation field config.
 * @param {Entry} args.originalEntry Entry as it was before the save.
 * @param {Entry} args.renamedEntry Entry from {@link createRenamedEntry}.
 * @param {InternalLocaleCode} args.locale Locale of the entries holding the field.
 * @returns {Map<any, any>} Map of old value to new value, holding only the values that change.
 */
export const getReplacementMap = ({ fieldConfig, originalEntry, renamedEntry, locale }) => {
  const getValuesArgs = { fieldConfig, locale };
  const oldValues = getEntryRelationValues({ ...getValuesArgs, entry: originalEntry });
  const newValues = getEntryRelationValues({ ...getValuesArgs, entry: renamedEntry });
  /** @type {Map<any, any>} */
  const map = new Map();

  // Both lists are produced from the same content, so a mismatch means the templates couldn’t be
  // resolved consistently. Rewriting references on a guess would corrupt them, so do nothing
  if (oldValues.length !== newValues.length) {
    return map;
  }

  oldValues.forEach((oldValue, index) => {
    if (oldValue !== newValues[index]) {
      map.set(oldValue, newValues[index]);
    }
  });

  return map;
};

/**
 * Replace the outdated references in a copy of the given content map.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Flattened entry content. Not modified.
 * @param {ResolvedRelationField} args.relation Relation field to update.
 * @param {Map<any, any>} args.replacements Map of old value to new value.
 * @returns {FlattenedEntryContent | undefined} Updated content, or `undefined` if the content holds
 * no outdated reference.
 */
export const replaceReferences = ({ content, relation, replacements }) => {
  const { keyPath, valuePattern, multiple } = relation;

  const outdatedKeyPaths = getRelationKeyPaths({ content, keyPath, valuePattern, multiple }).filter(
    (key) => replacements.has(content[key]),
  );

  if (!outdatedKeyPaths.length) {
    return undefined;
  }

  const updatedContent = { ...content };

  outdatedKeyPaths.forEach((key) => {
    updatedContent[key] = replacements.get(content[key]);
  });

  return updatedContent;
};

/**
 * Update every entry referencing the renamed entry through the given Relation field, collecting the
 * results into the shared target map so that an entry referencing the renamed entry through more
 * than one field is only written once.
 * @param {object} args Arguments.
 * @param {ResolvedRelationField} args.relation Relation field to update.
 * @param {Entry} args.originalEntry Entry as it was before the save.
 * @param {Entry} args.renamedEntry Entry from {@link createRenamedEntry}.
 * @param {Map<string, CascadeTarget>} args.targets Cascade targets, keyed by entry ID.
 */
const collectCascadeTargets = ({ relation, originalEntry, renamedEntry, targets }) => {
  const { fieldConfig, sourceCollection, sourceCollectionFile } = relation;
  const sourceFileName = sourceCollectionFile?.name;
  const { allLocales } = sourceCollectionFile?._i18n ?? sourceCollection._i18n;

  // Relation values can vary by the locale of the entry holding the field, e.g. when the
  // `value_field` template contains `{{locale}}`, so each locale gets its own map. Building them
  // up front means a field whose values don’t depend on the entry’s identity — a `value_field`
  // pointing at a content field, most commonly — is skipped without touching a single entry
  /** @type {Map<InternalLocaleCode, Map<any, any>>} */
  const replacementCache = new Map(
    allLocales.map((locale) => [
      locale,
      getReplacementMap({ fieldConfig, originalEntry, renamedEntry, locale }),
    ]),
  );

  if (![...replacementCache.values()].some(({ size }) => size > 0)) {
    return;
  }

  getEntriesByCollection(sourceCollection.name)
    .filter(
      (sourceEntry) =>
        // The renamed entry is saved on its own, including any self-reference it may hold
        sourceEntry.id !== originalEntry.id &&
        // In a file/singleton collection, only the file holding the field can reference it
        (!sourceFileName || sourceEntry.slug === sourceFileName),
    )
    .forEach((sourceEntry) => {
      // Pick up any update another Relation field has already made to the same entry
      const entry = targets.get(sourceEntry.id)?.entry ?? sourceEntry;
      /** @type {Entry['locales']} */
      const updatedLocales = {};

      Object.entries(entry.locales).forEach(([locale, localizedEntry]) => {
        const { content } = localizedEntry;

        if (!content) {
          return;
        }

        // A locale that’s no longer configured can still exist in an entry loaded earlier
        const replacements = getOrCreate(replacementCache, locale, () =>
          getReplacementMap({ fieldConfig, originalEntry, renamedEntry, locale }),
        );

        if (!replacements.size) {
          return;
        }

        const updatedContent = replaceReferences({ content, relation, replacements });

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

/**
 * Build the file changes that keep Relation field references pointing at an entry whose slug has
 * been edited, the way a database cascades an update of a referenced key to the rows referencing
 * it. Nothing is written for an entry whose references still resolve, so a save that doesn’t rename
 * anything costs a single comparison.
 *
 * References are matched on the value the Relation field stores, which is the entry slug unless a
 * `value_field` is configured. A `value_field` pointing at a content field doesn’t depend on the
 * slug, so those references are left alone; one combining the slug with other fields, such as
 * `{{locale}}/{{slug}}`, is recomputed in full.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection of the renamed entry.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file of the renamed entry.
 * @param {Entry} [args.originalEntry] Renamed entry as it was before the save. `undefined` for a
 * new entry, which nothing can reference yet.
 * @param {Entry} args.savingEntry Renamed entry being saved.
 * @param {IndexedDB} [args.cacheDB] Pre-opened file-cache database to reuse.
 * @returns {Promise<{ changes: FileChange[], savingEntries: Entry[] }>} Collected changes and the
 * entries to be saved.
 */
export const buildCascadeChanges = async ({
  collection,
  collectionFile,
  originalEntry,
  savingEntry,
  cacheDB,
}) => {
  /** @type {{ changes: FileChange[], savingEntries: Entry[] }} */
  const noChanges = { changes: [], savingEntries: [] };

  if (!originalEntry || originalEntry.slug === savingEntry.slug) {
    return noChanges;
  }

  const relations = getReferencingRelationFields({
    collectionName: collection.name,
    fileName: collectionFile?.name,
  });

  if (!relations.length) {
    return noChanges;
  }

  const {
    _i18n: {
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? collection;

  const renamedEntry = createRenamedEntry({ originalEntry, savingEntry, canonicalSlugKey });
  /** @type {Map<string, CascadeTarget>} */
  const targets = new Map();

  relations.forEach((relation) => {
    collectCascadeTargets({ relation, originalEntry, renamedEntry, targets });
  });

  if (!targets.size) {
    return noChanges;
  }

  const db = resolveCacheDB(cacheDB);

  const perEntryChanges = await Promise.all(
    [...targets.values()].map(
      ({ entry, collection: sourceCollection, collectionFile: sourceCollectionFile }) =>
        buildEntryUpdateChanges({
          collection: sourceCollection,
          collectionFile: sourceCollectionFile,
          entry,
          draft: createSyntheticDraft({
            collection: sourceCollection,
            collectionFile: sourceCollectionFile,
            isIndexFile: isCollectionIndexFile(sourceCollection, entry),
          }),
          cacheDB: db,
        }),
    ),
  );

  return {
    changes: perEntryChanges.flat(),
    savingEntries: [...targets.values()].map(({ entry }) => entry),
  };
};
