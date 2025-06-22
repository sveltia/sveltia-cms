import { isObject } from '@sveltia/utils/object';
import { get } from 'svelte/store';
import { i18nAutoDupEnabled } from '$lib/services/contents/draft';
import { isFieldRequired } from '$lib/services/contents/entry/fields';

/**
 * @import { Writable } from 'svelte/store';
 * @import {
 * EntryDraft,
 * GetDefaultValueMapFuncArgs,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, KeyValueField } from '$lib/types/public';
 */

/**
 * Get the default value for a KeyValue field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<string, any>} Default value.
 */
const getDefaultValue = ({ fieldConfig, locale }) => {
  const { default: defaultValue } = /** @type {KeyValueField} */ (fieldConfig);
  const required = isFieldRequired({ fieldConfig, locale });

  if (defaultValue && isObject(defaultValue)) {
    return defaultValue;
  }

  if (required) {
    return { '': '' };
  }

  return {};
};

/**
 * Get the default value map for a KeyValue field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, string>} Default value map.
 */
export const getDefaultValueMap = (args) => {
  const { keyPath, dynamicValue } = args;
  /** @type {Record<string, any> | undefined} */
  let valueMap;

  if (dynamicValue !== undefined) {
    try {
      const jsonValue = JSON.parse(dynamicValue);

      if (isObject(jsonValue)) {
        // Valid JSON object, use it (even if empty)
        valueMap = /** @type {Record<string, any>} */ (jsonValue);
      }
    } catch {
      // Invalid JSON
    }
  }

  valueMap ??= getDefaultValue(args);

  return Object.fromEntries(
    Object.entries(valueMap)
      .filter(([, val]) => typeof val === 'string')
      .map(([key, val]) => [`${keyPath}.${key}`, val]),
  );
};

/**
 * Get key-value pairs from the draft store.
 * @param {object} args Arguments.
 * @param {Writable<EntryDraft>} args.entryDraft Draft store.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Current pane’s locale.
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
 * @param {InternalLocaleCode} args.locale Current pane’s locale.
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
