import { compare } from '@sveltia/utils/string';

import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
import { getListItemKeys } from '$lib/services/contents/entry/key-paths';
import {
  getObjectId,
  getOptionLabelMap,
} from '$lib/services/contents/fields/relation/helpers/cache';
import { processEntry } from '$lib/services/contents/fields/relation/helpers/entries';
import {
  filterAndPrepareEntries,
  resolveFilterValues,
} from '$lib/services/contents/fields/relation/helpers/filters';
import { prepareFieldTemplates } from '$lib/services/contents/fields/relation/helpers/templates';
import { getOrCreateBounded } from '$lib/services/utils/cache';

/**
 * @import {
 * Entry,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * PendingEntry,
 * RelationOption,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField, RelationFieldFilterOptions } from '$lib/types/public';
 */

/**
 * @type {Map<string, RelationOption[]>}
 */
export const optionCacheMap = new Map();

/**
 * Maximum number of option sets to retain in {@link optionCacheMap}.
 *
 * Two parts of the cache key keep changing while the app is running: the identity of the referenced
 * entry list, which is replaced every time the entries are loaded again or an entry is saved, and
 * the resolved `{{fields.*}}` filter values, which change on every keystroke in the field they
 * point at. Without a limit, each of those would add an options array — one entry per referenced
 * entry, potentially thousands — that is never read again and never released.
 *
 * The live working set is only a few option sets (one per visible relation field per locale), so
 * this is generous headroom; eviction is least-recently-used, keeping the hot ones cached.
 */
const MAX_OPTION_CACHE_SIZE = 100;

/**
 * Add the entries pending on the draft being edited that belong to the given collection to the
 * given saved entries, so a reference to one of them resolves before they are saved. The saved
 * entries are returned as they are when there’s nothing to add, keeping their identity for the
 * option cache.
 * @param {Entry[]} entries Saved entries.
 * @param {string} collectionName Collection name.
 * @param {PendingEntry[]} [pendingEntries] Pending entries of any collection.
 * @returns {Entry[]} Entries.
 */
const withPendingEntries = (entries, collectionName, pendingEntries = []) => {
  const pending = pendingEntries
    .filter((pendingEntry) => pendingEntry.collectionName === collectionName)
    .map(({ entry }) => entry);

  return pending.length ? [...entries, ...pending] : entries;
};

/**
 * Build the option list for a Relation field from the given referenced entries. This is the
 * uncached core shared by {@link getOptions} and {@link getEntryOptions}.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {Entry[]} args.refEntries Referenced entries.
 * @param {RelationFieldFilterOptions[]} [args.entryFilters] Entry filters with any template strings
 * already resolved.
 * @param {PendingEntry[]} [args.pendingEntries] Entries created from a Relation field of the draft
 * being edited. A label template can refer to another Relation field of the referenced entry, and
 * the entry that one points at may be pending too.
 * @returns {RelationOption[]} Options, unsorted.
 */
const buildOptions = ({
  locale,
  fieldConfig,
  refEntries,
  entryFilters = [],
  pendingEntries = undefined,
}) => {
  const { collection: collectionName, file: fileName } = fieldConfig;
  const collection = getCollection(collectionName);

  if (!collection) {
    return [];
  }

  const {
    _type,
    _i18n: { defaultLocale },
  } = collection;

  const { identifier_field: identifierField = 'title' } = _type === 'entry' ? collection : {};
  const templates = prepareFieldTemplates(fieldConfig, identifierField);
  const { allFieldNames, hasListFields } = templates;

  const filteredEntries = filterAndPrepareEntries({
    refEntries,
    collection,
    locale,
    fileName,
    entryFilters,
    defaultLocale,
  });

  return filteredEntries.flatMap(({ refEntry, content }) =>
    processEntry({
      refEntry,
      content,
      collection,
      templates,
      allFieldNames,
      hasListFields,
      collectionName,
      fileName,
      locale,
      identifierField,
      defaultLocale,
      pendingEntries,
    }),
  );
};

/**
 * Get the entries a Relation field can reference: the entries of the referenced collection, or the
 * referenced file of a file collection.
 * @param {RelationField} fieldConfig Field configuration.
 * @returns {Entry[]} Entries. Empty if the referenced file is not found.
 */
export const getRefEntries = ({ collection: collectionName, file: fileName }) => {
  if (fileName) {
    const entry = getCollectionFileEntry(collectionName, fileName);

    return entry ? [entry] : [];
  }

  return getEntriesByCollection(collectionName);
};

/**
 * Get options for a Relation field.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {Entry[]} args.refEntries Referenced entries.
 * @param {FlattenedEntryContent} [args.currentLocaleValues] Flattened field values of the entry
 * currently being edited. Required to resolve `{{fields.fieldName}}` template strings in filter
 * `values`. When omitted, those template strings are ignored.
 * @param {string} [args.currentSlug] Current slug of the entry being edited. Required to resolve
 * `{{slug}}` template strings in filter `values`. When omitted (e.g. new entry draft), `{{slug}}`
 * templates are ignored.
 * @param {PendingEntry[]} [args.pendingEntries] Entries created from a Relation field of the draft
 * being edited, so the labels referring to one of them through another Relation field resolve.
 * @returns {RelationOption[]} Options.
 */
export const getOptions = ({
  locale,
  fieldConfig,
  refEntries,
  currentLocaleValues = undefined,
  currentSlug = undefined,
  pendingEntries = undefined,
}) => {
  const { filters } = fieldConfig;
  // Resolve template strings in filter values against the current entry’s locale content and slug.
  // The resolved values are also baked into the cache key so stale options are not returned when
  // the relevant field value changes while the user is editing.
  const resolvedFilters = resolveFilterValues(filters ?? [], currentLocaleValues, currentSlug);
  // Use object identity for `fieldConfig` and `refEntries` instead of `JSON.stringify`, which would
  // serialize the entire entries array (potentially hundreds of entries × many fields). The
  // resolved template values are included as a plain string so the cache is invalidated when the
  // current entry’s relevant field value changes.
  const resolvedKey = resolvedFilters.flatMap(({ values }) => values).join('\x00');
  const ids = `${getObjectId(fieldConfig)}|${getObjectId(refEntries)}`;
  // The pending entries are held in a reactive array that grows in place, so its identity doesn’t
  // tell them apart; the count does, as they are only ever added while the draft is edited
  const cacheKey = `${locale}|${ids}|${pendingEntries?.length ?? 0}|${resolvedKey}`;

  return getOrCreateBounded(
    optionCacheMap,
    cacheKey,
    () =>
      buildOptions({
        locale,
        fieldConfig,
        refEntries,
        entryFilters: resolvedFilters,
        pendingEntries,
      }).sort((a, b) => compare(a.label, b.label)),
    MAX_OPTION_CACHE_SIZE,
  );
};

/**
 * Get the option(s) representing a single entry in a Relation field, in other words the value(s)
 * that would be stored when the entry is selected. Unlike {@link getOptions}, the field’s `filters`
 * are not applied — a reference to the entry can exist regardless of whether the entry still
 * qualifies as a choice — and the result is not cached, because callers ask for a one-off entry
 * rather than the list backing a field.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Locale of the entry holding the Relation field.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {Entry} args.refEntry Referenced entry.
 * @param {PendingEntry[]} [args.pendingEntries] Entries created from a Relation field of the draft
 * being edited. See {@link buildOptions}.
 * @returns {RelationOption[]} Options, in the order the templates produce them. Empty if the
 * referenced collection is gone or the entry has no content in any usable locale.
 */
export const getEntryOptions = ({ locale, fieldConfig, refEntry, pendingEntries = undefined }) =>
  buildOptions({ locale, fieldConfig, refEntries: [refEntry], pendingEntries });

/**
 * Resolve the display value(s) for a relation field.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {FlattenedEntryContent} args.valueMap Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath Field key path, e.g. `author.name`.
 * @param {InternalLocaleCode} args.locale Locale.
 * @param {PendingEntry[]} [args.pendingEntries] Entries created from a Relation field of the draft
 * being edited, which the value can refer to before they are saved.
 * @returns {any | any[]} Resolved field value(s).
 */
export const getReferencedOptionLabel = ({
  fieldConfig,
  valueMap,
  keyPath,
  locale,
  pendingEntries = undefined,
}) => {
  const { multiple, collection } = fieldConfig;

  const refEntries = withPendingEntries(
    getEntriesByCollection(collection),
    collection,
    pendingEntries,
  );

  const refOptions = getOptions({ locale, fieldConfig, refEntries, pendingEntries });
  const optionLabelMap = getOptionLabelMap(refOptions);
  /**
   * Get the label by value.
   * @param {any} _value Stored value.
   * @returns {string} Label.
   */
  const getLabel = (_value) => optionLabelMap.get(_value) || _value;

  if (multiple) {
    return getListItemKeys(valueMap, keyPath).map((key) => getLabel(valueMap[key]));
  }

  return getLabel(valueMap[keyPath]);
};
