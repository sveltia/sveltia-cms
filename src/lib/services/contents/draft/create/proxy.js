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
 * @param {LocaleCode} args.sourceLocale Source locale.
 * @param {any} args.value Value to copy to other locales.
 */
const copyDefaultLocaleValue = ({ getFieldArgs, fieldConfig, sourceLocale, value }) => {
  const { keyPath } = getFieldArgs;

  Object.entries(/** @type {EntryDraft} */ (get(entryDraft)).currentValues).forEach(
    ([targetLocale, content]) => {
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
          value = value.replace(new RegExp(`^${sourceLocale}/`), `${targetLocale}/`);
        }
      }

      if (targetLocale !== sourceLocale && content[keyPath] !== value) {
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
  locale: sourceLocale,
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

      const valueMap = typeof getValueMap === 'function' ? getValueMap() : obj;
      /** @type {GetFieldArgs} */
      const getFieldArgs = { collectionName, fileName, keyPath, valueMap, isIndexFile };
      const fieldConfig = getField({ ...getFieldArgs });

      if (!fieldConfig) {
        return true;
      }

      const validity = get(entryDraft)?.validities?.[sourceLocale]?.[keyPath];

      // Update validity in real time if validation has already been performed
      if (validity) {
        // @todo Perform all the field validations, not just `valueMissing` for string fields
        if (typeof value === 'string' && isFieldRequired({ fieldConfig, locale: sourceLocale })) {
          validity.valueMissing = !value;
        }
      }

      // Copy value to other locales
      if (
        get(i18nAutoDupEnabled) &&
        fieldConfig.i18n === 'duplicate' &&
        sourceLocale === defaultLocale
      ) {
        copyDefaultLocaleValue({ getFieldArgs, fieldConfig, sourceLocale, value });
      }

      return true;
    },
  });
};
