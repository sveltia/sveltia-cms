import { toRaw } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { entryDraft } from '$lib/services/contents/draft';
import { createProxy } from '$lib/services/contents/draft/create/proxy';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import { Writable } from 'svelte/store';
 * @import { EntryDraft, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { HiddenField } from '$lib/types/public';
 */

/**
 * Populate the given localized content with values from the default locale.
 * @param {FlattenedEntryContent} content Original content for the current locale.
 * @param {InternalLocaleCode} targetLanguage Target locale.
 * @returns {FlattenedEntryContent} Updated content.
 */
export const copyDefaultLocaleValues = (content, targetLanguage) => {
  const { collectionName, fileName, collection, collectionFile, currentValues, isIndexFile } =
    /** @type {EntryDraft} */ (get(entryDraft));

  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  /** @type {FlattenedEntryContent} */
  const defaultLocaleContent = toRaw(currentValues[defaultLocale]);
  const newContent = { ...toRaw(content), ...defaultLocaleContent };
  const getFieldArgs = { collectionName, fileName, valueMap: newContent, isIndexFile };
  /** @type {string[]} */
  const noI18nFieldKeys = [];

  // Process the merged content
  Object.keys(newContent).forEach((keyPath) => {
    const field = getField({ ...getFieldArgs, keyPath });

    if (!field) {
      return;
    }

    const { widget: fieldType = 'text', i18n = false } = field;

    // Reset the field value to the default value or an empty string if the field is a text-like
    // field type and i18n is enabled, because the content would likely be translated by the user.
    // Otherwise, the content would be copied from the default locale.
    if (
      ['text', 'string', 'richtext', 'markdown'].includes(fieldType) &&
      [true, 'translate'].includes(i18n)
    ) {
      newContent[keyPath] = content[keyPath] ?? '';
    }

    // Support special case for the Hidden field with `default` value set to `{{locale}}`: if the
    // field value is `{{locale}}`, replace it with the target locale
    if (fieldType === 'hidden' && [true, 'translate'].includes(i18n)) {
      const { default: defaultValue } = /** @type {HiddenField} */ (field);

      if (defaultValue === '{{locale}}') {
        newContent[keyPath] = targetLanguage;
      }
    }

    // Remove `null` values for object fields if i18n is enabled and the field is enabled in the
    // default locale, otherwise the subfields will not be saved in the current locale
    if (
      fieldType === 'object' &&
      [true, 'translate', 'duplicate'].includes(i18n) &&
      defaultLocaleContent[keyPath] !== null
    ) {
      delete newContent[keyPath];
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
    const { fields, defaultLocale, currentLocales, currentValues, validities } = _draft;
    const enabled = !currentLocales[locale];

    // Initialize the content for the locale
    if (enabled && !currentValues[locale]) {
      const { collectionName, fileName, originalValues } = _draft;
      const newContent = getDefaultValues({ fields, locale, defaultLocale });

      return {
        ..._draft,
        currentLocales: { ...currentLocales, [locale]: enabled },
        originalValues: { ...originalValues, [locale]: newContent },
        currentValues: {
          ...currentValues,
          [locale]: createProxy({
            draft: { collectionName, fileName },
            locale,
            target: copyDefaultLocaleValues(newContent, locale),
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
