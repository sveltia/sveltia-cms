import { escapeRegExp } from '@sveltia/utils/string';

import { getField } from '$lib/services/contents/entry/fields';
import { isComplexListField } from '$lib/services/contents/fields/relation/helper/field-names';
import { replaceTemplateFields } from '$lib/services/contents/fields/relation/helper/templates';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import {
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalLocaleCode,
 * RelationOption,
 * } from '$lib/types/private';
 */

/**
 * @typedef {object} ReplacementContext
 * @property {string} slug The slug of the entry.
 * @property {InternalLocaleCode} locale The current locale.
 * @property {(keyPath: string, _locale?: InternalLocaleCode) => string} getDisplayValue
 * Function to get the display value of a field.
 */

/**
 * @typedef {object} FallbackContext
 * @property {FlattenedEntryContent} content Content of the entry.
 * @property {Record<InternalLocaleCode, FlattenedEntryContent>} locales Locales of the entry.
 * @property {InternalLocaleCode} defaultLocale Default locale of the entry.
 * @property {string} identifierField Identifier field for the entry.
 */

/**
 * @typedef {object} TemplateStrings
 * @property {string} _valueField Normalized value field template.
 * @property {string} _displayField Normalized display field template.
 * @property {string} _searchField Normalized search field template.
 * @property {string[]} allFieldNames All field names extracted from templates.
 * @property {boolean} hasListFields Whether any field names include a list wildcard (*).
 */

const LIST_KEY_PATH_MATCH_REGEX = /\.(\d+)$/;

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

  const regex = getOrCreate(
    singleSubfieldRegexCache,
    baseFieldName,
    () => new RegExp(`^${escapeRegExp(baseFieldName)}.\\d+$`),
  );

  const items = Object.entries(content)
    .filter(([k]) => regex.test(k))
    .map(([k, v]) => {
      // The filter above guarantees the regex matches, so `indexMatch` is always non-null
      const indexMatch = /** @type {RegExpMatchArray} */ (k.match(LIST_KEY_PATH_MATCH_REGEX));

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

  const indexRegex = getOrCreate(complexListIndexRegexCache, cacheKey, () => {
    const escapedBase = escapeRegExp(baseFieldNameForList);
    const escapedSub = escapeRegExp(subKey);

    // indexRegex subsumes the old filter-only `regex` (same semantics; `[0-9]+` ≡ `\d+` in JS
    // without the `u` flag), so one regex construction per call is saved.
    return new RegExp(`^${escapedBase}.([0-9]+).${escapedSub}$`);
  });

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
