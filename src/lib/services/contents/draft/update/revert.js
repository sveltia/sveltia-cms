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
 * Resolve the original key path for a field that may be inside a reordered list item. When list
 * items are reordered, added, or removed, each item’s `__sc_item_original_key_path` property tracks
 * where it was originally located.
 * @param {Record<string, any>} valueMap Current flat value map for the locale.
 * @param {FieldKeyPath} keyPath Current field key path.
 * @returns {{ originalKeyPath: FieldKeyPath, currentPrefix: string, originalPrefix: string } |
 * undefined} The resolved paths, or `undefined` if no remapping is needed.
 */
export const resolveOriginalKeyPath = (valueMap, keyPath) => {
  const parts = keyPath.split('.');

  for (let i = parts.length - 1; i >= 1; i -= 1) {
    if (/^\d+$/.test(parts[i])) {
      const itemPrefix = parts.slice(0, i + 1).join('.');
      const originalPrefix = valueMap[`${itemPrefix}.__sc_item_original_key_path`];

      if (originalPrefix !== undefined) {
        const suffix = parts.slice(i + 1).join('.');

        return {
          originalKeyPath: suffix ? `${originalPrefix}.${suffix}` : originalPrefix,
          currentPrefix: itemPrefix,
          originalPrefix,
        };
      }
    }
  }

  return undefined;
};

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
 * @param {{ from: string, to: string }} [args.remapPrefix] When restoring values from a different
 * key path prefix (e.g. after list item reordering), remap `from` prefix to `to` prefix.
 */
export const revertFields = ({
  locale,
  isDefaultLocale,
  keyPath,
  getFieldArgs,
  currentValues,
  reset = false,
  remapPrefix,
}) => {
  const { valueMap = {} } = getFieldArgs;

  Object.entries(valueMap).forEach(([_keyPath, value]) => {
    if (!keyPath || _keyPath.startsWith(keyPath)) {
      const fieldConfig = getField({ ...getFieldArgs, keyPath: _keyPath });

      if (isDefaultLocale || [true, 'translate'].includes(fieldConfig?.i18n ?? false)) {
        if (reset) {
          delete currentValues[locale][_keyPath];
        } else {
          const targetKeyPath = remapPrefix
            ? `${remapPrefix.to}${_keyPath.slice(remapPrefix.from.length)}`
            : _keyPath;

          currentValues[locale][targetKeyPath] = value;
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
  /** @type {GetFieldArgs} */
  const getFieldArgs = { collectionName, fileName, keyPath: '', isIndexFile };
  // Resolve original key path for fields inside reordered list items
  const resolved = keyPath ? resolveOriginalKeyPath(currentValues[locale], keyPath) : undefined;
  const originalKeyPath = resolved?.originalKeyPath ?? keyPath;

  const remapPrefix = resolved
    ? { from: resolved.originalPrefix, to: resolved.currentPrefix }
    : undefined;

  // Remove all the current values except for i18n-duplicate ones
  revertFields({
    locale,
    isDefaultLocale,
    keyPath,
    getFieldArgs: { ...getFieldArgs, valueMap: currentValues[locale] },
    currentValues,
    reset: true,
  });

  // Restore the original values, remapping key paths if the item was reordered
  revertFields({
    locale,
    isDefaultLocale,
    keyPath: originalKeyPath,
    getFieldArgs: { ...getFieldArgs, valueMap: originalValues[locale] },
    currentValues,
    remapPrefix,
  });
};

/**
 * Revert the changes made to the given field or all the fields to the default value(s).
 * @param {object} [args] Arguments.
 * @param {InternalLocaleCode} [args.locale] Target locale, e.g. `ja`. Can be empty if reverting
 * everything.
 * @param {FieldKeyPath} [args.keyPath] Flattened (dot-notated) object keys that will be used for
 * searching the source values. Omit this if copying all the fields. If the triggered field is the
 * List or Object type, this will likely match multiple fields.
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
