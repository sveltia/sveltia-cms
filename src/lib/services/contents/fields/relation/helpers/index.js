import { compare } from '@sveltia/utils/string';

import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { isManuallyOrdered } from '$lib/services/contents/collection/entries/reorder/config';
import { sortEntriesByOrderField } from '$lib/services/contents/collection/entries/reorder/sort';
import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
import { getIdentifierFieldName } from '$lib/services/contents/collection/identifier';
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
import { sortOptions } from '$lib/services/contents/fields/relation/helpers/sort';
import { prepareFieldTemplates } from '$lib/services/contents/fields/relation/helpers/templates';
import { getOrCreateBounded } from '$lib/services/utils/cache';

/**
 * @import {
 * Entry,
 * FlattenedEntryContent,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * RelationOption,
 * RelationOptionGroup,
 * UnlistedEntry,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField, RelationFieldFilterOptions } from '$lib/types/public';
 * @import { SharedValues } from '$lib/services/contents/i18n/shared-values';
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
 * Cache keys of the option sets being built. A label template can refer to another Relation field
 * of the referenced entry, which resolves its own options; if that field leads back to the one
 * being built, e.g. a `parent` field showing the parent’s `parent`, the same options would be
 * requested again before they are cached, recursing until the stack overflows.
 * @type {Set<string>}
 */
const optionsInProgress = new Set();
/**
 * Maximum number of merged entry lists kept for each saved entry list by
 * {@link withPendingEntries}.
 */
const MAX_MERGED_ENTRIES_CACHE_SIZE = 10;
/**
 * Cache of the saved entries merged with the pending ones by {@link withPendingEntries}, keyed by
 * the saved entry list, then by the identities of the pending entries. A nested Relation field
 * resolves a label for each entry its parent field references, and a new merged array on each call
 * would give the option cache a new key every time, building the whole option list again for every
 * label. The pending entries are keyed by their identities rather than by the list, which can be
 * put together anew on each call.
 * @type {WeakMap<Entry[], Map<string, Entry[]>>}
 */
const mergedEntriesCache = new WeakMap();

/**
 * Get a key telling the given pending entries apart from another set, or the same array after a
 * change, by the identities of the entries.
 * @param {UnlistedEntry[]} [pendingEntries] Entries not yet among the saved ones.
 * @returns {string} Key.
 */
const getPendingEntriesKey = (pendingEntries = []) =>
  pendingEntries.map((pendingEntry) => getObjectId(pendingEntry)).join(',');

/**
 * Merge the given entries not yet among the saved ones that belong to the given collection into the
 * saved entries. An existing entry takes the place of its saved version, and the later of two
 * versions of the same entry wins.
 * @param {Entry[]} entries Saved entries.
 * @param {string} collectionName Collection name.
 * @param {UnlistedEntry[]} pendingEntries Entries not yet among the saved ones, of any collection.
 * @returns {Entry[]} Entries.
 */
const mergeEntries = (entries, collectionName, pendingEntries) => {
  const pending = pendingEntries
    .filter((pendingEntry) => pendingEntry.collectionName === collectionName)
    .map(({ entry }) => entry);

  // An existing entry edited from a Relation field takes the place of its saved version
  const pendingMap = new Map(pending.map((entry) => [entry.id, entry]));

  return pending.length
    ? [
        ...entries.map((entry) => {
          const edited = pendingMap.get(entry.id);

          pendingMap.delete(entry.id);

          return edited ?? entry;
        }),
        ...pendingMap.values(),
      ]
    : entries;
};

/**
 * Add the entries not yet among the saved ones that belong to the given collection to the given
 * saved entries, so a reference to one of them resolves: the entries pending on the draft being
 * edited, and those in the pull request its host entry has been saved to. The saved entries are
 * returned as they are when there’s nothing to add, keeping their identity for the option cache;
 * otherwise the merged list is kept as long as the pending entries stay the same.
 * @param {Entry[]} entries Saved entries.
 * @param {string} collectionName Collection name.
 * @param {UnlistedEntry[]} [pendingEntries] Entries not yet among the saved ones, of any
 * collection.
 * @returns {Entry[]} Entries.
 */
const withPendingEntries = (entries, collectionName, pendingEntries = []) => {
  if (!pendingEntries.length) {
    return entries;
  }

  let pendingCache = mergedEntriesCache.get(entries);

  if (!pendingCache) {
    pendingCache = new Map();
    mergedEntriesCache.set(entries, pendingCache);
  }

  // The pending entries of a draft are held in a reactive array that changes in place, so the
  // entries’ own identities tell a change apart: an entry opened again and changed is replaced with
  // a new object
  return getOrCreateBounded(
    pendingCache,
    getPendingEntriesKey(pendingEntries),
    () => mergeEntries(entries, collectionName, pendingEntries),
    MAX_MERGED_ENTRIES_CACHE_SIZE,
  );
};

/**
 * Build the options for a Relation field from the given referenced entries, grouped by entry. This
 * is the uncached core shared by {@link getOptions} and {@link getEntryOptions}.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {Entry[]} args.refEntries Referenced entries.
 * @param {RelationFieldFilterOptions[]} [args.entryFilters] Entry filters with any template strings
 * already resolved.
 * @param {UnlistedEntry[]} [args.pendingEntries] Entries not yet among the saved ones. A label
 * template can refer to another Relation field of the referenced entry, and the entry that one
 * points at may be one of them too.
 * @returns {RelationOptionGroup[]} Options grouped by referenced entry, unsorted.
 */
const buildOptionGroups = ({
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

  const identifierField = getIdentifierFieldName(_type === 'entry' ? collection : undefined);
  const templates = prepareFieldTemplates(fieldConfig, identifierField);

  const filteredEntries = filterAndPrepareEntries({
    refEntries,
    collection,
    locale,
    fileName,
    entryFilters,
    defaultLocale,
  });

  return filteredEntries.map(({ refEntry, content }) => ({
    refEntry,
    options: processEntry({
      refEntry,
      content,
      collection,
      templates,
      fileName,
      locale,
      identifierField,
      pendingEntries,
    }),
  }));
};

/**
 * Build the option list for a Relation field from the given referenced entries.
 * @param {Parameters<typeof buildOptionGroups>[0]} args Arguments. See {@link buildOptionGroups}.
 * @returns {RelationOption[]} Options, unsorted.
 */
const buildOptions = (args) => buildOptionGroups(args).flatMap(({ options }) => options);

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
 * @param {UnlistedEntry[]} [args.pendingEntries] Entries not yet among the saved ones, so the
 * labels referring to one of them through another Relation field resolve.
 * @param {SharedValues} [args.sharedValues] Values of the fields of the entry being edited that
 * aren’t localized, to resolve `{{fields.fieldName}}` template strings referring to one of them in
 * another locale than the default.
 * @returns {RelationOption[]} Options, sorted as the `sort_by` option defines, or by label unless
 * the field references a file or a collection kept in a manual order.
 */
export const getOptions = ({
  locale,
  fieldConfig,
  refEntries,
  currentLocaleValues = undefined,
  currentSlug = undefined,
  pendingEntries = undefined,
  sharedValues = undefined,
}) => {
  const { collection: collectionName, file: fileName, filters, sort_by: sortBy } = fieldConfig;

  // Resolve template strings in filter values against the current entry’s locale content and slug.
  // The resolved values are also baked into the cache key so stale options are not returned when
  // the relevant field value changes while the user is editing.
  const resolvedFilters = resolveFilterValues(
    filters ?? [],
    currentLocaleValues,
    currentSlug,
    sharedValues,
  );

  // Use object identity for `fieldConfig` and `refEntries` instead of `JSON.stringify`, which would
  // serialize the entire entries array (potentially hundreds of entries × many fields). The
  // resolved template values are included as a plain string so the cache is invalidated when the
  // current entry’s relevant field value changes. They’re kept apart by filter, as a list value
  // can move from one filter to another, and by type, as a number doesn’t match its string.
  const resolvedKey = JSON.stringify(resolvedFilters.map(({ values }) => values));
  const ids = `${getObjectId(fieldConfig)}|${getObjectId(refEntries)}`;
  // The pending entries are held in a reactive array that changes in place, so its identity doesn’t
  // tell them apart; theirs do, as an entry opened again and changed is replaced with a new object
  const cacheKey = `${locale}|${ids}|${getPendingEntriesKey(pendingEntries)}|${resolvedKey}`;

  // The options are requested again while being built: no option is available at this level, so
  // a reference is shown with its stored value
  if (optionsInProgress.has(cacheKey)) {
    return [];
  }

  return getOrCreateBounded(
    optionCacheMap,
    cacheKey,
    () => {
      optionsInProgress.add(cacheKey);

      try {
        const collection = getCollection(collectionName);

        // The options taken from a list in a single file follow the order of the list items, so
        // the `sort_by` option doesn’t apply to them
        if (collection && !fileName && sortBy?.field) {
          return sortOptions({
            groups: buildOptionGroups({
              locale,
              fieldConfig,
              refEntries,
              entryFilters: resolvedFilters,
              pendingEntries,
            }),
            collection: /** @type {InternalEntryCollection} */ (collection),
            sortBy,
            locale,
          });
        }

        // Without the `sort_by` option, the options from the entries of a collection the user can
        // reorder follow the manual order; the others are sorted by label
        const manuallyOrdered = !fileName && isManuallyOrdered(collection);

        const options = buildOptions({
          locale,
          fieldConfig,
          refEntries: manuallyOrdered
            ? sortEntriesByOrderField(
                refEntries,
                /** @type {InternalEntryCollection} */ (collection),
              )
            : refEntries,
          entryFilters: resolvedFilters,
          pendingEntries,
        });

        return fileName || manuallyOrdered
          ? options
          : options.sort((a, b) => compare(a.label, b.label));
      } finally {
        optionsInProgress.delete(cacheKey);
      }
    },
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
 * @param {UnlistedEntry[]} [args.pendingEntries] Entries not yet among the saved ones. See
 * {@link buildOptions}.
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
 * @param {UnlistedEntry[]} [args.pendingEntries] Entries not yet among the saved ones, which the
 * value can refer to.
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
