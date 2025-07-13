import { toRaw } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';
import { flatten, unflatten } from 'flat';
import { marked } from 'marked';
import { get } from 'svelte/store';
import TurndownService from 'turndown';
import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';
import { createProxy } from '$lib/services/contents/draft/create';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import {
  copyFromLocaleToast,
  translatorApiKeyDialogState,
} from '$lib/services/contents/draft/editor';
import { getField } from '$lib/services/contents/entry/fields';
import { translator } from '$lib/services/integrations/translators';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Writable } from 'svelte/store';
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * LocaleContentMap,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, ListField } from '$lib/types/public';
 */

/**
 * @typedef {object} CopyOptions
 * @property {InternalLocaleCode} sourceLocale Source locale, e.g. `en`.
 * @property {InternalLocaleCode} targetLocale Target locale, e.g. `ja`.
 * @property {FieldKeyPath} [keyPath] Flattened (dot-notated) object keys that will be used for
 * searching the source values. Omit this if copying all the fields. If the triggered widget is List
 * or Object, this will likely match multiple fields.
 * @property {boolean} [translate] Whether to translate the copied text fields.
 */

/**
 * @typedef {Record<FieldKeyPath, { value: string, isMarkdown: boolean }>} CopyingFieldMap
 */

/**
 * Initialize a Turndown service instance for converting HTML to Markdown.
 * @see https://github.com/mixmark-io/turndown
 */
const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

/**
 * Update a flatten object with new properties by adding, updating and deleting properties.
 * @param {Record<string, any>} obj Original object.
 * @param {Record<string, any>} newProps New properties.
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
 * @param {Record<string, any>} obj Original object.
 * @param {FieldKeyPath} keyPath Dot-notated field name.
 * @returns {[values: any, remainder: any]} Unflatten values and flatten remainder.
 */
const getItemList = (obj, keyPath) => {
  const regex = new RegExp(`^${escapeRegExp(keyPath)}\\b(?!#)`);

  const filtered = Object.entries(obj)
    .filter(([k]) => regex.test(k))
    .map(([k, v]) => [k.replace(regex, '_'), v])
    .sort();

  return [
    unflatten(Object.fromEntries(filtered))._ ?? [],
    Object.fromEntries(Object.entries(obj).filter(([k]) => !regex.test(k))),
  ];
};

/**
 * Update the value in a list field.
 * @param {InternalLocaleCode} locale Target locale.
 * @param {FieldKeyPath} keyPath Dot-notated field name.
 * @param {(arg: { valueList: any[], expanderStateList: boolean[] }) =>
 * void } manipulate A function to manipulate the list, which takes one object argument containing
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

  /** @type {Writable<EntryDraft>} */ (entryDraft).update((_draft) => {
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
 * Populate the given localized content with values from the default locale.
 * @param {FlattenedEntryContent} content Original content for the current locale.
 * @returns {FlattenedEntryContent} Updated content.
 */
export const copyDefaultLocaleValues = (content) => {
  const { collectionName, fileName, collection, collectionFile, currentValues, isIndexFile } =
    /** @type {EntryDraft} */ (get(entryDraft));

  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  /** @type {FlattenedEntryContent} */
  const newContent = { ...toRaw(content), ...toRaw(currentValues[defaultLocale]) };
  const getFieldArgs = { collectionName, fileName, valueMap: newContent, isIndexFile };
  /** @type {string[]} */
  const noI18nFieldKeys = [];

  // Process the merged content
  Object.keys(newContent).forEach((keyPath) => {
    const field = getField({ ...getFieldArgs, keyPath });

    if (!field) {
      return;
    }

    const { widget = 'text', i18n = false } = field;

    // Reset the field value to the default value or an empty string if the field is a text-like
    // widget and i18n is enabled, because the content would likely be translated by the user.
    // Otherwise, the content would be copied from the default locale.
    if (['text', 'string', 'markdown'].includes(widget) && [true, 'translate'].includes(i18n)) {
      newContent[keyPath] = content[keyPath] ?? '';
    }

    // Remove the field if i18n is disabled
    if (
      [false, 'none'].includes(i18n) ||
      noI18nFieldKeys.some((key) => new RegExp(`^${escapeRegExp(key)}\\b`).test(keyPath))
    ) {
      delete newContent[keyPath];
      noI18nFieldKeys.push(keyPath);
    }
  });

  return newContent;
};

/**
 * Enable or disable the given locale’s content output for the current entry draft.
 * @param {InternalLocaleCode} locale Locale.
 */
export const toggleLocale = (locale) => {
  /** @type {Writable<EntryDraft>} */ (entryDraft).update((_draft) => {
    const { fields, currentLocales, currentValues, validities } = _draft;
    const enabled = !currentLocales[locale];

    // Initialize the content for the locale
    if (enabled && !currentValues[locale]) {
      const { collectionName, fileName, originalValues } = _draft;
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
      validities: { ...validities, [locale]: {} },
    };
  });
};

/**
 * Get a list of fields to be copied or translated from the source locale to the target locale.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {CopyOptions} args.options Copy options.
 * @returns {CopyingFieldMap} Copied or translated field values.
 */
const getCopyingFieldMap = ({ draft, options }) => {
  const { collectionName, fileName, currentValues, isIndexFile } = draft;
  const { sourceLocale, targetLocale, keyPath = '', translate = false } = options;
  const valueMap = currentValues[sourceLocale];
  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };

  return Object.fromEntries(
    Object.entries(valueMap)
      .map(([_keyPath, value]) => {
        const targetLocaleValue = currentValues[targetLocale][_keyPath];
        const field = getField({ ...getFieldArgs, keyPath: _keyPath });
        const widget = field?.widget ?? 'string';

        if (
          (keyPath && !_keyPath.startsWith(keyPath)) ||
          typeof value !== 'string' ||
          !value ||
          !['markdown', 'text', 'string', 'list'].includes(widget) ||
          // prettier-ignore
          (widget === 'list' &&
          (/** @type {ListField} */ (field).field ?? /** @type {ListField} */ (field).fields)) ||
          (!translate && value === targetLocaleValue) ||
          // Skip populated fields when translating all the fields
          (!keyPath && translate && !!targetLocaleValue)
        ) {
          return null;
        }

        return [_keyPath, { value, isMarkdown: widget === 'markdown' }];
      })
      .filter((entry) => !!entry),
  );
};

/**
 * Update the toast notification.
 * @param {'info' | 'success' | 'error'} status Status.
 * @param {string} message Message key.
 * @param {object} context Context.
 * @param {number} context.count Number of fields copied or translated.
 * @param {InternalLocaleCode} context.sourceLocale Source locale, e.g. `en`.
 */
const updateToast = (status, message, { count, sourceLocale }) => {
  copyFromLocaleToast.set({ id: Date.now(), show: true, status, message, count, sourceLocale });
};

/**
 * Translate the field value(s) from another locale.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.currentValues Current values for the entry draft. This will be
 * updated with the translated values.
 * @param {CopyOptions} args.options Copy options.
 * @param {CopyingFieldMap} args.copingFieldMap Copied or translated field values.
 */
const translateFields = async ({ currentValues, options, copingFieldMap }) => {
  const _translator = get(translator);
  const { sourceLocale, targetLocale } = options;
  const count = Object.keys(copingFieldMap).length;
  const countType = count === 1 ? 'one' : 'many';

  const apiKey =
    get(prefs).apiKeys?.[_translator.serviceId] ||
    (await new Promise((resolve) => {
      // The promise will be resolved once the user enters an API key on the dialog
      translatorApiKeyDialogState.set({ show: true, multiple: count > 1, resolve });
    }));

  if (!apiKey) {
    return;
  }

  updateToast('info', 'translation.started', { count, sourceLocale });

  try {
    const translatedValues = await _translator.translate(
      Object.entries(copingFieldMap).map(([, { value, isMarkdown }]) =>
        // Convert the value from Markdown to HTML if the field is a markdown field, because the
        // translator API expects HTML input
        isMarkdown ? /** @type {string} */ (marked.parse(value)) : value,
      ),
      { apiKey, sourceLocale, targetLocale },
    );

    Object.entries(copingFieldMap).forEach(([_keyPath, { isMarkdown }], index) => {
      const value = translatedValues[index];

      // Convert the value back to Markdown if the field is a markdown field
      currentValues[targetLocale][_keyPath] = isMarkdown
        ? // @ts-ignore Silence a false type error
          turndownService.turndown(value)
        : value;
    });

    updateToast('success', `translation.complete.${countType}`, { count, sourceLocale });
  } catch (ex) {
    // @todo Show a detailed error message.
    updateToast('error', 'translation.error', { count, sourceLocale });
    // eslint-disable-next-line no-console
    console.error(ex);
  }
};

/**
 * Copy the field value(s) from another locale.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.currentValues Current values for the entry draft. This will be
 * updated with the copied values.
 * @param {CopyOptions} args.options Copy options.
 * @param {CopyingFieldMap} args.copingFieldMap Copied or translated field values.
 */
const copyFields = ({ currentValues, options, copingFieldMap }) => {
  const { sourceLocale, targetLocale } = options;
  const count = Object.keys(copingFieldMap).length;
  const countType = count === 1 ? 'one' : 'many';

  Object.entries(copingFieldMap).forEach(([_keyPath, { value }]) => {
    currentValues[targetLocale][_keyPath] = value;
  });

  updateToast('success', `copy.complete.${countType}`, { count, sourceLocale });
};

/**
 * Copy or translate field value(s) from another locale.
 * @param {CopyOptions} options Copy options.
 */
export const copyFromLocale = async (options) => {
  const { sourceLocale, translate = false } = options;
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { currentValues } = draft;
  const copingFieldMap = getCopyingFieldMap({ draft, options });
  const count = Object.keys(copingFieldMap).length;

  if (!count) {
    updateToast('info', `${translate ? 'translation' : 'copy'}.none`, { count, sourceLocale });

    return;
  }

  if (translate) {
    translateFields({ currentValues, options, copingFieldMap });
  } else {
    copyFields({ currentValues, options, copingFieldMap });
  }

  /** @type {Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
    currentValues,
  }));
};

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
