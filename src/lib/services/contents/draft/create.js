import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';
import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { getIndexFile, isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';
import { restoreBackupIfNeeded } from '$lib/services/contents/draft/backup';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { showDuplicateToast } from '$lib/services/contents/draft/editor';
import { getField, isFieldRequired } from '$lib/services/contents/entry/fields';
import { getDefaultValueMap as getHiddenFieldDefaultValueMap } from '$lib/services/contents/widgets/hidden/helper';
import { getInitialValue as getInitialUuidValue } from '$lib/services/contents/widgets/uuid/helper';

/**
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalCollection,
 * InternalCollectionFile,
 * LocaleContentMap,
 * LocaleExpanderMap,
 * } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * HiddenField,
 * LocaleCode,
 * RelationField,
 * UuidField,
 * } from '$lib/types/public';
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

/**
 * Create an entry draft.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection that the entry belongs to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {any} [args.originalEntry] Entry to be edited, or a partial {@link Entry} object.
 * @param {Record<string, string>} [args.dynamicValues] Dynamic default values for a new entry
 * passed through URL parameters.
 * @param {LocaleExpanderMap} [args.expanderStates] Expander UI state. Can be set when resetting an
 * entry draft.
 * @param {boolean} [args.isIndexFile] Whether to edit the collection’s index file.
 */
export const createDraft = ({
  collection,
  collectionFile,
  originalEntry = {},
  dynamicValues,
  expanderStates,
  isIndexFile = isCollectionIndexFile(collection, originalEntry),
}) => {
  const { name: collectionName, editor } = collection;
  const fileName = collectionFile?.name;
  const { id, slug, locales } = originalEntry;
  const isNew = id === undefined;
  const { fields: regularFields = [], _i18n } = collectionFile ?? collection;
  const indexFile = isIndexFile ? getIndexFile(collection) : undefined;
  const fields = indexFile?.fields ?? regularFields;

  const canPreview =
    indexFile?.editor?.preview ?? editor?.preview ?? get(siteConfig)?.editor?.preview ?? true;

  const {
    allLocales,
    initialLocales,
    defaultLocale,
    canonicalSlug: { key: canonicalSlugKey = 'translationKey' },
  } = _i18n;

  const enabledLocales = isNew
    ? initialLocales
    : allLocales.filter((locale) => !!locales?.[locale]?.content);

  const originalLocales = Object.fromEntries(
    allLocales.map((locale) => [locale, enabledLocales.includes(locale)]),
  );

  const originalSlugs = isNew
    ? {}
    : canonicalSlugKey in (locales?.[defaultLocale]?.content ?? {})
      ? Object.fromEntries(allLocales.map((locale) => [locale, locales?.[locale]?.slug]))
      : { _: locales?.[defaultLocale].slug };

  /** @type {LocaleContentMap} */
  const originalValues = Object.fromEntries(
    enabledLocales.map((locale) =>
      isNew
        ? [locale, getDefaultValues(fields, locale, dynamicValues)]
        : [locale, structuredClone(locales?.[locale]?.content)],
    ),
  );

  entryDraft.set({
    createdAt: Date.now(),
    isNew,
    isIndexFile,
    canPreview,
    collectionName,
    collection,
    fileName,
    collectionFile,
    fields,
    originalEntry: isNew ? undefined : originalEntry,
    originalLocales,
    currentLocales: structuredClone(originalLocales),
    originalSlugs,
    currentSlugs: structuredClone(originalSlugs),
    originalValues,
    currentValues: Object.fromEntries(
      enabledLocales.map((locale) => [
        locale,
        createProxy({
          draft: { collectionName, fileName, isIndexFile },
          locale,
          target: structuredClone(originalValues[locale]),
        }),
      ]),
    ),
    files: {},
    validities: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    // Any locale-agnostic view states will be put under the `_` key
    expanderStates: expanderStates ?? { _: {} },
  });

  restoreBackupIfNeeded({ collectionName, fileName, slug });
};

/**
 * Duplicate the current entry draft.
 */
export const duplicateDraft = () => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));

  const {
    collectionName,
    fileName,
    collection,
    collectionFile,
    currentValues,
    validities,
    isIndexFile,
  } = draft;

  const {
    defaultLocale,
    canonicalSlug: { key: canonicalSlugKey },
  } = (collectionFile ?? collection)._i18n;

  Object.entries(currentValues).forEach(([locale, valueMap]) => {
    // Remove the canonical slug
    delete valueMap[canonicalSlugKey];

    const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };

    // Reset some unique values
    Object.keys(valueMap).forEach((keyPath) => {
      const fieldConfig = getField({ ...getFieldArgs, keyPath });

      if (fieldConfig?.widget === 'uuid') {
        if (locale === defaultLocale || [true, 'translate'].includes(fieldConfig?.i18n ?? false)) {
          valueMap[keyPath] = getInitialUuidValue(/** @type {UuidField} */ (fieldConfig));
        }
      }

      if (fieldConfig?.widget === 'hidden') {
        // The value could be array; normalize the key path, e.g. `tags.0` -> `tags`
        if (Array.isArray(fieldConfig.default) && keyPath.match(/\.\d+$/)) {
          delete valueMap[keyPath];
          keyPath = keyPath.replace(/\.\d+$/, '');

          if (keyPath in valueMap) {
            return;
          }
        }

        if (locale === defaultLocale || [true, 'translate'].includes(fieldConfig?.i18n ?? false)) {
          Object.assign(
            valueMap,
            getHiddenFieldDefaultValueMap({
              // eslint-disable-next-line object-shorthand
              fieldConfig: /** @type {HiddenField} */ (fieldConfig),
              keyPath,
              locale,
            }),
          );
        }
      }
    });
  });

  // Reset the validities
  Object.keys(validities).forEach((locale) => {
    validities[locale] = {};
  });

  entryDraft.set({
    ...draft,
    isNew: true,
    originalEntry: undefined,
    originalSlugs: {},
    currentSlugs: {},
  });

  showDuplicateToast.set(true);
};
