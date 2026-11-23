import { toRaw } from '@sveltia/utils/object';

import { suspendAutoDuplication } from '$lib/services/contents/draft';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import {
  copyDefaultLocaleValues,
  forEachTargetLocale,
} from '$lib/services/contents/draft/update/locale';
import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';

/**
 * @import {
 * DraftValueStoreKey,
 * EntryDraft,
 * InternalLocaleCode,
 * RemovedObjectValues,
 * } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * ObjectField,
 * ObjectFieldWithSubFields,
 * ObjectFieldWithTypes,
 * } from '$lib/types/public';
 */

/**
 * Add the subfields of an Object field to the entry draft, populated with their default values. For
 * a field with variable types, the type is written first and the subfields of that type are added.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {InternalLocaleCode} args.locale Locale being edited.
 * @param {FieldKeyPath} args.keyPath Key path of the Object field.
 * @param {ObjectField} args.fieldConfig Field configuration.
 * @param {string} [args.type] Variable type name. `undefined` if the field doesn’t have variable
 * types.
 */
export const addObjectFields = ({
  draft,
  valueStoreKey = 'currentValues',
  locale,
  keyPath,
  fieldConfig,
  type,
}) => {
  const { i18n = false } = fieldConfig;
  const { types, typeKey = 'type' } = /** @type {ObjectFieldWithTypes} */ (fieldConfig);
  const { fields } = /** @type {ObjectFieldWithSubFields} */ (fieldConfig);
  const valueStore = draft[valueStoreKey];
  /** @type {Field[]} */
  const subFields = (type ? types?.find(({ name }) => name === type)?.fields : fields) ?? [];
  // A rich text editor component’s values live in the document of the locale they’re edited in,
  // so its subfields get their defaults in every locale, with nothing to copy from the default
  // locale, unlike an entry field
  const defaultLocale = valueStoreKey === 'extraValues' ? locale : draft.defaultLocale;

  // Avoid triggering the Proxy’s i18n duplication strategy for descendant fields
  suspendAutoDuplication(() => {
    if (type) {
      forEachTargetLocale({ valueStore, locale, i18n, draft, keyPath }, (valueMap) => {
        valueMap[`${keyPath}.${typeKey}`] = type;
      });
    }

    const newContent = Object.fromEntries(
      Object.entries(getDefaultValues({ fields: subFields, locale, defaultLocale })).map(
        ([_keyPath, value]) => [`${keyPath}.${_keyPath}`, value],
      ),
    );

    const newValueMap =
      locale === defaultLocale
        ? newContent
        : copyDefaultLocaleValues({
            draft,
            content: newContent,
            targetLanguage: locale,
            keyPathPrefix: keyPath,
          });

    forEachTargetLocale({ valueStore, locale, i18n, draft, keyPath }, (valueMap) => {
      // Apply the new values through the Proxy, keeping any value already there
      Object.assign(valueMap, toRaw({ ...newValueMap, ...valueMap }));

      // Disable validation
      delete valueMap[keyPath];
    });
  });
};

/**
 * Remove the subfields of an Object field from the entry draft.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {InternalLocaleCode} args.locale Locale being edited.
 * @param {FieldKeyPath} args.keyPath Key path of the Object field.
 * @param {ObjectField} args.fieldConfig Field configuration.
 * @returns {RemovedObjectValues} Removed values, so they can be put back with
 * {@link restoreObjectFields}. They’re keyed by their key path relative to the object’s, as the
 * object may have moved by then, e.g. along with a list item.
 */
export const removeObjectFields = ({
  draft,
  valueStoreKey = 'currentValues',
  locale,
  keyPath,
  fieldConfig,
}) => {
  const { i18n = false } = fieldConfig;
  /** @type {RemovedObjectValues} */
  const removedValues = {};

  forEachTargetLocale(
    { valueStore: draft[valueStoreKey], locale, i18n, draft, keyPath },
    (valueMap, targetLocale) => {
      /** @type {Record<FieldKeyPath, any>} */
      const values = {};

      // Assign `null` before deleting each property, so the draft proxy can revalidate the field.
      // The value map is the draft’s live map, which is mutated right below, so its key paths have
      // to be read as they are right now
      getKeysByPrefix(valueMap, `${keyPath}.`, { live: true }).forEach((_keyPath) => {
        values[_keyPath.slice(keyPath.length)] = toRaw(valueMap[_keyPath]);
        valueMap[_keyPath] = null;
        delete valueMap[_keyPath];
      });

      removedValues[targetLocale] = values;
      // Enable validation
      valueMap[keyPath] = null;
    },
  );

  return removedValues;
};

/**
 * Put back the subfields of an Object field removed with {@link removeObjectFields}, in the locales
 * they were removed from, under the object’s current key path.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Key path of the Object field.
 * @param {RemovedObjectValues} args.removedValues Removed values.
 */
export const restoreObjectFields = ({
  draft,
  valueStoreKey = 'currentValues',
  keyPath,
  removedValues,
}) => {
  // Avoid triggering the Proxy’s i18n duplication strategy for descendant fields, as the values are
  // put back in each locale they were removed from
  suspendAutoDuplication(() => {
    Object.entries(removedValues).forEach(([locale, values]) => {
      const valueMap = draft[valueStoreKey][locale];

      // The locale may have been disabled since
      if (!valueMap) {
        return;
      }

      Object.entries(values).forEach(([suffix, value]) => {
        valueMap[`${keyPath}${suffix}`] = value;
      });

      // Disable validation
      delete valueMap[keyPath];
    });
  });
};
