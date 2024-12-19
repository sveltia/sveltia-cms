import { unique } from '@sveltia/utils/array';
import { escapeRegExp } from '@sveltia/utils/string';
import { flatten, unflatten } from 'flat';
import { get } from 'svelte/store';
import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';
import { createProxy, getDefaultValues } from '$lib/services/contents/draft/create';
import {
  copyFromLocaleToast,
  translatorApiKeyDialogState,
} from '$lib/services/contents/draft/editor';
import { getFieldConfig } from '$lib/services/contents/entry/fields';
import { translator } from '$lib/services/integrations/translators';
import { prefs } from '$lib/services/prefs';

/**
 * Update a flatten object with new properties by adding, updating and deleting properties.
 * @param {Record<string, any>} obj - Original object.
 * @param {Record<string, any>} newProps - New properties.
 */
const updateObject = (obj, newProps) => {
  Object.entries(newProps).forEach(([key, value]) => {
    if (obj[key] !== value) {
      obj[key] = value;
    }
  });

  Object.keys(obj).forEach((key) => {
    if (!(key in newProps)) {
      delete obj[key];
    }
  });
};

/**
 * Traverse the given object by decoding dot-notated key path.
 * @param {any} obj - Original object.
 * @param {FieldKeyPath} keyPath - Dot-notated field name.
 * @returns {[values: any, remainder: any]} Unflatten values and flatten remainder.
 */
const getItemList = (obj, keyPath) => {
  const regex = new RegExp(`^${escapeRegExp(keyPath)}\\b(?!#)`);

  const filtered = Object.entries(obj)
    .filter(([k]) => regex.test(k))
    .map(([k, v]) => [k.replace(regex, '_'), v]);

  return [
    unflatten(Object.fromEntries(filtered))._ ?? [],
    Object.fromEntries(Object.entries(obj).filter(([k]) => !regex.test(k))),
  ];
};

/**
 * Update the value in a list field.
 * @param {LocaleCode} locale - Target locale.
 * @param {FieldKeyPath} keyPath - Dot-notated field name.
 * @param {(arg: { valueList: any[], expanderStateList: boolean[] }) =>
 * void } manipulate - A function to manipulate the list, which takes one object argument containing
 * the value list, file list and view state list. The typical usage is `list.splice()`.
 */
export const updateListField = (locale, keyPath, manipulate) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { collection, collectionFile } = draft;
  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  const [valueList, valueListRemainder] = getItemList(draft.currentValues[locale], keyPath);

  const [expanderStateList, expanderStateListRemainder] =
    // Manipulation should only happen once with the default locale
    locale === defaultLocale ? getItemList(draft.expanderStates._, keyPath) : [[], []];

  manipulate({ valueList, expanderStateList });

  i18nAutoDupEnabled.set(false);

  /** @type {import('svelte/store').Writable<EntryDraft>} */ (entryDraft).update((_draft) => {
    updateObject(_draft.currentValues[locale], {
      ...flatten({ [keyPath]: valueList }),
      ...valueListRemainder,
    });

    if (locale === defaultLocale) {
      updateObject(_draft.expanderStates._, {
        ...flatten({ [keyPath]: expanderStateList }),
        ...expanderStateListRemainder,
      });
    }

    return _draft;
  });

  i18nAutoDupEnabled.set(true);
};

/**
 * Populate the given localized content with values from the default locale if the corresponding
 * field’s i18n configuration is `duplicate`.
 * @param {FlattenedEntryContent} content - Original content.
 * @returns {FlattenedEntryContent} Updated content.
 */
export const copyDefaultLocaleValues = (content) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { collectionName, fileName, collection, collectionFile } = draft;
  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  const defaultLocaleValues = draft.currentValues[defaultLocale];
  const keys = unique([...Object.keys(content), ...Object.keys(defaultLocaleValues)]);
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
      const { collection, collectionName, collectionFile, fileName, originalValues } = _draft;
      const { fields = [] } = collectionFile ?? collection;
      const newContent = getDefaultValues(fields, locale);

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
 * @param {object} [options] - Options.
 * @param {FieldKeyPath} [options.keyPath] - Flattened (dot-notated) object keys that will be used
 * for searching the source values. Omit this if copying all the fields. If the triggered widget is
 * List or Object, this will likely match multiple fields.
 * @param {boolean} [options.translate] - Whether to translate the copied text fields.
 */
export const copyFromLocale = async (
  sourceLocale,
  targetLocale,
  { keyPath = '', translate = false } = {},
) => {
  const { collectionName, fileName, currentValues } = /** @type {EntryDraft} */ (get(entryDraft));
  const valueMap = currentValues[sourceLocale];

  const copingFields = Object.fromEntries(
    Object.entries(valueMap).filter(([_keyPath, sourceLocaleValue]) => {
      const targetLocaleValue = currentValues[targetLocale][_keyPath];
      const field = getFieldConfig({ collectionName, fileName, valueMap, keyPath: _keyPath });

      if (
        (keyPath && !_keyPath.startsWith(keyPath)) ||
        typeof sourceLocaleValue !== 'string' ||
        !sourceLocaleValue ||
        !['markdown', 'text', 'string', 'list'].includes(field?.widget ?? 'string') ||
        // prettier-ignore
        (field?.widget === 'list' &&
          (/** @type {ListField} */ (field).field ?? /** @type {ListField} */ (field).fields)) ||
        (!translate && sourceLocaleValue === targetLocaleValue) ||
        // Skip populated fields when translating all the fields
        (!keyPath && translate && !!targetLocaleValue)
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
    const _translator = get(translator);

    const apiKey =
      get(prefs).apiKeys?.[_translator.serviceId] ||
      (await new Promise((resolve) => {
        // The promise will be resolved once the user enters an API key on the dialog
        translatorApiKeyDialogState.set({ show: true, multiple: count > 1, resolve });
      }));

    if (!apiKey) {
      return;
    }

    updateToast('info', 'translation.started');

    try {
      const translatedValues = await _translator.translate(Object.values(copingFields), {
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
