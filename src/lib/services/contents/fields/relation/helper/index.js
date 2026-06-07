import { compare, escapeRegExp } from '@sveltia/utils/string';

import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import {
  getObjectId,
  getOptionLabelMap,
} from '$lib/services/contents/fields/relation/helper/cache';
import { processEntry } from '$lib/services/contents/fields/relation/helper/entries';
import {
  filterAndPrepareEntries,
  resolveFilterValues,
} from '$lib/services/contents/fields/relation/helper/filters';
import { prepareFieldTemplates } from '$lib/services/contents/fields/relation/helper/templates';

/**
 * @import {
 * Entry,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * RelationOption,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField } from '$lib/types/public';
 */

/**
 * @type {Map<string, RelationOption[]>}
 */
export const optionCacheMap = new Map();

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
  const { collection: collectionName, file: fileName, filters } = fieldConfig;
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
  const cache = optionCacheMap.get(cacheKey);

  if (cache) {
    return cache;
  }

  const collection = getCollection(collectionName);

  if (!collection) {
    optionCacheMap.set(cacheKey, []);
    return [];
  }

  const {
    _type,
    _i18n: { defaultLocale },
  } = collection;

  const { identifier_field: identifierField = 'title' } = _type === 'entry' ? collection : {};
  const templates = prepareFieldTemplates(fieldConfig, identifierField);
  const { allFieldNames, hasListFields } = templates;
  const filteredEntries = filterAndPrepareEntries(refEntries, locale, fileName, resolvedFilters);

  const options = filteredEntries
    .flatMap(({ refEntry, content }) =>
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
    )
    .sort((a, b) => compare(a.label, b.label));

  optionCacheMap.set(cacheKey, options);

  return options;
};

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
    const values = Object.entries(valueMap)
      .filter(([key]) => key.match(`^${escapeRegExp(keyPath)}\\.\\d+$`))
      .map(([, _value]) => _value);

    return values.map(getLabel);
  }

  return getLabel(valueMap[keyPath]);
};
