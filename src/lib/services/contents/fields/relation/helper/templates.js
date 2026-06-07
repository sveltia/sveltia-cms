import { unique } from '@sveltia/utils/array';

import { TEMPLATE_TAG_REPLACE_REGEX } from '$lib/services/common/template/constants';
import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';
import { normalizeFieldName } from '$lib/services/contents/fields/relation/helper/field-names';

/**
 * @import { FlattenedEntryContent, InternalLocaleCode, RelationOption } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField } from '$lib/types/public';
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
  [...template.matchAll(TEMPLATE_TAG_REPLACE_REGEX)].map((m) => m[1]);

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
