import { unique } from '@sveltia/utils/array';

import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';
import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';
import { normalizeFieldName } from '$lib/services/contents/fields/relation/helpers/field-names';

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
 * Get the stored value of a field as a string, for the `value_field` template.
 * @param {FlattenedEntryContent | undefined} valueMap Entry content.
 * @param {FieldKeyPath} keyPath Field key path.
 * @returns {string} Stored value, or an empty string if the field has none. A `0` or `false` is a
 * value, not an empty field.
 */
const getStoredValue = (valueMap, keyPath) => {
  const value = valueMap?.[keyPath];

  return value === undefined || value === null ? '' : String(value);
};

/**
 * Get the replacement value for a field name based on standard field types. An empty field is
 * replaced with an empty string: falling back to the entry summary or slug here would put them in
 * the `value_field` template, storing a reference that doesn’t identify the entry, or repeat them
 * in a `display_fields` template. A label that comes out empty falls back to them instead; see
 * {@link getLabelFallback}.
 * @param {string} fieldName The field name to get replacement for.
 * @param {ReplacementContext} context Context object containing `slug`, `locale`, and
 * `getDisplayValue` function.
 * @param {FallbackContext} fallbackContext Fallback context for additional content.
 * @param {object} [options] Options.
 * @param {boolean} [options.stored] Whether to get the stored value rather than the display value.
 * The `value_field` template takes the stored value, so a reference matches the referenced field
 * as saved: a number without the thousands separators, the value of a Select field option rather
 * than its label, a date in its stored format, and so on.
 * @returns {string} The replacement value.
 */
export const getFieldReplacement = (
  fieldName,
  context,
  fallbackContext,
  { stored = false } = {},
) => {
  const { slug, locale, getDisplayValue } = context;
  const { content, locales, defaultLocale } = fallbackContext;

  if (fieldName === 'slug') {
    return slug;
  }

  if (fieldName === 'locale') {
    return locale;
  }

  const keyPath = stripFieldTagPrefix(fieldName);

  if (stored) {
    return (
      getStoredValue(content, keyPath) ||
      // A multi-file entry can lack a locale’s file, including the default locale’s
      getStoredValue(locales[defaultLocale]?.content, keyPath)
    );
  }

  return getDisplayValue(keyPath) || getDisplayValue(keyPath, defaultLocale) || '';
};

/**
 * Get the label of an option whose `display_fields` template comes out empty: the entry summary,
 * or the slug if the entry has none.
 * @param {ReplacementContext} context Replacement context.
 * @param {FallbackContext} fallbackContext Fallback context.
 * @returns {string} Label.
 */
export const getLabelFallback = (context, fallbackContext) => {
  const { content, locales, defaultLocale, identifierField } = fallbackContext;

  return (
    getEntrySummaryFromContent(content, { identifierField }) ||
    getEntrySummaryFromContent(locales[defaultLocale]?.content || {}, { identifierField }) ||
    context.slug
  );
};

/**
 * Replace all template tags in the given strings with actual values: the stored field values in the
 * value, and the display values in the label and search value. The value is left empty if
 * any tag in its template has no value, as such a value can’t identify the entry; the caller
 * leaves out an option without a value. The label and search value are trimmed, and the label
 * falls back to {@link getLabelFallback} if it comes out empty.
 * @param {RelationOption} templates Object containing `label`, `value`, and `searchValue`
 * templates.
 * @param {string[]} fieldNames Array of field names to replace.
 * @param {ReplacementContext} context Context object for replacements.
 * @param {FallbackContext} fallbackContext Fallback context for additional content.
 * @returns {RelationOption} Object with replaced `label`, `value`, and `searchValue`.
 */
export const replaceTemplateFields = (templates, fieldNames, context, fallbackContext) => {
  let { label, value, searchValue } = templates;
  let hasEmptyValueTag = false;

  fieldNames.forEach((fieldName) => {
    const tag = `{{${fieldName}}}`;
    const replacement = getFieldReplacement(fieldName, context, fallbackContext);

    if (value.includes(tag)) {
      const storedValue = getFieldReplacement(fieldName, context, fallbackContext, {
        stored: true,
      });

      if (!storedValue) {
        hasEmptyValueTag = true;
      }

      value = value.replaceAll(tag, () => storedValue);
    }

    label = label.replaceAll(tag, () => replacement);
    searchValue = searchValue?.replaceAll(tag, () => replacement) ?? '';
  });

  return {
    // Trim the spaces around an empty field, e.g. the second of the `display_fields` joined with
    // a space
    label: label.trim() || getLabelFallback(context, fallbackContext),
    value: hasEmptyValueTag ? '' : value,
    searchValue: searchValue.trim(),
  };
};

/**
 * Extract field names from template strings.
 * @param {string} template Template string with field names in {{}} brackets.
 * @returns {string[]} Array of field names.
 */
export const extractFieldNames = (template) => {
  /** @type {string[]} */
  const names = [];

  replaceTemplateTags(template, (_match, placeholder) => {
    names.push(placeholder);
    return '';
  });

  return names;
};

/**
 * Normalize and prepare field templates for processing.
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
