import { isObject } from '@sveltia/utils/object';
import { get } from 'svelte/store';
import { i18nAutoDupEnabled } from '$lib/services/contents/draft';

/**
 * @import { Writable } from 'svelte/store';
 * @import { EntryDraft, LocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath, KeyValueField } from '$lib/types/public';
 */

/**
 * Get the default value for a KeyValue field.
 * @param {KeyValueField} fieldConfig Field configuration.
 * @returns {Record<string, string>} Default value.
 */
export const getDefaultValue = (fieldConfig) => {
  const { default: defaultValue, required = true } = fieldConfig;

  if (defaultValue && isObject(defaultValue)) {
    return defaultValue;
  }

  if (required) {
    return { '': '' };
  }

  return {};
};

/**
 * Get key-value pairs from the draft store.
 * @param {object} args Arguments.
 * @param {Writable<EntryDraft>} args.entryDraft Draft store.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {LocaleCode} args.locale Current pane’s locale.
 * @returns {[string, string][]} Key-value pairs.
 */
export const getPairs = ({ entryDraft, keyPath, locale }) =>
  Object.entries(get(entryDraft).currentValues[locale] ?? {})
    .filter(([_keyPath]) => _keyPath.startsWith(`${keyPath}.`))
    .map(([_keyPath, value]) => [_keyPath.replace(`${keyPath}.`, ''), value]);

/**
 * Validate the given key-value pairs.
 * @param {object} args Arguments.
 * @param {[string, string][]} args.pairs Key-value pairs.
 * @param {boolean[]} args.edited Whether each pair’s key is edited.
 * @returns {('empty' | 'duplicate' | undefined)[]} Result.
 */
export const validatePairs = ({ pairs, edited }) =>
  pairs.map(([key], index, arr) => {
    if (!key.trim() && edited[index]) {
      return 'empty';
    }

    if (key.trim() && arr.findIndex((i) => i[0] === key) !== index) {
      return 'duplicate';
    }

    return undefined;
  });

/**
 * Save the key-value pairs to the draft store.
 * @param {object} args Arguments.
 * @param {Writable<EntryDraft>} args.entryDraft Draft store.
 * @param {KeyValueField} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {LocaleCode} args.locale Current pane’s locale.
 * @param {[string, string][]} args.pairs Key-value pairs.
 */
export const savePairs = ({ entryDraft, keyPath, locale, fieldConfig, pairs }) => {
  const { i18n } = fieldConfig;

  i18nAutoDupEnabled.set(false);

  entryDraft.update((draft) => {
    if (draft) {
      Object.entries(draft.currentValues).forEach(([_locale, content]) => {
        if (_locale === locale || i18n === 'duplicate') {
          // Clear pairs first
          Object.entries(content).forEach(([_keyPath]) => {
            if (_keyPath.startsWith(`${keyPath}.`)) {
              delete content[_keyPath];
            }
          });

          pairs.forEach(([key, value]) => {
            content[`${keyPath}.${key}`] = value;
          });
        }
      });
    }

    return draft;
  });

  i18nAutoDupEnabled.set(true);
};
