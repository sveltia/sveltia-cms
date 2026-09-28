import { isObject } from '@sveltia/utils/object';
import equal from 'fast-deep-equal';

import {
  filterRealValues,
  INTERNAL_PROP_REGEX,
  suspendAutoDuplication,
} from '$lib/services/contents/draft';
import { getInheritedI18nOption } from '$lib/services/contents/draft/create/proxy.svelte';
import { populateDefaultValue } from '$lib/services/contents/draft/defaults';
import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';
import { deleteSubtree } from '$lib/services/contents/entry/subtree';
import { syncAllDuplicateKeys } from '$lib/services/contents/fields/key-value/duplicate-keys';
import { isFieldTranslatable } from '$lib/services/contents/i18n/fields';

/**
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * LocaleContentMap,
 * } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * FieldWithSubFields,
 * FieldWithTypes,
 * ObjectField,
 * } from '$lib/types/public';
 */

/**
 * Field types whose value a user doesn’t enter, so it’s kept when the field, or the Object field
 * holding it, is cleared or restored to its default value: a Hidden field holds a value set by the
 * developer, a UUID field identifies the entry or object, and a Compute field is derived from the
 * other fields anyway.
 */
const PRESERVED_FIELD_TYPES = ['compute', 'hidden', 'uuid'];

/**
 * @typedef {object} ResetOptions
 * @property {boolean} [restore] Whether to restore the default values rather than clearing them.
 */

/**
 * @typedef {object} ResetContentArgs
 * @property {FlattenedEntryContent} content Flattened content for the locale, modified in place.
 * @property {Field} fieldConfig Field configuration.
 * @property {FieldKeyPath} keyPath Field key path.
 * @property {InternalLocaleCode} locale Locale of the content.
 * @property {InternalLocaleCode} defaultLocale Default locale of the entry draft.
 * @property {Field['i18n']} [inheritedI18n] `i18n` option of the nearest ancestor field that has
 * one. A field without the option of its own is duplicated along with an ancestor using the
 * `duplicate` strategy, but it’s only translatable with an `i18n` option of its own.
 * @property {boolean} [mirror] Whether the content belongs to another locale than the one being
 * reset, which mirrors the default locale’s values of the duplicated fields. Only those fields
 * are reset then.
 * @property {boolean} [restore] Whether to restore the default values rather than clearing them.
 */

/**
 * Reset the value of the given field in the given content, recursing into the subfields of an
 * Object field, whose type is kept along with the object itself.
 *
 * Clearing leaves a List field without items and a KeyValue field without pairs, although the
 * editor of a KeyValue field or a List field without subfields still shows a blank row to type
 * into. Any other field gets the value it would have without a default, e.g. an empty string or
 * `false`. Restoring gives every field the value a new entry would have instead, taking the
 * `default` option into account.
 *
 * The subfields the user can’t edit in the locale are left alone, as are the read-only ones and
 * those listed in {@link PRESERVED_FIELD_TYPES}.
 * @param {ResetContentArgs} args Arguments.
 */
const resetContent = (args) => {
  const { content, fieldConfig, keyPath, locale, defaultLocale, inheritedI18n } = args;
  const { mirror = false, restore = false } = args;
  const { widget: fieldType = 'string', i18n: ownI18n } = fieldConfig;
  const i18n = ownI18n ?? inheritedI18n;

  if (PRESERVED_FIELD_TYPES.includes(fieldType) || /** @type {any} */ (fieldConfig).readonly) {
    return;
  }

  // The subfields of an Object field are checked one by one, as their `i18n` options can differ
  if (fieldType === 'object') {
    // A `null` value means the optional Object field is collapsed, so it has nothing to reset
    if (content[keyPath] === null) {
      return;
    }

    const { fields } = /** @type {FieldWithSubFields} */ (fieldConfig);
    const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (fieldConfig);
    const { default: objectDefault } = /** @type {ObjectField} */ (fieldConfig);
    const type = content[`${keyPath}.${typeKey}`];
    const subFields = fields ?? types?.find(({ name }) => name === type)?.fields ?? [];

    subFields.forEach((subField) => {
      // The default value of the Object field as a whole takes precedence over the subfield’s own
      const subFieldConfig =
        restore && isObject(objectDefault) && subField.name in objectDefault
          ? /** @type {Field} */ ({ ...subField, default: objectDefault[subField.name] })
          : subField;

      resetContent({
        ...args,
        fieldConfig: subFieldConfig,
        keyPath: `${keyPath}.${subField.name}`,
        inheritedI18n: i18n,
      });
    });

    return;
  }

  const resettable = mirror
    ? // Another locale follows the default locale where the field is duplicated
      i18n === 'duplicate'
    : // A field that isn’t translatable follows the default locale, so it can’t be edited in
      // another locale
      locale === defaultLocale || isFieldTranslatable(ownI18n);

  if (!resettable) {
    return;
  }

  deleteSubtree(content, keyPath);

  if (!restore) {
    if (fieldType === 'keyvalue') {
      // No pairs, just the placeholder the editor stores for an empty KeyValue field, so that the
      // field still gets validated
      content[keyPath] = null;

      return;
    }

    if (fieldType === 'list') {
      // An empty list, even for a required List field limited to one item, which would get an
      // item from its default value
      content[keyPath] = [];

      return;
    }
  }

  populateDefaultValue({
    content,
    keyPath,
    // With the `i18n` option that applies to the field, so a value duplicated along with an
    // ancestor is written in another locale as well. Clearing ignores the default value
    fieldConfig: /** @type {Field} */ ({
      ...fieldConfig,
      i18n,
      ...(restore ? {} : { default: undefined }),
    }),
    locale,
    defaultLocale,
    dynamicValues: {},
  });
};

/**
 * Reset the given field in a locale of the given value store and, if that’s the default locale,
 * in the other locales where the field is duplicated.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.valueStore Value store keyed by locale, modified in place.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Locale to reset the field in.
 * @param {InternalLocaleCode} args.defaultLocale Default locale of the entry draft.
 * @param {Field['i18n']} [args.inheritedI18n] `i18n` option that applies to the field.
 * @param {boolean} [args.restore] Whether to restore the default values rather than clearing them.
 */
const resetFieldInStore = ({ valueStore, locale, ...args }) => {
  resetContent({ ...args, content: valueStore[locale], locale });

  if (locale === args.defaultLocale) {
    Object.entries(valueStore).forEach(([otherLocale, content]) => {
      if (otherLocale !== locale) {
        resetContent({ ...args, content, locale: otherLocale, mirror: true });
      }
    });
  }
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
 * Check whether resetting the given field would change anything in the given locale.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.valueMap Flattened content for the locale.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Locale of the content.
 * @param {InternalLocaleCode} args.defaultLocale Default locale of the entry draft.
 * @param {boolean} [args.restore] Whether to restore the default values rather than clearing them.
 * @returns {boolean} Result.
 */
export const canResetField = ({ valueMap, restore = false, ...args }) => {
  const values = getFieldValues(valueMap, args.keyPath);
  const resetValues = { ...values };

  resetContent({ ...args, content: resetValues, restore });

  return !equal(values, resetValues);
};

/**
 * Clear the value of the given field in the entry draft, or restore its default value, so the
 * user can start over. See {@link resetContent} for what that means for each field type. Resetting
 * a field in the default locale resets it in the other locales as well where it’s duplicated,
 * whether with its own `duplicate` strategy or along with an ancestor’s.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Locale to reset the field in.
 * @param {boolean} [args.restore] Whether to restore the default values rather than clearing them.
 */
export const resetField = ({ draft, fieldConfig, keyPath, locale, restore = false }) => {
  const { collectionName, fileName, isIndexFile, currentValues, defaultLocale } = draft;
  const getFieldArgs = { collectionName, fileName, isIndexFile };

  // The other locales are reset here rather than by the value proxy, which copies a value to them
  // as it’s written, as the proxy can’t tell which field a List item or a KeyValue pair belongs to
  suspendAutoDuplication(() => {
    resetFieldInStore({
      valueStore: currentValues,
      fieldConfig,
      keyPath,
      locale,
      defaultLocale,
      restore,
      inheritedI18n: getInheritedI18nOption({
        fieldConfig,
        getFieldArgs: { ...getFieldArgs, keyPath, valueMap: currentValues[locale] },
      }),
    });

    // The keys of a KeyValue field using the `duplicate_keys` i18n strategy, whether it’s the
    // reset field or one nested in it, have to be updated in the other locales as well
    if (locale === defaultLocale) {
      syncAllDuplicateKeys({ valueStore: currentValues, defaultLocale, getFieldArgs });
    }
  });
};

/**
 * Get the locales to reset in the given draft.
 * @param {EntryDraft} draft Entry draft.
 * @param {InternalLocaleCode} [locale] Locale to reset. If omitted, every enabled locale.
 * @returns {InternalLocaleCode[]} Locales.
 */
const getTargetLocales = ({ currentValues, currentLocales }, locale) =>
  locale ? [locale] : Object.keys(currentValues).filter((_locale) => currentLocales[_locale]);

/**
 * Reset every field of the given value store in the given locales.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.valueStore Value store keyed by locale, modified in place.
 * @param {Field[]} args.fields Fields of the entry.
 * @param {InternalLocaleCode[]} args.locales Locales to reset.
 * @param {InternalLocaleCode} args.defaultLocale Default locale of the entry draft.
 * @param {boolean} args.restore Whether to restore the default values rather than clearing them.
 */
const resetAllFields = ({ valueStore, fields, locales, defaultLocale, restore }) => {
  locales.forEach((locale) => {
    fields.forEach((fieldConfig) => {
      resetFieldInStore({
        valueStore,
        fieldConfig,
        keyPath: fieldConfig.name,
        locale,
        defaultLocale,
        restore,
      });
    });
  });
};

/**
 * Check whether resetting every field of the given entry draft would change anything.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} [args.locale] Locale to reset. If omitted, every enabled locale.
 * @param {boolean} [args.restore] Whether to restore the default values rather than clearing them.
 * @returns {boolean} Result.
 */
export const canResetEntry = ({ draft, locale, restore = false }) => {
  const { fields, currentValues, defaultLocale } = draft;

  /**
   * Take a plain copy of the current values, without the internal properties.
   * @returns {LocaleContentMap} Copy.
   */
  const copyValues = () =>
    Object.fromEntries(
      Object.entries(currentValues).map(([_locale, valueMap]) => [
        _locale,
        filterRealValues(valueMap),
      ]),
    );

  const values = copyValues();
  const resetValues = copyValues();

  resetAllFields({
    valueStore: resetValues,
    fields,
    locales: getTargetLocales(draft, locale),
    defaultLocale,
    restore,
  });

  return !equal(values, resetValues);
};

/**
 * Clear every field of the given entry draft, or restore their default values. See
 * {@link resetContent} for what that means for each field type.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} [args.locale] Locale to reset. If omitted, every enabled locale.
 * Resetting the default locale resets the fields duplicated in the other locales as well.
 * @param {boolean} [args.restore] Whether to restore the default values rather than clearing them.
 */
export const resetEntry = ({ draft, locale, restore = false }) => {
  const { collectionName, fileName, isIndexFile, fields, currentValues, defaultLocale } = draft;
  const locales = getTargetLocales(draft, locale);

  suspendAutoDuplication(() => {
    resetAllFields({ valueStore: currentValues, fields, locales, defaultLocale, restore });

    if (locales.includes(defaultLocale)) {
      syncAllDuplicateKeys({
        valueStore: currentValues,
        defaultLocale,
        getFieldArgs: { collectionName, fileName, isIndexFile },
      });
    }
  });
};
