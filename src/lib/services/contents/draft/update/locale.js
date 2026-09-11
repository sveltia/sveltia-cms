import { toRaw } from '@sveltia/utils/object';

import { suspendAutoDuplication } from '$lib/services/contents/draft';
import { createProxy } from '$lib/services/contents/draft/create/proxy.svelte';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { getField } from '$lib/services/contents/entry/fields';
import { getDuplicateKeysFieldKeyPaths } from '$lib/services/contents/fields/key-value/duplicate-keys';
import { getPairsFromContent, setPairs } from '$lib/services/contents/fields/key-value/pairs';

/**
 * @import { EntryDraft, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { Field, FieldKeyPath, HiddenField } from '$lib/types/public';
 */

/**
 * Run the given callback for every locale a field update has to be written to.
 *
 * A field with the `duplicate` i18n strategy holds the same value in every locale, so an update has
 * to reach all of them; any other field is written to the given locale only.
 *
 * The draft proxy duplicates a `duplicate` field on its own whenever a value is assigned, which
 * would write every value twice here, so the callback runs with that suspended. Suspensions nest,
 * so a caller whose operation is wider than this loop can still suspend around the whole thing.
 * @param {object} args Arguments.
 * @param {Record<InternalLocaleCode, FlattenedEntryContent> | undefined} args.valueStore Value
 * store to update, e.g. `draft.currentValues`, keyed by locale.
 * @param {InternalLocaleCode} args.locale Locale being edited.
 * @param {Field['i18n']} args.i18n Field i18n configuration.
 * @param {(valueMap: FlattenedEntryContent, locale: InternalLocaleCode) => void} callback Function
 * to run for each target locale, taking that locale’s content and the locale code.
 */
export const forEachTargetLocale = ({ valueStore, locale, i18n }, callback) => {
  suspendAutoDuplication(() => {
    Object.entries(valueStore ?? {}).forEach(([_locale, valueMap]) => {
      if (_locale === locale || i18n === 'duplicate') {
        callback(valueMap, _locale);
      }
    });
  });
};

/**
 * Populate the given localized content with values from the default locale.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {FlattenedEntryContent} args.content Original content for the current locale.
 * @param {InternalLocaleCode} args.targetLanguage Target locale.
 * @param {FieldKeyPath} [args.keyPathPrefix] Key path of the parent Object field being populated,
 * e.g. `blocks.0.image`. When specified, only the keys under that key path are returned, so
 * unrelated default locale fields — including list items that don’t exist in the target locale —
 * are not copied over. The whole default locale content is still used to look up field
 * configurations, which requires sibling keys such as a variable type key.
 * @returns {FlattenedEntryContent} Updated content.
 */
export const copyDefaultLocaleValues = ({ draft, content, targetLanguage, keyPathPrefix }) => {
  const { collectionName, fileName, collection, collectionFile, currentValues, isIndexFile } =
    draft;

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
      noI18nFieldKeys.some((key) => keyPath === key || keyPath.startsWith(`${key}.`))
    ) {
      delete newContent[keyPath];
      noI18nFieldKeys.push(keyPath);
    }
  });

  // A KeyValue field with the `duplicate_keys` strategy takes its keys from the default locale but
  // not its values, which are left for the user to fill in like a translatable text field. The
  // merged content holds the pairs of every such field that is still enabled in this locale
  getDuplicateKeysFieldKeyPaths({
    valueStore: { [targetLanguage]: newContent },
    getFieldArgs,
  }).forEach((keyPath) => {
    setPairs(
      newContent,
      keyPath,
      getPairsFromContent(defaultLocaleContent, keyPath).map(([key]) => [
        key,
        content[`${keyPath}.${key}`] ?? '',
      ]),
    );
  });

  if (keyPathPrefix !== undefined) {
    return Object.fromEntries(
      Object.entries(newContent).filter(([keyPath]) => keyPath.startsWith(`${keyPathPrefix}.`)),
    );
  }

  return newContent;
};

/**
 * Enable or disable the given locale’s content output for the entry draft.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale.
 */
export const toggleLocale = ({ draft, locale }) => {
  const { fields, defaultLocale, currentLocales, currentValues, validities, validationMessages } =
    draft;

  const enabled = !currentLocales[locale];

  currentLocales[locale] = enabled;

  // Initialize the content for the locale
  if (enabled && !currentValues[locale]) {
    const newContent = getDefaultValues({ fields, locale, defaultLocale });

    draft.originalValues[locale] = newContent;

    currentValues[locale] = createProxy({
      draft,
      locale,
      target: copyDefaultLocaleValues({ draft, content: newContent, targetLanguage: locale }),
    });

    return;
  }

  validities[locale] = {};
  validationMessages[locale] = {};
};
