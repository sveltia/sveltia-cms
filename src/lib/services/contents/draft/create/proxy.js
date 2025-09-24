import { get } from 'svelte/store';

import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';
import { getField, isFieldRequired } from '$lib/services/contents/entry/fields';

/**
 * @import { EntryDraft, FlattenedEntryContent, GetFieldArgs } from '$lib/types/private';
 * @import { Field, FieldKeyPath, LocaleCode, RelationField } from '$lib/types/public';
 */

/**
 * Copy the default locale value to other locales if the field’s i18n strategy is `duplicate`.
 * @param {object} args Arguments.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {LocaleCode} args.sourceLanguage Source locale.
 * @param {any} args.value Value to copy to other locales.
 */
const copyDefaultLocaleValue = ({ getFieldArgs, fieldConfig, sourceLanguage, value }) => {
  const { keyPath } = getFieldArgs;

  Object.entries(/** @type {EntryDraft} */ (get(entryDraft)).currentValues).forEach(
    ([targetLanguage, content]) => {
      // Don’t duplicate the value if the parent object doesn’t exist
      if (keyPath.includes('.')) {
        const { path: parentKeyPath } = keyPath.match(/(?<path>.+?)\.[^.]*$/)?.groups ?? {};

        if (
          !Object.keys(content).some((_keyPath) => _keyPath.startsWith(`${parentKeyPath}.`)) &&
          !getField({ ...getFieldArgs, keyPath: parentKeyPath })
        ) {
          return;
        }
      }

      // Support special case for the Relation field: if the `value_field` option is something
      // like `{{locale}}/{{slug}}`, replace the source locale in the value with target locale
      if (fieldConfig.widget === 'relation') {
        const { value_field: valueField = '{{slug}}' } = /** @type {RelationField} */ (fieldConfig);

        if (valueField.startsWith('{{locale}}/')) {
          value = value.replace(new RegExp(`^${sourceLanguage}/`), `${targetLanguage}/`);
        }
      }

      if (targetLanguage !== sourceLanguage && content[keyPath] !== value) {
        content[keyPath] = value;
      }
    },
  );
};

/**
 * Create a Proxy that automatically copies a field value to other locale if the field’s i18n
 * strategy is “duplicate.”.
 * @param {object} args Arguments.
 * @param {EntryDraft | any} args.draft Entry draft.
 * @param {string} args.locale Source locale.
 * @param {object} [args.target] Target object.
 * @param {() => FlattenedEntryContent} [args.getValueMap] Optional function to get an object
 * holding the current entry values. It will be used for the `valueMap` argument of
 * {@link getField}. If omitted, the proxy target will be used instead.
 * @returns {any} Created proxy.
 */
export const createProxy = ({
  draft: { collectionName, fileName, isIndexFile },
  locale: sourceLanguage,
  target = {},
  getValueMap = undefined,
}) => {
  const collection = getCollection(collectionName);

  const collectionFile =
    collection && fileName ? getCollectionFile(collection, fileName) : undefined;

  if (!collection || (fileName && !collectionFile)) {
    return undefined;
  }

  const {
    defaultLocale,
    canonicalSlug: { key: canonicalSlugKey },
  } = (collectionFile ?? collection)._i18n;

  /**
   * Check if auto-duplication should be performed for the given field.
   * @param {Field} fieldConfig Field configuration.
   * @returns {boolean} True if auto-duplication should be performed.
   */
  const shouldAutoDuplicate = (fieldConfig) =>
    get(i18nAutoDupEnabled) && fieldConfig.i18n === 'duplicate' && sourceLanguage === defaultLocale;

  /**
   * Get field configuration for the given key path.
   * @param {object} obj The proxy target object.
   * @param {FieldKeyPath} keyPath The field key path.
   * @returns {{ valueMap: any, getFieldArgs: GetFieldArgs, fieldConfig: Field | undefined }}
   * Field info.
   */
  const getFieldInfo = (obj, keyPath) => {
    const valueMap = typeof getValueMap === 'function' ? getValueMap() : obj;
    /** @type {GetFieldArgs} */
    const getFieldArgs = { collectionName, fileName, keyPath, valueMap, isIndexFile };
    const fieldConfig = getField({ ...getFieldArgs });

    return { valueMap, getFieldArgs, fieldConfig };
  };

  return new Proxy(/** @type {any} */ (target), {
    // eslint-disable-next-line jsdoc/require-jsdoc
    set: (obj, /** @type {FieldKeyPath} */ keyPath, value) => {
      if (obj[keyPath] !== value) {
        obj[keyPath] = value;
      }

      // Skip the rest in some cases
      if ([canonicalSlugKey].includes(keyPath)) {
        return true;
      }

      const { fieldConfig, getFieldArgs } = getFieldInfo(obj, keyPath);

      if (!fieldConfig) {
        return true;
      }

      const validity = get(entryDraft)?.validities?.[sourceLanguage]?.[keyPath];

      // Update validity in real time if validation has already been performed
      if (validity) {
        // @todo Perform all the field validations, not just `valueMissing` for string fields
        if (typeof value === 'string' && isFieldRequired({ fieldConfig, locale: sourceLanguage })) {
          validity.valueMissing = !value;
        }
      }

      // Copy value to other locales
      if (shouldAutoDuplicate(fieldConfig)) {
        copyDefaultLocaleValue({ getFieldArgs, fieldConfig, sourceLanguage, value });
      }

      return true;
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    deleteProperty: (obj, /** @type {FieldKeyPath} */ keyPath) => {
      delete obj[keyPath];

      const { fieldConfig } = getFieldInfo(obj, keyPath);

      if (!fieldConfig) {
        return true;
      }

      // Remove the property from other locales
      if (shouldAutoDuplicate(fieldConfig)) {
        Object.entries(/** @type {EntryDraft} */ (get(entryDraft)).currentValues).forEach(
          ([targetLanguage, content]) => {
            if (targetLanguage !== sourceLanguage && keyPath in content) {
              delete content[keyPath];
            }
          },
        );
      }

      return true;
    },
  });
};
