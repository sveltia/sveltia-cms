import { toRaw } from '@sveltia/utils/object';
import { flatten, unflatten } from 'flat';
import { get } from 'svelte/store';
import { entryDraft } from '$lib/services/contents/draft';
import { createProxy, getDefaultValues } from '$lib/services/contents/draft/create';
import { copyFromLocaleToast } from '$lib/services/contents/draft/editor';
import { getFieldConfig } from '$lib/services/contents/entry';
import { translator } from '$lib/services/integrations/translators';
import { prefs } from '$lib/services/prefs';

/**
 * Unproxify & unflatten the given object.
 * @param {Proxy | object} obj - Original proxy or object.
 * @returns {object} Processed object.
 */
const unflattenObj = (obj) => unflatten(toRaw(obj));
/**
 * Traverse the given object by decoding dot-notated key path.
 * @param {any} obj - Unflatten object.
 * @param {FieldKeyPath} keyPath - Dot-notated field name.
 * @returns {any[]} Values.
 */
const getItemList = (obj, keyPath) =>
  keyPath.split('.').reduce((_obj, key) => {
    // @todo This avoids an error but behaves wrong; FIXME
    if (typeof _obj === 'boolean') {
      return [_obj];
    }

    const _key = key.match(/^\d+$/) ? Number(key) : key;

    // Create a new array when adding a new item
    _obj[_key] ??= [];

    return _obj[_key];
  }, obj);

/**
 * Update the value in a list field.
 * @param {LocaleCode} locale - Target locale.
 * @param {FieldKeyPath} keyPath - Dot-notated field name.
 * @param {(arg: { valueList: object[], expanderStateList: boolean[] }) => void} manipulate - A
 * function to manipulate the list, which takes one object argument containing the value list and
 * view state list. The typical usage is `list.splice()`.
 */
export const updateListField = (locale, keyPath, manipulate) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { collection, collectionFile } = draft;
  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  const currentValues = unflattenObj(draft.currentValues[locale]);
  const expanderStates = unflattenObj(draft.expanderStates._);

  manipulate({
    valueList: getItemList(currentValues, keyPath),
    // Manipulation should only happen once with the default locale
    expanderStateList: locale === defaultLocale ? getItemList(expanderStates, keyPath) : [],
  });

  /** @type {import('svelte/store').Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
    currentValues: {
      ..._draft.currentValues,
      // Flatten & proxify the object again
      [locale]: createProxy({
        draft: _draft,
        locale,
        target: flatten(currentValues),
      }),
    },
    expanderStates: {
      ..._draft.expanderStates,
      _: flatten(expanderStates),
    },
  }));
};

/**
 * Populate the given localized content with values from the default locale if the corresponding
 * field’s i18n configuration is `duplicate`.
 * @param {FlattenedEntryContent} content - Original content.
 * @param {object} [options] - Options.
 * @param {'currentValues' | 'files'} [options.prop] - Property name in the {@link entryDraft} store
 * that contains a locale/Proxy map.
 * @returns {FlattenedEntryContent} Updated content.
 */
export const copyDefaultLocaleValues = (content, { prop = 'currentValues' } = {}) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { collectionName, fileName, collection, collectionFile } = draft;
  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  const defaultLocaleValues = draft[prop][defaultLocale];
  const keys = [...new Set([...Object.keys(content), ...Object.keys(defaultLocaleValues)])];
  const newContent = /** @type {FlattenedEntryContent} */ ({});

  keys.forEach((keyPath) => {
    const canDuplicate =
      getFieldConfig({ collectionName, fileName, keyPath })?.i18n === 'duplicate';

    newContent[keyPath] =
      (canDuplicate ? defaultLocaleValues[keyPath] : undefined) ?? content[keyPath];
  });

  return newContent;
};

/**
 * Enable or disable the given locale’s content output for the current entry draft.
 * @param {LocaleCode} locale - Locale.
 */
export const toggleLocale = (locale) => {
  /** @type {import('svelte/store').Writable<EntryDraft>} */ (entryDraft).update((_draft) => {
    const { currentLocales, currentValues } = _draft;
    const enabled = !currentLocales[locale];

    // Initialize the content for the locale
    if (enabled && !currentValues[locale]) {
      const { collection, collectionName, collectionFile, fileName, originalValues, files } =
        _draft;
      const { fields = [], _i18n } = collectionFile ?? collection;
      const { defaultLocale } = _i18n;
      const newContent = getDefaultValues(fields);

      return {
        ..._draft,
        currentLocales: { ...currentLocales, [locale]: enabled },
        originalValues: { ...originalValues, [locale]: newContent },
        currentValues: {
          ...currentValues,
          [locale]: createProxy({
            draft: { collectionName, fileName },
            locale,
            target: copyDefaultLocaleValues(newContent),
          }),
        },
        files: {
          ...files,
          [locale]: createProxy({
            draft: { collectionName, fileName },
            prop: 'files',
            locale,
            target: copyDefaultLocaleValues(
              Object.fromEntries(Object.keys(files[defaultLocale]).map((key) => [key, undefined])),
              { prop: 'files' },
            ),
            // eslint-disable-next-line jsdoc/require-jsdoc
            getValueMap: () => /** @type {EntryDraft} */ (get(entryDraft)).currentValues[locale],
          }),
        },
      };
    }

    return {
      ..._draft,
      currentLocales: { ...currentLocales, [locale]: enabled },
    };
  });
};

/**
 * Copy or translate field value(s) from another locale.
 * @param {LocaleCode} sourceLocale - Source locale, e.g. `en`.
 * @param {LocaleCode} targetLocale - Target locale, e.g. `ja`.
 * @param {FieldKeyPath} [keyPath] - Flattened (dot-notated) object keys that will be used for
 * searching the source values. Omit this if copying all the fields. If the triggered widget is List
 * or Object, this will likely match multiple fields.
 * @param {boolean} [translate] - Whether to translate the copied text fields.
 */
export const copyFromLocale = async (
  sourceLocale,
  targetLocale,
  keyPath = '',
  translate = false,
) => {
  const { collectionName, fileName, currentValues } = /** @type {EntryDraft} */ (get(entryDraft));
  const valueMap = currentValues[sourceLocale];
  const copingFields = Object.fromEntries(
    Object.entries(valueMap).filter(([_keyPath, value]) => {
      const field = getFieldConfig({ collectionName, fileName, valueMap, keyPath: _keyPath });

      // prettier-ignore
      if (
        (keyPath && !_keyPath.startsWith(keyPath)) ||
        typeof value !== 'string' ||
        !['markdown', 'text', 'string', 'list'].includes(field?.widget ?? 'string') ||
        (field?.widget === 'list' &&
          (/** @type {ListField} */ (field).field ?? /** @type {ListField} */ (field).fields)) ||
        (!translate && value === currentValues[targetLocale][_keyPath])
      ) {
        return false;
      }

      return true;
    }),
  );
  const count = Object.keys(copingFields).length;
  const countType = count === 1 ? 'one' : 'many';
  const operationType = translate ? 'translation' : 'copy';

  /**
   * Update the toast notification.
   * @param {'info' | 'success' | 'error'} status - Status.
   * @param {string} message - Message key.
   */
  const updateToast = (status, message) => {
    copyFromLocaleToast.set({
      id: Date.now(),
      show: true,
      status,
      message,
      count,
      sourceLocale,
    });
  };

  if (!count) {
    updateToast('info', `${operationType}.none`);

    return;
  }

  if (translate) {
    const apiKey = get(prefs).apiKeys?.[get(translator)?.serviceId];

    if (!apiKey) {
      // This shouldn’t happen because the API key dialog will show up in advance
      return;
    }

    updateToast('info', 'translation.started');

    try {
      const translatedValues = await get(translator).translate(Object.values(copingFields), {
        apiKey,
        sourceLocale,
        targetLocale,
      });

      Object.keys(copingFields).forEach((_keyPath, index) => {
        currentValues[targetLocale][_keyPath] = translatedValues[index];
      });

      updateToast('success', `translation.complete.${countType}`);
    } catch (/** @type {any} */ ex) {
      // @todo Show a detailed error message.
      // @see https://www.deepl.com/docs-api/api-access/error-handling/
      updateToast('error', 'translation.error');
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  } else {
    Object.entries(copingFields).forEach(([_keyPath, value]) => {
      currentValues[targetLocale][_keyPath] = value;
    });

    updateToast('success', `copy.complete.${countType}`);
  }

  /** @type {import('svelte/store').Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
    currentValues,
  }));
};

/**
 * Revert the changes made to the given field or all the fields to the default value(s).
 * @param {LocaleCode} [locale] - Target locale, e.g. `ja`. Can be empty if reverting everything.
 * @param {FieldKeyPath} [keyPath] - Flattened (dot-notated) object keys that will be used for
 * searching the source values. Omit this if copying all the fields. If the triggered widget is List
 * or Object, this will likely match multiple fields.
 */
export const revertChanges = (locale = '', keyPath = '') => {
  const { collection, collectionFile, fileName, currentValues, originalValues } =
    /** @type {EntryDraft} */ (get(entryDraft));
  const { locales: allLocales, defaultLocale } = (collectionFile ?? collection)._i18n;
  const locales = locale ? [locale] : allLocales;

  /**
   * Revert changes.
   * @param {LocaleCode} _locale - Iterating locale.
   * @param {FlattenedEntryContent} valueMap - Flattened entry content.
   * @param {boolean} reset - Whether ro remove the current value.
   */
  const revert = (_locale, valueMap, reset = false) => {
    Object.entries(valueMap).forEach(([_keyPath, value]) => {
      if (!keyPath || _keyPath.startsWith(keyPath)) {
        const fieldConfig = getFieldConfig({
          collectionName: collection.name,
          fileName,
          valueMap,
          keyPath: _keyPath,
        });

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

  /** @type {import('svelte/store').Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
    currentValues,
  }));
};
