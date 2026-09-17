import { unique } from '@sveltia/utils/array';

import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import {
  buildTargetChanges,
  compactList,
  dedupeBlockers,
  getFieldBlockers,
  ITEM_INDEX_SUFFIX_REGEX,
} from '$lib/services/contents/entry/cascade';
import { createSyntheticDraft } from '$lib/services/contents/entry/changes';
import {
  getEntryRelationValues,
  getReferencingRelationFields,
  getRelationKeyPaths,
} from '$lib/services/contents/entry/relations';
import { getCandidateEntries } from '$lib/services/contents/entry/relations/cascade';
import { getOrCreate } from '$lib/services/utils/cache';
import { getPublishedVersion } from '$lib/services/workflow';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import {
 * CascadeDeleteBlocker,
 * CascadeDeletePlan,
 * CascadeTarget,
 * Entry,
 * FileChange,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * ResolvedRelationField,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField } from '$lib/types/public';
 */

/**
 * Get the values identifying the entries being deleted in a Relation field, for entries holding
 * the field in the given locale.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Relation field config.
 * @param {Entry[]} args.entries Entries being deleted.
 * @param {InternalLocaleCode} args.locale Locale of the entries holding the field.
 * @returns {Set<any>} Stored values.
 */
export const getDeletedValues = ({ fieldConfig, entries, locale }) =>
  new Set(entries.flatMap((entry) => getEntryRelationValues({ fieldConfig, entry, locale })));

/**
 * Remove the references to the deleted entries from a copy of the given content map. A single-value
 * field is left empty, the way the editor leaves it when nothing is selected; a multi-value field
 * loses the values in question and has its remaining items renumbered, since they are stored under
 * consecutive indexes.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Flattened entry content. Not modified.
 * @param {ResolvedRelationField} args.relation Relation field to update.
 * @param {Set<any>} args.values Values to remove.
 * @returns {{ content: FlattenedEntryContent, fieldKeyPaths: FieldKeyPath[] } | undefined} Updated
 * content and the key paths of the fields that lost a reference — the field itself rather than an
 * item within it, which is what the validator looks at — or `undefined` if the content holds no
 * reference to the deleted entries.
 */
export const removeReferences = ({ content, relation, values }) => {
  const { keyPath, valuePattern, multiple } = relation;

  const staleKeyPaths = getRelationKeyPaths({ content, keyPath, valuePattern, multiple }).filter(
    (key) => values.has(content[key]),
  );

  if (!staleKeyPaths.length) {
    return undefined;
  }

  const updatedContent = { ...content };

  if (!multiple) {
    staleKeyPaths.forEach((key) => {
      // A field whose `value_field` is a number holds `null` when unselected, like the editor’s
      // unselected option
      updatedContent[key] = typeof content[key] === 'number' ? null : '';
    });

    return { content: updatedContent, fieldKeyPaths: staleKeyPaths };
  }

  // The field occurs once per list item when it’s nested in a list, so there can be several lists
  // to compact, each under its own key path
  const listKeyPaths = /** @type {FieldKeyPath[]} */ (
    unique(staleKeyPaths.map((key) => key.replace(ITEM_INDEX_SUFFIX_REGEX, '')))
  );

  /**
   * Check whether an item holds a reference to a deleted entry.
   * @param {FieldKeyPath} _key Item key path.
   * @param {any} value Stored value.
   * @returns {boolean} Result.
   */
  const isStale = (_key, value) => values.has(value);

  listKeyPaths.forEach((listKeyPath) => {
    compactList({ content: updatedContent, listKeyPath, isStale });
  });

  return { content: updatedContent, fieldKeyPaths: listKeyPaths };
};

/**
 * Check the fields that lost a reference against their own validation rules, such as `required`
 * and `min`, and describe each one that no longer passes. See {@link getFieldBlockers}.
 * @param {object} args Arguments.
 * @param {any} args.draft Synthetic draft for the entry holding the fields.
 * @param {Entry} args.entry Entry holding the fields, as stored.
 * @param {ResolvedRelationField} args.relation Relation field.
 * @param {InternalLocaleCode} args.locale Locale of the updated content.
 * @param {FlattenedEntryContent} args.content Updated content.
 * @param {FieldKeyPath[]} args.fieldKeyPaths Key paths of the fields to check.
 * @returns {CascadeDeleteBlocker[]} Blockers, one per invalid field.
 */
export const getBlockers = ({ draft, entry, relation, locale, content, fieldKeyPaths }) =>
  getFieldBlockers({
    draft,
    entry,
    collection: relation.sourceCollection,
    locale,
    content,
    fields: new Map(fieldKeyPaths.map((keyPath) => [keyPath, relation.fieldConfig])),
  });

/**
 * Remove the references to the deleted entries from every entry holding the given Relation field,
 * collecting the results into the shared target map so that an entry referencing the deleted
 * entries through more than one field is only written once, and noting every field the removal
 * would leave invalid.
 * @param {object} args Arguments.
 * @param {ResolvedRelationField} args.relation Relation field to update.
 * @param {Entry[]} args.entries Entries being deleted.
 * @param {Set<string>} args.deletedIds IDs of the entries being deleted.
 * @param {Map<string, CascadeTarget>} args.targets Cascade targets, keyed by entry ID.
 * @param {CascadeDeleteBlocker[]} args.blockers Blockers found so far.
 */
const collectDeleteTargets = ({ relation, entries, deletedIds, targets, blockers }) => {
  const { fieldConfig, sourceCollection, sourceCollectionFile } = relation;
  const { allLocales } = sourceCollectionFile?._i18n ?? sourceCollection._i18n;

  // Relation values can vary by the locale of the entry holding the field, e.g. when the
  // `value_field` template contains `{{locale}}`, so each locale gets its own set
  /** @type {Map<InternalLocaleCode, Set<any>>} */
  const valueCache = new Map(
    allLocales.map((locale) => [locale, getDeletedValues({ fieldConfig, entries, locale })]),
  );

  if (![...valueCache.values()].some(({ size }) => size > 0)) {
    return;
  }

  getCandidateEntries({ relation, excludeIds: deletedIds }).forEach((sourceEntry) => {
    // Pick up any update another Relation field has already made to the same entry
    const entry = targets.get(sourceEntry.id)?.entry ?? sourceEntry;
    /** @type {Entry['locales']} */
    const updatedLocales = {};

    const draft = createSyntheticDraft({
      collection: sourceCollection,
      collectionFile: sourceCollectionFile,
      isIndexFile: isCollectionIndexFile(sourceCollection, sourceEntry),
    });

    Object.entries(entry.locales).forEach(([locale, localizedEntry]) => {
      const { content } = localizedEntry;

      if (!content) {
        return;
      }

      // A locale that’s no longer configured can still exist in an entry loaded earlier
      const values = getOrCreate(valueCache, locale, () =>
        getDeletedValues({ fieldConfig, entries, locale }),
      );

      if (!values.size) {
        return;
      }

      const result = removeReferences({ content, relation, values });

      if (!result) {
        return;
      }

      updatedLocales[locale] = { ...localizedEntry, content: result.content };

      blockers.push(
        ...getBlockers({
          draft,
          entry: sourceEntry,
          relation,
          locale,
          content: result.content,
          fieldKeyPaths: result.fieldKeyPaths,
        }),
      );
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
 * Get every version of the entries being deleted that a reference can point at. Under Editorial
 * Workflow, an entry being edited in a pull request may have been renamed there, or had the field
 * its `value_field` points at edited, while the published entries still reference it as it stands
 * on the configured branch, so its published version is looked at as well. Its own version can’t
 * be left out either: the pull request may have brought the referencing entries along with it.
 * @param {Entry[]} entries Entries being deleted.
 * @returns {Entry[]} Entries, followed by the published versions of the unpublished ones.
 */
export const getDeletedVersions = (entries) => {
  const published = entries.flatMap((entry) => {
    const version = getPublishedVersion(entry);

    return version && !entries.includes(version) ? [version] : [];
  });

  return published.length ? [...entries, ...new Set(published)] : entries;
};

/**
 * Work out what deleting the given entries means for the entries referencing them through Relation
 * fields, the way a database cascades a delete to the rows referencing the deleted key: each
 * reference is removed, unless doing so would leave the referencing field in breach of its own
 * validation rules — a `required` field with nothing left selected, a multi-value field with fewer
 * than `min` items — in which case the deletion is reported as blocked, so the referencing entries
 * stay valid. Nothing is planned for an entry no one references, so a deletion in a collection no
 * Relation field points at costs a single lookup.
 *
 * The plan is computed from the entries as currently loaded; it’s meant to be shown for
 * confirmation and then carried out with {@link buildCascadeDeleteChanges} straight away.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection of the entries being deleted.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file of the entries being
 * deleted.
 * @param {Entry[]} args.entries Entries being deleted.
 * @returns {CascadeDeletePlan} Plan.
 */
export const planCascadeDelete = ({ collection, collectionFile, entries }) => {
  /** @type {Map<string, CascadeTarget>} */
  const targets = new Map();
  /** @type {CascadeDeleteBlocker[]} */
  const blockers = [];

  if (entries.length) {
    const versions = getDeletedVersions(entries);
    const deletedIds = new Set(versions.map(({ id }) => id));

    getReferencingRelationFields({
      collectionName: collection.name,
      fileName: collectionFile?.name,
    }).forEach((relation) => {
      collectDeleteTargets({ relation, entries: versions, deletedIds, targets, blockers });
    });
  }

  return { targets: [...targets.values()], blockers: dedupeBlockers(blockers) };
};

/**
 * Build the file changes that carry out a {@link planCascadeDelete} plan, so that the references
 * are removed in the same commit as the entries they point at.
 * @param {object} args Arguments.
 * @param {CascadeTarget[]} args.targets Targets from the plan. A caller that has already rewritten
 * some of the entries as part of the same operation leaves those out, so that no file is written
 * twice.
 * @param {IndexedDB} [args.cacheDB] Pre-opened file-cache database to reuse.
 * @returns {Promise<{ changes: FileChange[], savingEntries: Entry[] }>} Collected changes and the
 * entries to be saved.
 */
export const buildCascadeDeleteChanges = async ({ targets, cacheDB }) =>
  buildTargetChanges({ targets, cacheDB });
