import { _ } from '@sveltia/i18n';

import { isConfigReadonly } from '$lib/services/config/readonly';
import { buildTargetChanges } from '$lib/services/contents/entry/cascade';
import { getReadonlyEntryLabel, isEntryReadonly } from '$lib/services/contents/entry/readonly';
import {
  getEntryRelationValues,
  getReferencingRelationFields,
  getRelationKeyPaths,
} from '$lib/services/contents/entry/relations';
import { collectCascadeTargets } from '$lib/services/contents/entry/relations/cascade';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import {
 * CascadeTarget,
 * Entry,
 * FileChange,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * ResolvedRelationField,
 * } from '$lib/types/private';
 * @import { RelationField } from '$lib/types/public';
 * @import { CascadeContentUpdater } from '$lib/services/contents/entry/relations/cascade';
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
 * Find the entries referencing an entry whose slug has been edited, which have to be rewritten so
 * their references keep pointing at it. See {@link buildCascadeChanges}.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection of the renamed entry.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file of the renamed entry.
 * @param {Entry} [args.originalEntry] Renamed entry as it was before the save. `undefined` for a
 * new entry, which nothing can reference yet.
 * @param {Entry} args.savingEntry Renamed entry being saved.
 * @returns {CascadeTarget[]} Referencing entries, with their references updated.
 */
export const collectRenameTargets = ({
  collection,
  collectionFile,
  originalEntry,
  savingEntry,
}) => {
  if (!originalEntry || originalEntry.slug === savingEntry.slug) {
    return [];
  }

  const relations = getReferencingRelationFields({
    collectionName: collection.name,
    fileName: collectionFile?.name,
  });

  if (!relations.length) {
    return [];
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
    const { fieldConfig } = relation;

    collectCascadeTargets({
      relation,
      excludeIds: new Set([originalEntry.id]),
      targets,
      /**
       * Get the values identifying the renamed entry that change in the given locale.
       * @param {InternalLocaleCode} locale Locale of the entries holding the field.
       * @returns {Map<any, any>} Map of old value to new value.
       */
      getLocaleValues: (locale) =>
        getReplacementMap({ fieldConfig, originalEntry, renamedEntry, locale }),
      /**
       * Get the function that replaces the outdated references in an entry’s content.
       * @returns {CascadeContentUpdater<Map<any, any>>} Content updater.
       */
      getContentUpdater:
        () =>
        ({ content, values: replacements }) =>
          replaceReferences({ content, relation, replacements }),
    });
  });

  return [...targets.values()];
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
 *
 * A referencing entry that is read-only can’t be rewritten, so the rename is refused rather than
 * leaving that entry pointing at an entry that no longer exists under that name.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection of the renamed entry.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file of the renamed entry.
 * @param {Entry} [args.originalEntry] Renamed entry as it was before the save. `undefined` for a
 * new entry, which nothing can reference yet.
 * @param {Entry} args.savingEntry Renamed entry being saved.
 * @param {IndexedDB} [args.cacheDB] Pre-opened file-cache database to reuse.
 * @returns {Promise<{ changes: FileChange[], savingEntries: Entry[] }>} Collected changes and the
 * entries to be saved.
 * @throws {Error} When a referencing entry is read-only, with a message naming the entries.
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
  const targets = collectRenameTargets({ collection, collectionFile, originalEntry, savingEntry });

  if (!targets.length) {
    return noChanges;
  }

  // An entry can also be locked by another collection it belongs to. Only the `readonly` option
  // counts, as explained in `isEntryReadonly()`
  const readonlyTargets = targets.filter(
    (target) =>
      isConfigReadonly({ collection: target.collection, collectionFile: target.collectionFile }) ||
      isEntryReadonly(target.entry),
  );

  if (readonlyTargets.length) {
    const entries = readonlyTargets
      .map((target) => getReadonlyEntryLabel(target.entry, target.collection))
      .join(', ');

    throw new Error(_('cannot_rename_referenced_entry', { values: { entries } }));
  }

  return buildTargetChanges({ targets, cacheDB });
};
