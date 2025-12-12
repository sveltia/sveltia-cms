import { get } from 'svelte/store';

import { entryDraft } from '$lib/services/contents/draft';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import {
 * EntryDraft,
 * GetFieldArgs,
 * InternalLocaleCode,
 * LocaleContentMap,
 * } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Revert the changes made to the given field or all the fields to the default value(s).
 * @internal
 * @param {object} args Arguments.
 * @param {FieldKeyPath} args.keyPath Field key path to revert. If empty, all the fields will be
 * reverted.
 * @param {InternalLocaleCode} args.locale Iterating locale.
 * @param {boolean} args.isDefaultLocale Whether the locale is the default locale.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the {@link getField} function.
 * @param {LocaleContentMap} args.currentValues Current values to revert. This will be modified.
 * @param {boolean} [args.reset] Whether ro remove the current value.
 */
export const revertFields = ({
  locale,
  isDefaultLocale,
  keyPath,
  getFieldArgs,
  currentValues,
  reset = false,
}) => {
  const { valueMap = {} } = getFieldArgs;

  Object.entries(valueMap).forEach(([_keyPath, value]) => {
    if (!keyPath || _keyPath.startsWith(keyPath)) {
      const fieldConfig = getField({ ...getFieldArgs, keyPath: _keyPath });

      if (isDefaultLocale || [true, 'translate'].includes(fieldConfig?.i18n ?? false)) {
        if (reset) {
          delete currentValues[locale][_keyPath];
        } else {
          currentValues[locale][_keyPath] = value;
        }
      }
    }
  });
};

/**
 * Revert the changes made to the given locale.
 * @internal
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {FieldKeyPath} args.keyPath Field key path to revert. If empty, all the fields will be
 * reverted.
 * @param {InternalLocaleCode} args.locale Locale code.
 */
export const revertLocale = ({ draft, keyPath, locale }) => {
  const {
    collection,
    collectionName,
    collectionFile,
    fileName,
    currentValues,
    originalValues,
    isIndexFile,
  } = draft;

  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  const isDefaultLocale = locale === defaultLocale;
  const revertArgs = { keyPath, locale, isDefaultLocale, currentValues };
  /** @type {GetFieldArgs} */
  const getFieldArgs = { collectionName, fileName, keyPath: '', isIndexFile };

  // Remove all the current values except for i18n-duplicate ones
  revertFields({
    ...revertArgs,
    getFieldArgs: { ...getFieldArgs, valueMap: currentValues[locale] },
    reset: true,
  });

  // Restore the original values
  revertFields({
    ...revertArgs,
    getFieldArgs: { ...getFieldArgs, valueMap: originalValues[locale] },
  });
};

/**
 * Revert the changes made to the given field or all the fields to the default value(s).
 * @param {object} [args] Arguments.
 * @param {InternalLocaleCode} [args.locale] Target locale, e.g. `ja`. Can be empty if reverting
 * everything.
 * @param {FieldKeyPath} [args.keyPath] Flattened (dot-notated) object keys that will be used for
 * searching the source values. Omit this if copying all the fields. If the triggered field type is
 * List or Object, this will likely match multiple fields.
 */
export const revertChanges = ({ locale: targetLanguage = '', keyPath = '' } = {}) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { collection, collectionFile, currentValues } = draft;
  const { allLocales } = (collectionFile ?? collection)._i18n;
  const locales = targetLanguage ? [targetLanguage] : allLocales;

  locales.forEach((locale) => {
    revertLocale({ draft, keyPath, locale });
  });

  entryDraft.update(() => ({ ...draft, currentValues }));
};
