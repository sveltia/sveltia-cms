import equal from 'fast-deep-equal';

import { collectFieldValues, suspendAutoDuplication } from '$lib/services/contents/draft';
import { getDraftFieldArgs, getField } from '$lib/services/contents/entry/fields';
import { isKeyPathWithin } from '$lib/services/contents/entry/key-paths';
import { getValueOwnerField } from '$lib/services/contents/entry/owner-field';
import { syncAllDuplicateKeys } from '$lib/services/contents/fields/key-value/duplicate-keys';
import { getPairedListKeyPaths } from '$lib/services/contents/fields/list/helpers';
import { getDraftI18nConfig } from '$lib/services/contents/i18n/config';
import { isFieldTranslatable } from '$lib/services/contents/i18n/fields';
import { isSyncedField } from '$lib/services/contents/i18n/shared-values';
import { isNumeric } from '$lib/services/utils/number';

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
 * where it was originally located. Every list item along the key path is resolved, as an item of a
 * nested list keeps its original index in its own list, while the item holding that list may have
 * moved as well. Only the index is taken from each tag, since the tag holds the key path at the
 * time the item was tagged, which may come before or after an outer item was moved.
 * @param {Record<string, any>} valueMap Current flat value map for the locale.
 * @param {FieldKeyPath} keyPath Current field key path.
 * @returns {{ originalKeyPath: FieldKeyPath, currentPrefix: string, originalPrefix: string } |
 * undefined} The resolved paths, or `undefined` if no remapping is needed. The prefixes are the
 * current and original key paths of the innermost tagged list item.
 */
export const resolveOriginalKeyPath = (valueMap, keyPath) => {
  const parts = keyPath.split('.');
  const originalParts = [...parts];
  let innermostIndex = 0;

  parts.forEach((part, i) => {
    if (i >= 1 && isNumeric(part)) {
      /** @type {string | undefined} */
      const originalItemKeyPath =
        valueMap[`${parts.slice(0, i + 1).join('.')}.__sc_item_original_key_path`];

      if (originalItemKeyPath !== undefined) {
        originalParts[i] = /** @type {string} */ (originalItemKeyPath.split('.').at(-1));
        innermostIndex = i;
      }
    }
  });

  if (!innermostIndex) {
    return undefined;
  }

  return {
    originalKeyPath: originalParts.join('.'),
    currentPrefix: parts.slice(0, innermostIndex + 1).join('.'),
    originalPrefix: originalParts.slice(0, innermostIndex + 1).join('.'),
  };
};

/**
 * Collect the values stored at the given key path and under it, keyed by their path relative to it,
 * leaving out empty object/array placeholders. See {@link collectFieldValues}.
 * @param {Record<string, any>} valueMap Flat value map for a locale.
 * @param {FieldKeyPath} keyPath Field key path.
 * @returns {Record<string, any>} Values keyed by their relative key path; the field’s own value, if
 * any, is keyed by an empty string.
 */
const getFieldValues = (valueMap, keyPath) =>
  collectFieldValues(valueMap, keyPath, { relative: true, dropEmptyPlaceholders: true });

/**
 * Check if the given field has been changed from its original value, so its changes can be
 * reverted. The field’s own value and all the values under it are compared, because a List,
 * Object, KeyValue or custom field stores its value under its child key paths.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.currentValueMap Current flat value map for the locale.
 * @param {Record<string, any>} args.originalValueMap Original flat value map for the locale.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @returns {boolean} Whether the field has been changed.
 */
export const isFieldChanged = ({ currentValueMap, originalValueMap, keyPath }) => {
  // For fields inside list items, use the original key path if the item was reordered
  const originalKeyPath =
    resolveOriginalKeyPath(currentValueMap, keyPath)?.originalKeyPath ?? keyPath;

  return !equal(
    getFieldValues(currentValueMap, keyPath),
    getFieldValues(originalValueMap, originalKeyPath),
  );
};

/**
 * Revert the changes made to the given field or all the fields to the default value(s).
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
    if (!keyPath || isKeyPathWithin(_keyPath, keyPath)) {
      const ownField = getField({ ...getFieldArgs, keyPath: _keyPath });

      // A value without a field of its own, like a KeyValue pair, an item of a List field without
      // subfields or the code of a Code field, is governed by the field owning it
      const field = ownField
        ? { keyPath: _keyPath, fieldConfig: ownField }
        : getValueOwnerField({ ...getFieldArgs, keyPath: _keyPath });

      const i18n = field?.fieldConfig.i18n;

      // A field using the `sync` i18n strategy, with its own option or along with an ancestor, can
      // be edited in any locale, and the value proxy copies the reverted value to the others
      if (
        isDefaultLocale ||
        isFieldTranslatable(i18n) ||
        i18n === 'duplicate_keys' ||
        (!!field &&
          isSyncedField({
            fieldConfig: field.fieldConfig,
            getFieldArgs: { ...getFieldArgs, keyPath: field.keyPath },
          }))
      ) {
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
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {FieldKeyPath} args.keyPath Field key path to revert. If empty, all the fields will be
 * reverted.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {boolean} [args.revertAll] Whether to revert every field in another locale as well, not
 * just the translatable ones, like in the default locale.
 */
export const revertLocale = ({ draft, keyPath, locale, revertAll = false }) => {
  const { currentValues, originalValues } = draft;
  const { defaultLocale } = getDraftI18nConfig(draft);
  const isDefaultLocale = revertAll || locale === defaultLocale;
  const getFieldArgs = getDraftFieldArgs(draft, { keyPath: '' });
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
 * Get the key paths of the paired List fields that reverting the given field reverts: the field
 * itself or those nested in it, or every one if all the fields are reverted. See
 * {@link getPairedListKeyPaths}.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {FieldKeyPath} args.keyPath Field key path to revert, or an empty string for every field.
 * @returns {FieldKeyPath[]} Key paths.
 */
const getRevertedPairedListKeyPaths = ({ draft, keyPath }) => {
  if (!keyPath) {
    return getPairedListKeyPaths(draft.fields);
  }

  const { currentValues } = draft;
  const { defaultLocale } = getDraftI18nConfig(draft);

  const fieldConfig = getField(
    getDraftFieldArgs(draft, { keyPath, valueMap: currentValues[defaultLocale] }),
  );

  return fieldConfig
    ? getPairedListKeyPaths([fieldConfig], keyPath.split('.').slice(0, -1).join('.'))
    : [];
};

/**
 * Revert the changes made to the given field or all the fields to the default value(s).
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} [args.locale] Target locale, e.g. `ja`. Can be empty if reverting
 * everything.
 * @param {FieldKeyPath} [args.keyPath] Flattened (dot-notated) object keys that will be used for
 * searching the source values. Omit this if copying all the fields. If the triggered field is the
 * List or Object type, this will likely match multiple fields.
 */
export const revertChanges = ({ draft, locale: targetLanguage = '', keyPath = '' }) => {
  const { currentValues, originalLocales, originalPath, originalSlugs } = draft;
  const { allLocales, defaultLocale } = getDraftI18nConfig(draft);
  // Reverting one field or one locale only touches values. Reverting everything restores where the
  // entry goes as well — the folder chosen with the path editor and the slugs, which name the file
  // or its folder in each locale — and which locales it’s output in, or a move, rename or disabled
  // locale would survive the revert and still be committed on the next save, which deletes the file
  // of a locale left disabled
  const revertsEverything = !targetLanguage && !keyPath;

  if (targetLanguage) {
    revertLocale({ draft, keyPath, locale: targetLanguage });
  } else {
    // Every locale gets its own original values back, including those of the fields holding the
    // same value in every locale, so nothing is copied from one locale to another. Otherwise a
    // `sync` field reverted in one locale would overwrite the original value of another locale,
    // which may differ if the files were edited elsewhere
    suspendAutoDuplication(() => {
      allLocales.forEach((locale) => {
        revertLocale({ draft, keyPath, locale, revertAll: true });
      });
    });
  }

  // The items of a paired List field are added, removed and moved in every locale at once, so
  // reverting them in the default locale alone would leave them out of line with the other locales.
  // Each locale gets its own original values back, as above, so a subfield using the `sync`
  // strategy isn’t copied from another locale over the one just reverted
  if (targetLanguage === defaultLocale) {
    suspendAutoDuplication(() => {
      getRevertedPairedListKeyPaths({ draft, keyPath }).forEach((pairedKeyPath) => {
        allLocales.forEach((locale) => {
          if (locale !== defaultLocale && currentValues[locale]) {
            revertLocale({ draft, keyPath: pairedKeyPath, locale, revertAll: true });
          }
        });
      });
    });
  }

  // Keys reverted in the default locale have to reach the other locales, and pairs reverted in
  // another locale have to line up with the default locale again
  syncAllDuplicateKeys({
    valueStore: currentValues,
    defaultLocale,
    getFieldArgs: getDraftFieldArgs(draft),
  });

  if (revertsEverything) {
    draft.currentLocales = { ...originalLocales };
    draft.currentPath = originalPath;
    draft.currentSlugs = { ...originalSlugs };
  }
};
