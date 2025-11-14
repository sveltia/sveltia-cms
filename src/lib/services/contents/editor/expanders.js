import { escapeRegExp } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { entryDraft } from '$lib/services/contents/draft';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * LocaleContentMap,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, ObjectField, ListField } from '$lib/types/public';
 */

/**
 * Get the initial object/list expander state based on the `collapsed` option. If `collapsed` is set
 * to `auto`, it checks if there are any values in the object. Otherwise, it uses the `collapsed`
 * option directly, which defaults to `false` (expanded).
 * @param {object} args Arguments.
 * @param {string} args.key Key path of the item. For the List widget, it’s a key path of the list
 * item, e.g. `authors.0`. For the Object widget, it’s a key path of the object with the `#` suffix,
 * e.g. `details#`.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {boolean | 'auto'} [args.collapsed] The `collapsed` option value.
 * @returns {boolean} Whether th expander should be expanded.
 */
export const getInitialExpanderState = ({ key, locale, collapsed = false }) => {
  const _draft = get(entryDraft);
  const currentState = _draft?.expanderStates?._[key];

  if (currentState !== undefined) {
    return currentState;
  }

  if (collapsed === 'auto') {
    const valueMap = _draft?.currentValues?.[locale] ?? {};
    // Regular expression to match any non-nested subfields, with the `#` key suffix removed
    const regex = new RegExp(`^${escapeRegExp(key.replace(/#$/, ''))}\\.[^\\.]+$`);

    return !Object.entries(valueMap).some(([keyPath, value]) => regex.test(keyPath) && !!value);
  }

  return !collapsed;
};

/**
 * Sync the field object/list expander states between locales.
 * @param {Record<FieldKeyPath, boolean>} stateMap Map of key path and state.
 */
export const syncExpanderStates = (stateMap) => {
  entryDraft.update((_draft) => {
    if (_draft) {
      Object.entries(stateMap).forEach(([keyPath, expanded]) => {
        if (_draft.expanderStates._[keyPath] !== expanded) {
          _draft.expanderStates._[keyPath] = expanded;
        }
      });
    }

    return _draft;
  });
};

/**
 * Get a list of keys for the expander states, given the key path. The returned keys could include
 * nested lists and objects.
 * @param {object} args Partial arguments for {@link getField}.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {FlattenedEntryContent} args.valueMap Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath Key path, e.g. `testimonials.0.authors.2.foo`.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @returns {string[]} Keys, e.g. `['testimonials', 'testimonials.0', 'testimonials.0.authors',
 * 'testimonials.0.authors.2', 'testimonials.0.authors.2.foo']`.
 */
export const getExpanderKeys = ({
  collectionName,
  fileName,
  valueMap,
  keyPath,
  isIndexFile = false,
}) => {
  const keys = new Set();
  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };

  keyPath.split('.').forEach((_keyPart, index, arr) => {
    const _keyPath = arr.slice(0, index + 1).join('.');
    const config = getField({ ...getFieldArgs, keyPath: _keyPath });
    const endingWithNumber = /\.\d+$/.test(_keyPath);

    if (config?.widget === 'object') {
      if (endingWithNumber) {
        keys.add(_keyPath);
      }

      keys.add(`${_keyPath}#`);
    } else if (config?.widget === 'list') {
      keys.add(endingWithNumber ? _keyPath : `${_keyPath}#`);
    } else if (index > 0) {
      const parentKeyPath = arr.slice(0, index).join('.');
      const parentConfig = getField({ ...getFieldArgs, keyPath: parentKeyPath });

      if (
        parentConfig?.widget === 'object' &&
        'fields' in /** @type {ObjectField} */ (parentConfig)
      ) {
        keys.add(`${parentKeyPath}.${parentConfig.name}#`);
      }

      if (parentConfig?.widget === 'list' && 'field' in /** @type {ListField} */ (parentConfig)) {
        keys.add(_keyPath);
      }
    }
  });

  return [...keys];
};

/**
 * Expand any invalid fields, including the parent list/object(s).
 * @param {object} args Partial arguments for {@link getField}.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {LocaleContentMap} args.currentValues Field values.
 */
export const expandInvalidFields = ({ collectionName, fileName, currentValues }) => {
  const { validities, isIndexFile } = /** @type {EntryDraft} */ (get(entryDraft));
  /** @type {Record<FieldKeyPath, boolean>} */
  const stateMap = {};

  Object.entries(validities ?? {}).forEach(([locale, validityMap]) => {
    Object.entries(validityMap).forEach(([keyPath, { valid }]) => {
      if (!valid) {
        getExpanderKeys({
          collectionName,
          fileName,
          valueMap: currentValues[locale],
          keyPath,
          isIndexFile,
        }).forEach((key) => {
          stateMap[key] = true;
        });
      }
    });
  });

  syncExpanderStates(stateMap);
};
