import equal from 'fast-deep-equal';

import { INTERNAL_PROP_REGEX, suspendAutoDuplication } from '$lib/services/contents/draft';
import { getInheritedI18nOption } from '$lib/services/contents/draft/create/proxy.svelte';
import { populateDefaultValue } from '$lib/services/contents/draft/defaults';
import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';
import { deleteSubtree } from '$lib/services/contents/entry/subtree';
import { syncAllDuplicateKeys } from '$lib/services/contents/fields/key-value/duplicate-keys';
import { isFieldTranslatable } from '$lib/services/contents/i18n/fields';

/**
 * @import { EntryDraft, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { Field, FieldKeyPath, FieldWithSubFields, FieldWithTypes } from '$lib/types/public';
 */

/**
 * Field types that can be cleared with the Clear option in the field options menu: the ones with
 * multiple inputs, which would be tedious to empty one by one.
 */
export const CLEARABLE_FIELD_TYPES = ['keyvalue', 'list', 'object'];

/**
 * Field types whose value a user doesn’t enter, so it’s kept when the Object field holding it is
 * cleared: a Hidden field holds a value set by the developer, a UUID field identifies the entry or
 * object, and a Compute field is derived from the other fields anyway.
 */
const PRESERVED_FIELD_TYPES = ['compute', 'hidden', 'uuid'];

/**
 * @typedef {object} ClearContentArgs
 * @property {FlattenedEntryContent} content Flattened content for the locale, modified in place.
 * @property {Field} fieldConfig Field configuration.
 * @property {FieldKeyPath} keyPath Field key path.
 * @property {InternalLocaleCode} locale Locale of the content.
 * @property {InternalLocaleCode} defaultLocale Default locale of the entry draft.
 * @property {Field['i18n']} [inheritedI18n] `i18n` option of the nearest ancestor field that has
 * one. A field without the option of its own is duplicated along with an ancestor using the
 * `duplicate` strategy, but it’s only translatable with an `i18n` option of its own.
 * @property {boolean} [mirror] Whether the content belongs to another locale than the one being
 * cleared, which mirrors the default locale’s values of the duplicated fields. Only those fields
 * are cleared then.
 */

/**
 * Empty the value of the given field in the given content, recursing into the subfields of an
 * Object field. A List field is left without items and a KeyValue field without pairs, although
 * the editor of a KeyValue field or a List field without subfields still shows a blank row to type
 * into. Any other field gets the value it would have without a default, e.g. an empty string or
 * `false`.
 * The subfields the user can’t edit in the locale are left alone, as are the read-only ones and
 * those listed in {@link PRESERVED_FIELD_TYPES}.
 * @param {ClearContentArgs} args Arguments.
 */
const clearContent = (args) => {
  const { content, fieldConfig, keyPath, locale, defaultLocale, inheritedI18n, mirror } = args;
  const { widget: fieldType = 'string', i18n: ownI18n } = fieldConfig;
  const i18n = ownI18n ?? inheritedI18n;

  if (PRESERVED_FIELD_TYPES.includes(fieldType) || /** @type {any} */ (fieldConfig).readonly) {
    return;
  }

  if (fieldType !== 'object') {
    const clearable = mirror
      ? // Another locale follows the default locale where the field is duplicated
        i18n === 'duplicate'
      : // A field that isn’t translatable follows the default locale, so it can’t be edited in
        // another locale
        locale === defaultLocale || isFieldTranslatable(ownI18n);

    if (!clearable) {
      return;
    }
  }

  // The subfields of an Object field are checked one by one, as their `i18n` options can differ
  if (fieldType === 'object') {
    // A `null` value means the optional Object field is collapsed, so it has nothing to clear
    if (content[keyPath] === null) {
      return;
    }

    const { fields } = /** @type {FieldWithSubFields} */ (fieldConfig);
    const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (fieldConfig);
    // The type of an Object field with variable types is kept, along with the object itself
    const type = content[`${keyPath}.${typeKey}`];
    const subFields = fields ?? types?.find(({ name }) => name === type)?.fields ?? [];

    subFields.forEach((subField) => {
      clearContent({
        ...args,
        fieldConfig: subField,
        keyPath: `${keyPath}.${subField.name}`,
        inheritedI18n: i18n,
      });
    });

    return;
  }

  deleteSubtree(content, keyPath);

  if (fieldType === 'keyvalue') {
    // No pairs, just the placeholder the editor stores for an empty KeyValue field, so that the
    // field still gets validated. The editor shows a blank row in their place, like the one of a
    // simple List field
    content[keyPath] = null;

    return;
  }

  if (fieldType === 'list') {
    // An empty list, even for a required List field limited to one item, which would get an item
    // from its default value
    content[keyPath] = [];

    return;
  }

  populateDefaultValue({
    content,
    keyPath,
    // Without the default value, and with the `i18n` option that applies to the field, so a value
    // duplicated along with an ancestor is written in another locale as well
    fieldConfig: /** @type {Field} */ ({ ...fieldConfig, default: undefined, i18n }),
    locale,
    defaultLocale,
    dynamicValues: {},
  });
};

/**
 * Get the values held by the given field, excluding the internal properties.
 * @param {FlattenedEntryContent} valueMap Flattened content for a locale.
 * @param {FieldKeyPath} keyPath Field key path.
 * @returns {FlattenedEntryContent} Values keyed by key path.
 */
const getFieldValues = (valueMap, keyPath) =>
  Object.fromEntries(
    [...(keyPath in valueMap ? [keyPath] : []), ...getKeysByPrefix(valueMap, `${keyPath}.`)]
      .filter((key) => !INTERNAL_PROP_REGEX.test(key) && valueMap[key] !== undefined)
      .map((key) => [key, valueMap[key]]),
  );

/**
 * Check whether clearing the given field would change anything, that is, whether it holds a value
 * that {@link clearField} would remove.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.valueMap Flattened content for the locale.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Locale of the content.
 * @param {InternalLocaleCode} args.defaultLocale Default locale of the entry draft.
 * @returns {boolean} Result.
 */
export const canClearField = ({ valueMap, fieldConfig, keyPath, locale, defaultLocale }) => {
  const values = getFieldValues(valueMap, keyPath);
  const clearedValues = { ...values };

  clearContent({ content: clearedValues, fieldConfig, keyPath, locale, defaultLocale });

  return !equal(values, clearedValues);
};

/**
 * Clear the value of the given field in the entry draft, so the user can start over. See
 * {@link clearContent} for what that means for each field type. Clearing a field in the default
 * locale clears it in the other locales as well where it’s duplicated, whether with its own
 * `duplicate` strategy or along with an ancestor’s.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Locale to clear the field in.
 */
export const clearField = ({ draft, fieldConfig, keyPath, locale }) => {
  const { collectionName, fileName, isIndexFile, currentValues, defaultLocale } = draft;
  const getFieldArgs = { collectionName, fileName, isIndexFile };

  const args = {
    fieldConfig,
    keyPath,
    defaultLocale,
    inheritedI18n: getInheritedI18nOption({
      fieldConfig,
      getFieldArgs: { ...getFieldArgs, keyPath, valueMap: currentValues[locale] },
    }),
  };

  // The other locales are cleared here rather than by the value proxy, which copies a value to them
  // as it’s written, as the proxy can’t tell which field a List item or a KeyValue pair belongs to
  suspendAutoDuplication(() => {
    clearContent({ ...args, content: currentValues[locale], locale });

    if (locale !== defaultLocale) {
      return;
    }

    Object.entries(currentValues).forEach(([otherLocale, content]) => {
      if (otherLocale !== locale) {
        clearContent({ ...args, content, locale: otherLocale, mirror: true });
      }
    });

    // The keys of a KeyValue field using the `duplicate_keys` i18n strategy, whether it’s the
    // cleared field or one nested in it, have to be removed from the other locales as well
    syncAllDuplicateKeys({ valueStore: currentValues, defaultLocale, getFieldArgs });
  });
};
