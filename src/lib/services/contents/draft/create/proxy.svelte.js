import { isObject } from '@sveltia/utils/object';

import { resolveCollectionAndFile } from '$lib/services/contents/collection/files';
import { isAutoDuplicationEnabled } from '$lib/services/contents/draft';
import { createValueMap } from '$lib/services/contents/draft/create/versioned-map.svelte';
import { revalidateField } from '$lib/services/contents/draft/validate/fields';
import { getDraftFieldArgs, getField } from '$lib/services/contents/entry/fields';
import { getLocalizedFieldValue } from '$lib/services/contents/fields/locale';
import {
  findDuplicateIfEmptyField,
  followsDefaultLocale,
  getMainValueKeyPath,
} from '$lib/services/contents/i18n/duplicate-if-empty';
import { getInheritedI18nOption } from '$lib/services/contents/i18n/shared-values';
import { isNumeric } from '$lib/services/utils/number';

/**
 * @import { EntryDraft, FlattenedEntryContent, GetFieldArgs } from '$lib/types/private';
 * @import { Field, FieldKeyPath, LocaleCode } from '$lib/types/public';
 */

const PATH_MATCH_REGEX = /(?<path>.+?)\.[^.]*$/;

/**
 * Check if the given field’s value is duplicated from the default locale to the other locales. That
 * is the case when the field has the `duplicate` i18n strategy, or, if the field has no `i18n`
 * option of its own, when the nearest ancestor that has one, such as the List or Object field it
 * belongs to, has the `duplicate` strategy. A duplicated List or Object field then holds the same
 * items and values in every locale, the way `normalizeContentMap()` copies it when an entry is
 * loaded, while a subfield explicitly made translatable keeps a value of its own in each locale.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function, including the key
 * path of the field.
 * @returns {boolean} Whether the value is duplicated.
 */
export const isDuplicatedField = (args) => getInheritedI18nOption(args) === 'duplicate';

/**
 * Get a function to check if a duplicated field can be copied to, or deleted from, another locale
 * at the same key path. That depends on the items of the List fields the field belongs to: the
 * items of a List field that isn’t duplicated itself are translatable, so the other locale may have
 * fewer items, or an item of another type at the same position. The value is then only copied to
 * the locales that have the item, of the same type, so that no stray item is created there or a
 * value written into an unrelated item. The items of a duplicated List field are the same in every
 * locale.
 * @param {object} args Arguments.
 * @param {Field | undefined} args.fieldConfig Field configuration, as resolved for the source
 * locale.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function, including the key
 * path of the field.
 * @returns {(content: FlattenedEntryContent) => boolean} Function taking the content of the other
 * locale and returning whether the field can be written there.
 * @see https://github.com/sveltia/sveltia-cms/issues/1075
 */
export const getListItemMatcher = ({ fieldConfig, getFieldArgs }) => {
  const { keyPath } = getFieldArgs;
  const segments = keyPath.split('.');

  const itemKeyPaths = segments
    .map((segment, index) => {
      if (index === 0 || !isNumeric(segment)) {
        return undefined;
      }

      const listKeyPath = segments.slice(0, index).join('.');
      const listGetFieldArgs = { ...getFieldArgs, keyPath: listKeyPath };
      const listField = getField(listGetFieldArgs);

      // An index of a multi-value field such as `images.0` is not an item of its own
      if (
        listField?.widget !== 'list' ||
        isDuplicatedField({ fieldConfig: listField, getFieldArgs: listGetFieldArgs })
      ) {
        return undefined;
      }

      return `${listKeyPath}.${segment}`;
    })
    .filter((itemKeyPath) => itemKeyPath !== undefined);

  if (!itemKeyPaths.length) {
    return () => true;
  }

  return (content) => {
    /**
     * Check if the other locale has the given list item. The key path itself is looked up first, so
     * the key scan through the `$state` proxy only runs when the value is missing there.
     * @param {string} itemKeyPath Key path of the list item, e.g. `blocks.1`.
     * @returns {boolean} Result.
     */
    const hasItem = (itemKeyPath) =>
      keyPath in content ||
      itemKeyPath in content ||
      Object.keys(content).some((_keyPath) => _keyPath.startsWith(`${itemKeyPath}.`));

    // A variable type resolves to the same field only if the item has the same type in both
    // locales. That’s checked first, as it rules out a missing variable type item without the scan
    return (
      getField({ ...getFieldArgs, valueMap: content }) === fieldConfig &&
      itemKeyPaths.every(hasItem)
    );
  };
};

/**
 * Check if the parent of the given key path, if any, exists in another locale’s content, so that a
 * value can be copied there.
 * @param {object} args Arguments.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function, including the key
 * path of the value.
 * @param {FlattenedEntryContent} args.content Content of the other locale.
 * @returns {boolean} Result.
 */
const hasParentInLocale = ({ getFieldArgs, content }) => {
  const { keyPath } = getFieldArgs;

  if (!keyPath.includes('.')) {
    return true;
  }

  // The regex always matches since keyPath is guaranteed to contain a dot (checked above).
  const parentKeyPath = /** @type {string} */ (keyPath.match(PATH_MATCH_REGEX)?.groups?.path);

  // `getField()` is memoized, while the key scan walks the whole locale’s content through the
  // `$state` proxy, so a configured parent — the usual case — never pays for the scan
  return (
    !!getField({ ...getFieldArgs, keyPath: parentKeyPath }) ||
    Object.keys(content).some((_keyPath) => _keyPath.startsWith(`${parentKeyPath}.`))
  );
};

/**
 * Call a function for each locale other than the source locale where a value can be copied to, i.e.
 * The parent object exists and the list items match.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function, including the key
 * path of the value.
 * @param {LocaleCode} args.sourceLanguage Source locale.
 * @param {(content: FlattenedEntryContent) => boolean} args.matchesListItems Function returned by
 * {@link getListItemMatcher}.
 * @param {(content: FlattenedEntryContent, targetLanguage: LocaleCode) => void} callback Function
 * called with the content and code of the target locale.
 */
const forEachTargetLocale = (
  { draft, getFieldArgs, sourceLanguage, matchesListItems },
  callback,
) => {
  Object.entries(draft.currentValues).forEach(([targetLanguage, content]) => {
    // Don’t copy the value if the parent object doesn’t exist, or to a list item that doesn’t exist
    // in the target locale, or that is of another type there
    if (
      targetLanguage !== sourceLanguage &&
      hasParentInLocale({ getFieldArgs, content }) &&
      matchesListItems(content)
    ) {
      callback(content, targetLanguage);
    }
  });
};

/**
 * Copy the default locale value to other locales if the field’s i18n strategy is `duplicate`.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {LocaleCode} args.sourceLanguage Source locale.
 * @param {any} args.value Value to copy to other locales.
 */
export const copyDefaultLocaleValue = ({
  draft,
  getFieldArgs,
  fieldConfig,
  sourceLanguage,
  value,
}) => {
  const { keyPath } = getFieldArgs;
  const matchesListItems = getListItemMatcher({ fieldConfig, getFieldArgs });

  forEachTargetLocale(
    { draft, getFieldArgs, sourceLanguage, matchesListItems },
    (content, targetLanguage) => {
      // Keep the source `value` intact, as it’s used for the remaining target locales
      const localizedValue = getLocalizedFieldValue({
        fieldConfig,
        value,
        sourceLocale: sourceLanguage,
        targetLocale: targetLanguage,
      });

      if (content[keyPath] !== localizedValue) {
        content[keyPath] = localizedValue;
      }
    },
  );
};

/**
 * Copy a value written in the default locale to the other locales where the field, which uses the
 * `duplicate_if_empty` i18n strategy, is empty or still holds the default locale’s value from
 * before the write. The latter keeps a locale that follows the default locale in sync as the user
 * types, while a value of its own entered in the locale is left alone.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function, including the key
 * path of the written value.
 * @param {Field} args.fieldConfig Configuration of the field the value belongs to.
 * @param {FieldKeyPath} args.fieldKeyPath Key path of the field, which differs from the key path of
 * the value for a Code field that outputs the language along with the code.
 * @param {LocaleCode} args.sourceLanguage Source locale, which is the default locale.
 * @param {any} args.value Written value.
 * @param {any} args.previousValue Value the key path held before the write.
 * @param {boolean} [args.deleted] Whether the value was deleted rather than written, as when a
 * field is reverted, which deletes the value before restoring the original one. It’s then deleted
 * from the locales that follow, so that the restored value is copied to them again.
 * @see https://github.com/sveltia/sveltia-cms/issues/120
 */
export const copyDefaultLocaleValueIfEmpty = ({
  draft,
  getFieldArgs,
  fieldConfig,
  fieldKeyPath,
  sourceLanguage,
  value,
  previousValue,
  deleted = false,
}) => {
  const { keyPath, valueMap } = getFieldArgs;
  const mainKeyPath = getMainValueKeyPath(fieldConfig, fieldKeyPath);

  // The value map is always given by the proxy
  const previousMainValue =
    keyPath === mainKeyPath
      ? previousValue
      : /** @type {FlattenedEntryContent} */ (valueMap)[mainKeyPath];

  const matchesListItems = getListItemMatcher({
    fieldConfig,
    getFieldArgs: { ...getFieldArgs, keyPath: fieldKeyPath },
  });

  forEachTargetLocale(
    { draft, getFieldArgs, sourceLanguage, matchesListItems },
    (content, targetLanguage) => {
      const targetMainValue = content[mainKeyPath];

      const follows = followsDefaultLocale({
        fieldConfig,
        targetValue: targetMainValue,
        previousValue: previousMainValue,
        sourceLocale: sourceLanguage,
        targetLocale: targetLanguage,
      });

      if (deleted) {
        if (follows && keyPath in content) {
          delete content[keyPath];
        }

        return;
      }

      const localizedValue = getLocalizedFieldValue({
        fieldConfig,
        value,
        sourceLocale: sourceLanguage,
        targetLocale: targetLanguage,
      });

      if (
        follows &&
        // A Code field’s object value is replaced with an empty object of the same shape, so leave
        // the one the locale already has
        !(isObject(value) && isObject(content[keyPath])) &&
        content[keyPath] !== localizedValue
      ) {
        content[keyPath] = localizedValue;
      }
    },
  );
};

/**
 * Create a Proxy holding a locale’s field values, which revalidates a field as its value is written
 * or deleted, and automatically copies the value to the other locales if the field’s i18n strategy
 * is `duplicate`, or to those where the field is empty if the strategy is `duplicate_if_empty`.
 *
 * The values are held in a value map created with {@link createValueMap}.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft the values belong to. The draft is read as fields are
 * written, e.g. to find the other locales’ values and update the validities, so it has to be the
 * reactive draft object, not a plain copy.
 * @param {string} args.locale Source locale.
 * @param {FlattenedEntryContent} [args.target] Plain object holding the initial values.
 * @param {() => FlattenedEntryContent} [args.getValueMap] Optional function to get an object
 * holding the current entry values. It will be used for the `valueMap` argument of
 * {@link getField}. If omitted, the proxy target will be used instead.
 * @returns {any} Created proxy.
 */
export const createProxy = ({ draft, locale: sourceLanguage, target = {}, getValueMap }) => {
  const { collectionName, fileName, isIndexFile } = draft;
  const draftFieldArgs = { collectionName, fileName, isIndexFile };
  const resolved = resolveCollectionAndFile(collectionName, fileName);

  if (!resolved) {
    return undefined;
  }

  const { collection, collectionFile } = resolved;

  const {
    defaultLocale,
    canonicalSlug: { key: canonicalSlugKey },
  } = (collectionFile ?? collection)._i18n;

  /**
   * Check if the value is written in the default locale with auto-duplication enabled, in which
   * case it can be copied to the other locales.
   * @returns {boolean} Result.
   */
  const isDefaultLocaleSource = () =>
    isAutoDuplicationEnabled() && sourceLanguage === defaultLocale;

  /**
   * Check if auto-duplication should be performed for the given field.
   * @param {Field} fieldConfig Field configuration.
   * @param {GetFieldArgs} getFieldArgs Arguments for the `getField` function.
   * @returns {boolean} True if auto-duplication should be performed.
   */
  const shouldAutoDuplicate = (fieldConfig, getFieldArgs) =>
    isDefaultLocaleSource() && isDuplicatedField({ fieldConfig, getFieldArgs });

  /**
   * Get field configuration for the given key path.
   * @param {object} obj The proxy target object.
   * @param {FieldKeyPath} keyPath The field key path.
   * @returns {{ valueMap: any, getFieldArgs: GetFieldArgs, fieldConfig: Field | undefined }}
   * Field info.
   */
  const getFieldInfo = (obj, keyPath) => {
    const valueMap = typeof getValueMap === 'function' ? getValueMap() : obj;
    const getFieldArgs = getDraftFieldArgs(draftFieldArgs, { keyPath, valueMap });
    const fieldConfig = getField({ ...getFieldArgs });

    return { valueMap, getFieldArgs, fieldConfig };
  };

  /**
   * Copy a value written to, or deleted from, the default locale to the other locales where the
   * field uses the `duplicate_if_empty` i18n strategy and is empty or in sync with the default
   * locale. See {@link copyDefaultLocaleValueIfEmpty}.
   * @param {object} args Arguments.
   * @param {Field | undefined} args.fieldConfig Configuration of the field at the key path.
   * @param {GetFieldArgs} args.getFieldArgs Arguments for the `getField` function, including the
   * key path of the value.
   * @param {any} [args.value] Written value.
   * @param {any} args.previousValue Value the key path held before.
   * @param {boolean} [args.deleted] Whether the value was deleted.
   */
  const followDefaultLocale = ({ fieldConfig, getFieldArgs, value, previousValue, deleted }) => {
    if (!isDefaultLocaleSource()) {
      return;
    }

    const { keyPath } = getFieldArgs;

    const duplicateIfEmpty = findDuplicateIfEmptyField(keyPath, (_keyPath) =>
      _keyPath === keyPath ? fieldConfig : getField({ ...getFieldArgs, keyPath: _keyPath }),
    );

    if (duplicateIfEmpty) {
      copyDefaultLocaleValueIfEmpty({
        draft,
        getFieldArgs,
        ...duplicateIfEmpty,
        sourceLanguage,
        value,
        previousValue,
        deleted,
      });
    }
  };

  return createValueMap(target, {
    // eslint-disable-next-line jsdoc/require-jsdoc
    onSet: (obj, /** @type {FieldKeyPath} */ keyPath, value, previousValue) => {
      // Skip the rest in some cases
      if ([canonicalSlugKey].includes(keyPath)) {
        return;
      }

      const { fieldConfig, getFieldArgs, valueMap } = getFieldInfo(obj, keyPath);

      // Update the validity and validation message in real time if validation has already been
      // performed. A value without a field of its own may be a KeyValue pair, which is validated
      // as part of its field, so that’s left to `revalidateField()` to tell
      revalidateField({ draft, locale: sourceLanguage, keyPath, value, valueMap });

      // Copy value to other locales
      if (fieldConfig && shouldAutoDuplicate(fieldConfig, getFieldArgs)) {
        copyDefaultLocaleValue({ draft, getFieldArgs, fieldConfig, sourceLanguage, value });
      }

      // Copy value to other locales where the field is empty
      followDefaultLocale({ fieldConfig, getFieldArgs, value, previousValue });
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    onDelete: (obj, /** @type {FieldKeyPath} */ keyPath, previousValue) => {
      const { fieldConfig, getFieldArgs, valueMap } = getFieldInfo(obj, keyPath);

      // Update the validity and validation message in real time as well, e.g. when the last item of
      // a List field is removed, which leaves the list with fewer items than it had
      if (keyPath !== canonicalSlugKey) {
        revalidateField({ draft, locale: sourceLanguage, keyPath, value: undefined, valueMap });
      }

      // Remove the property from other locales
      if (fieldConfig && shouldAutoDuplicate(fieldConfig, getFieldArgs)) {
        const matchesListItems = getListItemMatcher({ fieldConfig, getFieldArgs });

        Object.entries(draft.currentValues).forEach(([targetLanguage, content]) => {
          if (
            targetLanguage !== sourceLanguage &&
            keyPath in content &&
            matchesListItems(content)
          ) {
            delete content[keyPath];
          }
        });
      }

      // Remove the property from other locales that follow the default locale
      followDefaultLocale({ fieldConfig, getFieldArgs, previousValue, deleted: true });
    },
  });
};
