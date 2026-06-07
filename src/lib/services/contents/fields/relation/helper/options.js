import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';
import { getFieldReplacement } from '$lib/services/contents/fields/relation/helper/templates';

/**
 * @import { FlattenedEntryContent, InternalLocaleCode, RelationOption } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
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
