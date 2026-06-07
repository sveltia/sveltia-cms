import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getFieldDisplayValue } from '$lib/services/contents/entry/fields';
import {
  analyzeListFields,
  processListFields,
} from '$lib/services/contents/fields/relation/helper/list-fields';
import { createSimpleOption } from '$lib/services/contents/fields/relation/helper/options';
import { replaceTemplateFields } from '$lib/services/contents/fields/relation/helper/templates';

/**
 * @import {
 * Entry,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalCollection,
 * InternalLocaleCode,
 * RelationOption,
 * } from '$lib/types/private';
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
