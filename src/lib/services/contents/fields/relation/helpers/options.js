import { replaceTemplateFields } from '$lib/services/contents/fields/relation/helpers/templates';

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
 * @param {object} params Parameters.
 * @param {TemplateStrings} params.templates Template strings.
 * @param {string[]} params.allFieldNames All field names to replace.
 * @param {ReplacementContext} params.context Replacement context.
 * @param {FallbackContext} params.fallbackContext Fallback context.
 * @returns {RelationOption} Single relation option. Its `value` is empty if the entry lacks a
 * field in the `value_field` template, so the option can’t refer to the entry.
 */
export const createSimpleOption = ({ templates, allFieldNames, context, fallbackContext }) => {
  const { _displayField, _valueField, _searchField } = templates;

  const { label, value, searchValue } = replaceTemplateFields(
    { label: _displayField, value: _valueField, searchValue: _searchField },
    allFieldNames,
    context,
    fallbackContext,
  );

  return { label, value, searchValue: searchValue || label };
};
