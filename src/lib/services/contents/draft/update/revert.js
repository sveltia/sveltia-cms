import { get } from 'svelte/store';
import { entryDraft } from '$lib/services/contents/draft';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import { Writable } from 'svelte/store';
 * @import { EntryDraft, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Revert the changes made to the given field or all the fields to the default value(s).
 * @param {InternalLocaleCode} [locale] Target locale, e.g. `ja`. Can be empty if reverting
 * everything.
 * @param {FieldKeyPath} [keyPath] Flattened (dot-notated) object keys that will be used for
 * searching the source values. Omit this if copying all the fields. If the triggered widget is List
 * or Object, this will likely match multiple fields.
 */
export const revertChanges = (locale = '', keyPath = '') => {
  const {
    collection,
    collectionName,
    collectionFile,
    fileName,
    currentValues,
    originalValues,
    isIndexFile,
  } = /** @type {EntryDraft} */ (get(entryDraft));

  const { allLocales, defaultLocale } = (collectionFile ?? collection)._i18n;
  const locales = locale ? [locale] : allLocales;

  /**
   * Revert changes.
   * @param {InternalLocaleCode} _locale Iterating locale.
   * @param {FlattenedEntryContent} valueMap Flattened entry content.
   * @param {boolean} reset Whether ro remove the current value.
   */
  const revert = (_locale, valueMap, reset = false) => {
    const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };

    Object.entries(valueMap).forEach(([_keyPath, value]) => {
      if (!keyPath || _keyPath.startsWith(keyPath)) {
        const fieldConfig = getField({ ...getFieldArgs, keyPath: _keyPath });

        if (_locale === defaultLocale || [true, 'translate'].includes(fieldConfig?.i18n ?? false)) {
          if (reset) {
            delete currentValues[_locale][_keyPath];
          } else {
            currentValues[_locale][_keyPath] = value;
          }
        }
      }
    });
  };

  locales.forEach((_locale) => {
    // Remove all the current values except for i18n-duplicate ones
    revert(_locale, currentValues[_locale], true);
    // Restore the original values
    revert(_locale, originalValues[_locale], false);
  });

  /** @type {Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
    currentValues,
  }));
};
