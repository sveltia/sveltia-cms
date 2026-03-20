import { unique } from '@sveltia/utils/array';
import { compare, escapeRegExp } from '@sveltia/utils/string';

import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
import { getField, getFieldDisplayValue } from '$lib/services/contents/entry/fields';
import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';

/**
 * @import {
 * Entry,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * ListField,
 * RelationField,
 * RelationFieldFilterOptions,
 * } from '$lib/types/public';
 */

/**
 * @typedef {{ label: string, value: any, searchValue: string }} RelationOption
 */

/**
 * @typedef {object} ReplacementContext
 * @property {string} slug The slug of the entry.
 * @property {InternalLocaleCode} locale The current locale.
 * @property {(keyPath: FieldKeyPath, _locale?: InternalLocaleCode) => string} getDisplayValue
 * Function to get the display value of a field.
 */

/**
 * @typedef {object} FallbackContext
 * @property {FlattenedEntryContent} content Content of the entry.
 * @property {Record<InternalLocaleCode, FlattenedEntryContent>} locales Locales of the entry.
 * @property {InternalLocaleCode} defaultLocale Default locale of the entry.
 * @property {FieldKeyPath} identifierField Identifier field for the entry.
 */

/**
 * @typedef {object} TemplateStrings
 * @property {string} _valueField Normalized value field template.
 * @property {string} _displayField Normalized display field template.
 * @property {string} _searchField Normalized search field template.
 * @property {string[]} allFieldNames All field names extracted from templates.
 * @property {boolean} hasListFields Whether any field names include a list wildcard (*).
 */

/**
 * @type {Map<string, RelationOption[]>}
 */
export const optionCacheMap = new Map();

/**
 * `WeakMap` used to assign stable numeric identities to objects for cheap cache key building,
 * avoiding the need to `JSON.stringify` large objects like `fieldConfig` or `refEntries` arrays.
 * @type {WeakMap<object, number>}
 */
const objectIdentityMap = new WeakMap();
let nextObjectId = 0;

/**
 * Get a stable numeric identity for the given object (by reference).
 * @param {object} obj Object.
 * @returns {number} Numeric identity.
 */
const getObjectId = (obj) => {
  if (!objectIdentityMap.has(obj)) {
    objectIdentityMap.set(obj, nextObjectId);
    nextObjectId += 1;
  }

  return /** @type {number} */ (objectIdentityMap.get(obj));
};

/**
 * Enclose the given field name in brackets if it doesn’t contain any brackets.
 * @internal
 * @param {string} fieldName Field name e.g. `{{name.first}}` or `name.first`.
 * @returns {string} Bracketed field name, e.g. `{{name.first}}`.
 */
export const normalizeFieldName = (fieldName) => {
  if (/{{.+?}}/.test(fieldName)) {
    return fieldName;
  }

  if (fieldName === 'slug') {
    // Avoid confusion with `{{slug}}`, which is the entry slug, not the `slug` field
    return '{{fields.slug}}';
  }

  return `{{${fieldName}}}`;
};

/**
 * Check if the given field configuration is a complex list field with subfields (e.g.
 * `cities.*.name`) and not just a simple list field (e.g. `skills.*`).
 * @internal
 * @param {Field | undefined} fieldConfig Field configuration object.
 * @returns {boolean} Whether the field is a complex list field.
 */
export const isComplexListField = (fieldConfig) => {
  if (!fieldConfig || fieldConfig.widget !== 'list') {
    return false;
  }

  const hasFields = 'fields' in /** @type {ListField} */ (fieldConfig);
  const hasTypes = 'types' in /** @type {ListField} */ (fieldConfig);

  return hasFields || hasTypes;
};

/**
 * Get the replacement value for a field name based on standard field types.
 * @internal
 * @param {string} fieldName The field name to get replacement for.
 * @param {ReplacementContext} context Context object containing `slug`, `locale`, and
 * `getDisplayValue` function.
 * @param {FallbackContext} fallbackContext Fallback context for additional content.
 * @returns {string} The replacement value.
 */
export const getFieldReplacement = (fieldName, context, fallbackContext) => {
  const { slug, locale, getDisplayValue } = context;
  const { content, locales, defaultLocale, identifierField } = fallbackContext;

  if (fieldName === 'slug') {
    return slug;
  }

  if (fieldName === 'locale') {
    return locale;
  }

  const keyPath = fieldName.replace(/^fields\./, '');

  return (
    getDisplayValue(keyPath) ||
    getDisplayValue(keyPath, defaultLocale) ||
    getEntrySummaryFromContent(content, { identifierField }) ||
    getEntrySummaryFromContent(locales[defaultLocale]?.content || {}, {
      identifierField,
    }) ||
    slug
  );
};

/**
 * Replace all template tags in the given strings with actual values.
 * @internal
 * @param {RelationOption} templates Object containing `label`, `value`, and `searchValue`
 * templates.
 * @param {string[]} fieldNames Array of field names to replace.
 * @param {ReplacementContext} context Context object for replacements.
 * @param {FallbackContext} fallbackContext Fallback context for additional content.
 * @returns {RelationOption} Object with replaced `label`, `value`, and `searchValue`.
 */
export const replaceTemplateFields = (templates, fieldNames, context, fallbackContext) => {
  let { label, value, searchValue } = templates;

  fieldNames.forEach((fieldName) => {
    const replacement = getFieldReplacement(fieldName, context, fallbackContext);

    label = label.replaceAll(`{{${fieldName}}}`, replacement);
    value = value.replaceAll(`{{${fieldName}}}`, replacement);
    searchValue = searchValue?.replaceAll(`{{${fieldName}}}`, replacement) ?? '';
  });

  return { label, value, searchValue };
};

/**
 * Extract field names from template strings.
 * @internal
 * @param {string} template Template string with field names in {{}} brackets.
 * @returns {string[]} Array of field names.
 */
export const extractFieldNames = (template) =>
  [...template.matchAll(/{{(.+?)}}/g)].map((m) => m[1]);

/**
 * Normalize and prepare field templates for processing.
 * @internal
 * @param {RelationField} fieldConfig Field configuration.
 * @param {string} identifierField Default identifier field.
 * @returns {TemplateStrings} Normalized field templates.
 */
export const prepareFieldTemplates = (fieldConfig, identifierField) => {
  /**
   * @example 'userId'
   * @example 'name.first'
   * @example 'cities.*.id'
   * @example '{{cities.*.id}}'
   * @example 'slug' (`slug` field)
   * @example '{{slug}}' (entry slug)
   * @example '{{locale}}/{{slug}}'
   * @example '{{fields.slug}}' (not mentioned in the Netlify/Decap CMS doc but Sveltia CMS supports
   * the `fields.` prefix for compatibility with other config options)
   */
  const valueField = fieldConfig.value_field;
  /**
   * @example ['userId']
   * @example ['name.first'] (nested)
   * @example ['cities.*.id', 'cities.*.name'] (with wildcard, multiple)
   * @example ['{{twitterHandle}} - {{followerCount}}'] (template)
   */
  const displayFields = fieldConfig.display_fields ?? [valueField ?? `{{${identifierField}}}`];
  /**
   * The format is the same as {@link displayFields}.
   */
  const searchFields = fieldConfig.search_fields ?? displayFields;
  /**
   * Canonical, templatized value field.
   * @example '{{name.first}}'
   * @example '{{route}}#{{sections.*.name}}'
   */
  const _valueField = normalizeFieldName(valueField ?? '{{slug}}');
  /**
   * Canonical, templatized display field.
   * @example '{{twitterHandle}} {{followerCount}}'
   * @example '{{sections.*.name}}'
   * @example '{{route}}: {{sections.*.name}} ({{sections.*.id}})'
   */
  const _displayField = displayFields.map(normalizeFieldName).join(' ');
  /**
   * Canonical, templatized search field.
   */
  const _searchField = searchFields.map(normalizeFieldName).join(' ');

  const allFieldNames = unique([
    ...extractFieldNames(_displayField),
    ...extractFieldNames(_valueField),
    ...extractFieldNames(_searchField),
  ]);

  return {
    _valueField,
    _displayField,
    _searchField,
    allFieldNames,
    hasListFields: allFieldNames.some((name) => name.includes('*')),
  };
};

/**
 * Filter entries based on file name and entry filters.
 * @internal
 * @param {Entry[]} refEntries Reference entries.
 * @param {InternalLocaleCode} locale Current locale.
 * @param {string} [fileName] File name to filter by.
 * @param {RelationFieldFilterOptions[]} [entryFilters] Entry filters to apply.
 * @returns {{ refEntry: Entry, content: FlattenedEntryContent }[]} Filtered entries with content.
 */
export const filterAndPrepareEntries = (
  refEntries,
  locale,
  fileName = undefined,
  entryFilters = [],
) =>
  refEntries
    .filter((refEntry) => !fileName || fileName === refEntry.slug)
    .map((refEntry) => {
      // Fall back to the default locale if needed
      const { content } = refEntry.locales[locale] ?? refEntry.locales._default ?? {};

      return {
        refEntry,
        hasContent: !!content && Object.keys(content).length > 0,
        content: content ?? {},
      };
    })
    .filter(
      ({ hasContent, content }) =>
        hasContent && entryFilters.every(({ field, values }) => values.includes(content[field])),
    );

/**
 * Create a single relation option for non-list fields.
 * @internal
 * @param {object} params Parameters.
 * @param {TemplateStrings} params.templates Template strings.
 * @param {string[]} params.allFieldNames All field names to replace.
 * @param {ReplacementContext} params.context Replacement context.
 * @param {FallbackContext} params.fallbackContext Fallback context.
 * @returns {RelationOption} Single relation option.
 */
export const createSimpleOption = ({ templates, allFieldNames, context, fallbackContext }) => {
  const { slug } = context;
  const { _displayField, _valueField, _searchField } = templates;
  const { content, locales, defaultLocale, identifierField } = fallbackContext;

  const replacers = Object.fromEntries(
    allFieldNames.map((fieldName) => [
      fieldName,
      getFieldReplacement(fieldName, context, fallbackContext),
    ]),
  );

  let label = _displayField;
  let value = _valueField;
  let searchValue = _searchField;

  Object.entries(replacers).forEach(([key, val]) => {
    label = label.replaceAll(`{{${key}}}`, val);
    value = value.replaceAll(`{{${key}}}`, val);
    searchValue = searchValue.replaceAll(`{{${key}}}`, val);
  });

  // Handle empty label fallback
  if (!label || label.trim() === '') {
    label =
      getEntrySummaryFromContent(content, { identifierField }) ||
      getEntrySummaryFromContent(locales[defaultLocale]?.content || {}, { identifierField }) ||
      slug;
  }

  return {
    label: label || '',
    value: value || slug,
    searchValue: searchValue || label || '',
  };
};

/**
 * Analyze list field configurations and group them by base field name.
 * @internal
 * @param {string[]} allFieldNames All field names.
 * @param {GetFieldArgs} getFieldArgs Arguments for getField function.
 * @returns {Map<string, [string, any][]>} Grouped list field configurations.
 */
export const analyzeListFields = (allFieldNames, getFieldArgs) => {
  const listFieldConfigs = new Map();
  const baseFieldGroups = new Map();

  // Analyze all list fields and get their configurations
  allFieldNames
    .filter((fieldName) => fieldName.includes('*'))
    .forEach((fieldName) => {
      const baseFieldName = fieldName.replace(/\.\*.*$/, '');
      const fieldConfigForList = getField({ ...getFieldArgs, keyPath: baseFieldName });

      listFieldConfigs.set(fieldName, {
        baseFieldName,
        fieldConfig: fieldConfigForList,
        isComplexListField: isComplexListField(fieldConfigForList),
      });
    });

  // Group entries by base field name
  [...listFieldConfigs.entries()].forEach(([fieldName, config]) => {
    const { baseFieldName } = config;

    if (!baseFieldGroups.has(baseFieldName)) {
      baseFieldGroups.set(baseFieldName, []);
    }

    baseFieldGroups.get(baseFieldName).push([fieldName, config]);
  });

  return baseFieldGroups;
};

/**
 * Cache of pre-compiled regexes for {@link processSingleSubfieldList}, keyed by base field name.
 * @type {Map<string, RegExp>}
 */
const singleSubfieldRegexCache = new Map();

/**
 * Process single subfield list fields (e.g., `skills.*`).
 * @internal
 * @param {object} params Parameters.
 * @param {string} params.baseFieldName Base field name.
 * @param {[string, any][]} params.groupEntries Group entries.
 * @param {FlattenedEntryContent} params.content Entry content.
 * @param {TemplateStrings} params.templates Template strings.
 * @param {string[]} params.allFieldNames All field names.
 * @param {ReplacementContext} params.context Replacement context.
 * @param {FallbackContext} params.fallbackContext Fallback context.
 * @returns {RelationOption[]} One option per list item.
 */
export const processSingleSubfieldList = ({
  baseFieldName,
  groupEntries,
  content,
  templates,
  allFieldNames,
  context,
  fallbackContext,
}) => {
  const { _displayField, _valueField, _searchField } = templates;
  let regex = singleSubfieldRegexCache.get(baseFieldName);

  if (!regex) {
    regex = new RegExp(`^${escapeRegExp(baseFieldName)}.\\d+$`);
    singleSubfieldRegexCache.set(baseFieldName, regex);
  }

  const items = Object.entries(content)
    .filter(([k]) => regex.test(k))
    .map(([k, v]) => {
      // The filter above guarantees the regex matches, so `indexMatch` is always non-null
      const indexMatch = /** @type {RegExpMatchArray} */ (k.match(/\.(\d+)$/));

      return { index: parseInt(indexMatch[1], 10), value: v };
    })
    .sort((a, b) => a.index - b.index);

  return items.map(({ value: itemValue }) => {
    // Replace all wildcards for this base field with the current item value
    const processedTemplates = {
      label: _displayField,
      value: _valueField,
      searchValue: _searchField,
    };

    groupEntries.forEach(([fieldName]) => {
      processedTemplates.label = processedTemplates.label.replaceAll(`{{${fieldName}}}`, itemValue);
      processedTemplates.value = processedTemplates.value.replaceAll(`{{${fieldName}}}`, itemValue);
      processedTemplates.searchValue = processedTemplates.searchValue.replaceAll(
        `{{${fieldName}}}`,
        itemValue,
      );
    });

    const { label, value, searchValue } = replaceTemplateFields(
      processedTemplates,
      allFieldNames.filter((name) => !name.includes('*')),
      context,
      fallbackContext,
    );

    return {
      label: label || '',
      value: value || context.slug,
      searchValue: searchValue || label || '',
    };
  });
};

/**
 * Regex to match complex list fields with subfields.
 * Examples: `cities.*.name` or `colors.customColors.*.colorName`.
 * @type {RegExp}
 */
const COMPLEX_LIST_FIELD_REGEX = /^(.+)\.\*\.(.+)$/;
/**
 * Cache of index-matching regexes for {@link processComplexListField}, keyed by
 * `"${baseFieldName}:${subKey}"`.
 * @type {Map<string, RegExp>}
 */
const complexListIndexRegexCache = new Map();

/**
 * Get the subfield match from group entries.
 * @internal
 * @param {[string, any][]} groupEntries Group entries.
 * @returns {RegExpMatchArray | null} Subfield match.
 */
export const getSubFieldMatch = (groupEntries) => {
  /** @type {RegExpMatchArray | null} */
  let subFieldMatch = null;

  groupEntries.some(([fieldName]) => {
    subFieldMatch = fieldName.match(COMPLEX_LIST_FIELD_REGEX);

    return !!subFieldMatch;
  });

  return subFieldMatch;
};

/**
 * Process complex list fields (e.g., `cities.*.name`).
 * @internal
 * @param {object} params Parameters.
 * @param {[string, any][]} params.groupEntries Group entries.
 * @param {FlattenedEntryContent} params.content Entry content.
 * @param {TemplateStrings} params.templates Template strings.
 * @param {string[]} params.allFieldNames All field names.
 * @param {ReplacementContext} params.context Replacement context.
 * @param {FallbackContext} params.fallbackContext Fallback context.
 * @returns {RelationOption[]} Array of options, one for each list item.
 */
export const processComplexListField = ({
  groupEntries,
  content,
  templates,
  allFieldNames,
  context,
  fallbackContext,
}) => {
  const [, baseFieldNameForList, subKey] = getSubFieldMatch(groupEntries) ?? [];

  if (!baseFieldNameForList) {
    return [];
  }

  const cacheKey = `${baseFieldNameForList}:${subKey}`;
  let indexRegex = complexListIndexRegexCache.get(cacheKey);

  if (!indexRegex) {
    const escapedBase = escapeRegExp(baseFieldNameForList);
    const escapedSub = escapeRegExp(subKey);

    // indexRegex subsumes the old filter-only `regex` (same semantics; `[0-9]+` ≡ `\d+` in JS
    // without the `u` flag), so one regex construction per call is saved.
    indexRegex = new RegExp(`^${escapedBase}.([0-9]+).${escapedSub}$`);
    complexListIndexRegexCache.set(cacheKey, indexRegex);
  }

  const listValues = Object.entries(content)
    .filter(([k]) => indexRegex.test(k))
    .map(([k, v]) => {
      // The filter above guarantees `indexRegex` matches, so `indexMatch` is always non-null
      const indexMatch = /** @type {RegExpMatchArray} */ (k.match(indexRegex));

      return { index: parseInt(indexMatch[1], 10), value: v };
    })
    .sort((a, b) => a.index - b.index);

  const { _displayField, _valueField, _searchField } = templates;

  return listValues.map(({ index }) => {
    // Replace all wildcards for this base field with the current list item
    const processedTemplates = {
      label: _displayField,
      value: _valueField,
      searchValue: _searchField,
    };

    groupEntries.forEach(([wildcardFieldName]) => {
      const wildcardMatch = wildcardFieldName.match(COMPLEX_LIST_FIELD_REGEX);

      if (wildcardMatch) {
        const [, baseFieldName, subFieldKey] = wildcardMatch;
        const currentItemValue = content[`${baseFieldName}.${index}.${subFieldKey}`] || '';

        processedTemplates.label = processedTemplates.label.replaceAll(
          `{{${wildcardFieldName}}}`,
          currentItemValue,
        );
        processedTemplates.value = processedTemplates.value.replaceAll(
          `{{${wildcardFieldName}}}`,
          currentItemValue,
        );
        processedTemplates.searchValue = processedTemplates.searchValue.replaceAll(
          `{{${wildcardFieldName}}}`,
          currentItemValue,
        );
      }
    });

    const { label, value, searchValue } = replaceTemplateFields(
      processedTemplates,
      allFieldNames.filter((name) => !name.includes('*')),
      context,
      fallbackContext,
    );

    return {
      label: label || '',
      value: value || context.slug,
      searchValue: searchValue || label || '',
    };
  });
};

/**
 * Process all list fields for an entry.
 * @internal
 * @param {object} params Parameters.
 * @param {Map<string, [string, any][]>} params.baseFieldGroups Grouped configs.
 * @param {FlattenedEntryContent} params.content Entry content.
 * @param {TemplateStrings} params.templates Template strings.
 * @param {string[]} params.allFieldNames All field names.
 * @param {ReplacementContext} params.context Replacement context.
 * @param {FallbackContext} params.fallbackContext Fallback context.
 * @returns {{ results: RelationOption[], hasProcessedListFields: boolean }} Results.
 */
export const processListFields = ({
  baseFieldGroups,
  content,
  templates,
  allFieldNames,
  context,
  fallbackContext,
}) => {
  /** @type {RelationOption[]} */
  const results = [];
  let hasProcessedListFields = false;

  baseFieldGroups.forEach((groupEntries, baseFieldName) => {
    if (groupEntries.length === 0) {
      return;
    }

    const [, firstConfig] = groupEntries[0];

    const args = {
      groupEntries,
      content,
      templates,
      allFieldNames,
      context,
      fallbackContext,
    };

    const options = firstConfig.isComplexListField
      ? processComplexListField({ ...args })
      : processSingleSubfieldList({ ...args, baseFieldName });

    results.push(...options);
    hasProcessedListFields = true;
  });

  return { results, hasProcessedListFields };
};

/**
 * Process a single entry to generate relation options.
 * @internal
 * @param {object} params Parameters.
 * @param {Entry} params.refEntry Reference entry.
 * @param {FlattenedEntryContent} params.content Entry content.
 * @param {InternalCollection} params.collection Collection configuration.
 * @param {TemplateStrings} params.templates Template strings.
 * @param {string[]} params.allFieldNames All field names.
 * @param {boolean} params.hasListFields Whether entry has list fields.
 * @param {string} params.collectionName Collection name.
 * @param {string} [params.fileName] File name.
 * @param {InternalLocaleCode} params.locale Current locale.
 * @param {string} params.identifierField Identifier field.
 * @param {InternalLocaleCode} params.defaultLocale Default locale.
 * @returns {RelationOption[]} Array of relation options.
 */
export const processEntry = ({
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
}) => {
  const { slug, locales } = refEntry;
  const isIndexFile = isCollectionIndexFile(collection, refEntry);
  /** @type {GetFieldArgs} */
  const getFieldArgs = { collectionName, fileName, isIndexFile, keyPath: '' };

  /**
   * Wrapper for {@link getFieldDisplayValue}.
   * @param {FieldKeyPath} keyPath Field key path.
   * @param {InternalLocaleCode} [_locale] Target locale.
   * @returns {string} Display value.
   */
  const getDisplayValue = (keyPath, _locale) =>
    getFieldDisplayValue({
      ...getFieldArgs,
      keyPath,
      valueMap: _locale ? locales[_locale].content : content,
      locale: _locale ?? locale,
    });

  const context = { slug, locale, getDisplayValue };
  const fallbackContext = { content, locales, defaultLocale, identifierField };

  if (!hasListFields) {
    return [createSimpleOption({ templates, allFieldNames, context, fallbackContext })];
  }

  // Handle list fields
  const baseFieldGroups = analyzeListFields(allFieldNames, getFieldArgs);

  const { results, hasProcessedListFields } = processListFields({
    baseFieldGroups,
    content,
    templates,
    allFieldNames,
    context,
    fallbackContext,
  });

  if (hasProcessedListFields) {
    return results;
  }

  const { _displayField, _valueField, _searchField } = templates;

  // Fallback for complex multi-list scenarios or unhandled cases
  const processedTemplates = {
    label: _displayField,
    value: _valueField,
    searchValue: _searchField,
  };

  const { label, value, searchValue } = replaceTemplateFields(
    processedTemplates,
    allFieldNames.filter((name) => !name.includes('*')),
    context,
    fallbackContext,
  );

  return [
    {
      label: label || '',
      value: value || slug,
      searchValue: searchValue || label || '',
    },
  ];
};

/**
 * Get options for a Relation field.
 * @param {InternalLocaleCode} locale Current locale.
 * @param {RelationField} fieldConfig Field configuration.
 * @param {Entry[]} refEntries Referenced entries.
 * @returns {RelationOption[]} Options.
 */
export const getOptions = (locale, fieldConfig, refEntries) => {
  // Use object identity for `fieldConfig` and `refEntries` instead of `JSON.stringify`, which would
  // serialize the entire entries array (potentially hundreds of entries × many fields).
  const cacheKey = `${locale}|${getObjectId(fieldConfig)}|${getObjectId(refEntries)}`;
  const cache = optionCacheMap.get(cacheKey);

  if (cache) {
    return cache;
  }

  const { collection: collectionName, file: fileName, filters } = fieldConfig;
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
  const entryFilters = filters ?? [];
  const templates = prepareFieldTemplates(fieldConfig, identifierField);
  const { allFieldNames, hasListFields } = templates;
  const filteredEntries = filterAndPrepareEntries(refEntries, locale, fileName, entryFilters);

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
  const refOptions = getOptions(locale, fieldConfig, refEntries);
  /**
   * Get the label by value.
   * @param {any} _value Stored value.
   * @returns {string} Label.
   */
  const getLabel = (_value) => refOptions.find((o) => o.value === _value)?.label || _value;

  if (multiple) {
    const values = Object.entries(valueMap)
      .filter(([key]) => key.match(`^${escapeRegExp(keyPath)}\\.\\d+$`))
      .map(([, _value]) => _value);

    return values.map(getLabel);
  }

  return getLabel(valueMap[keyPath]);
};
