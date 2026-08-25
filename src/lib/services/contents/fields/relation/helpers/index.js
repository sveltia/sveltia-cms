import { compare } from '@sveltia/utils/string';

import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
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
 * Build the option list for a Relation field from the given referenced entries. This is the
 * uncached core shared by {@link getOptions} and {@link getEntryOptions}.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {Entry[]} args.refEntries Referenced entries.
 * @param {RelationFieldFilterOptions[]} [args.entryFilters] Entry filters with any template strings
 * already resolved.
 * @returns {RelationOption[]} Options, unsorted.
 */
const buildOptions = ({ locale, fieldConfig, refEntries, entryFilters = [] }) => {
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
    }),
  );
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
 * @returns {RelationOption[]} Options.
 */
export const getOptions = ({
  locale,
  fieldConfig,
  refEntries,
  currentLocaleValues = undefined,
  currentSlug = undefined,
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
  const cacheKey = `${locale}|${ids}|${resolvedKey}`;

  return getOrCreateBounded(
    optionCacheMap,
    cacheKey,
    () =>
      buildOptions({ locale, fieldConfig, refEntries, entryFilters: resolvedFilters }).sort(
        (a, b) => compare(a.label, b.label),
      ),
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
 * @returns {RelationOption[]} Options, in the order the templates produce them. Empty if the
 * referenced collection is gone or the entry has no content in any usable locale.
 */
export const getEntryOptions = ({ locale, fieldConfig, refEntry }) =>
  buildOptions({ locale, fieldConfig, refEntries: [refEntry] });

/**
 * Resolve the display value(s) for a relation field.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {FlattenedEntryContent} args.valueMap Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath Field key path, e.g. `author.name`.
 * @param {InternalLocaleCode} args.locale Locale.
 * @returns {any | any[]} Resolved field value(s).
 */
export const getReferencedOptionLabel = ({ fieldConfig, valueMap, keyPath, locale }) => {
  const { multiple, collection } = fieldConfig;
  const refEntries = getEntriesByCollection(collection);
  const refOptions = getOptions({ locale, fieldConfig, refEntries });
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
