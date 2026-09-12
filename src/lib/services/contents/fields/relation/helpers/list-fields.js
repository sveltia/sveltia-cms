import { escapeRegExp } from '@sveltia/utils/string';

import { getField } from '$lib/services/contents/entry/fields';
import { isComplexListField } from '$lib/services/contents/fields/relation/helpers/field-names';
import { replaceTemplateFields } from '$lib/services/contents/fields/relation/helpers/templates';
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
 * Build the relation option for one list item: the given list wildcards in the templates are
 * replaced with the item’s values, then the remaining non-list fields are resolved.
 * @param {object} params Parameters.
 * @param {TemplateStrings} params.templates Template strings.
 * @param {[string, any][]} params.replacements Pairs of wildcard field name and item value.
 * @param {string[]} params.staticFieldNames Field names without a list wildcard.
 * @param {ReplacementContext} params.context Replacement context.
 * @param {FallbackContext} params.fallbackContext Fallback context.
 * @returns {RelationOption} Option.
 */
const buildListItemOption = ({
  templates,
  replacements,
  staticFieldNames,
  context,
  fallbackContext,
}) => {
  const { _displayField, _valueField, _searchField } = templates;

  /**
   * Replace all the list wildcards in a template with the item values.
   * @param {string} template Template string.
   * @returns {string} Processed template.
   */
  const replaceWildcards = (template) =>
    replacements.reduce(
      (result, [fieldName, itemValue]) => result.replaceAll(`{{${fieldName}}}`, itemValue),
      template,
    );

  const { label, value, searchValue } = replaceTemplateFields(
    {
      label: replaceWildcards(_displayField),
      value: replaceWildcards(_valueField),
      searchValue: replaceWildcards(_searchField),
    },
    staticFieldNames,
    context,
    fallbackContext,
  );

  return {
    label: label || '',
    value: value || context.slug,
    searchValue: searchValue || label || '',
  };
};

/**
 * Cache of pre-compiled regexes for {@link processSingleSubfieldList}, keyed by base field name.
 * @type {Map<string, RegExp>}
 */
const singleSubfieldRegexCache = new Map();

/**
 * Process single subfield list fields (e.g., `skills.*`).
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

  const staticFieldNames = allFieldNames.filter((name) => !name.includes('*'));

  return items.map(({ value: itemValue }) =>
    buildListItemOption({
      templates,
      // Replace all wildcards for this base field with the current item value
      replacements: groupEntries.map(([fieldName]) => [fieldName, itemValue]),
      staticFieldNames,
      context,
      fallbackContext,
    }),
  );
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

  const staticFieldNames = allFieldNames.filter((name) => !name.includes('*'));

  return listValues.map(({ index }) =>
    buildListItemOption({
      templates,
      // Replace all wildcards for this base field with the current list item’s subfield values
      replacements: groupEntries.flatMap(([wildcardFieldName]) => {
        const [, baseFieldName, subFieldKey] =
          wildcardFieldName.match(COMPLEX_LIST_FIELD_REGEX) ?? [];

        return baseFieldName
          ? [[wildcardFieldName, content[`${baseFieldName}.${index}.${subFieldKey}`] || '']]
          : [];
      }),
      staticFieldNames,
      context,
      fallbackContext,
    }),
  );
};

/**
 * Process all list fields for an entry.
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
