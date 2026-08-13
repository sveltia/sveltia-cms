import { isObjectArray } from '@sveltia/utils/array';

import { getListItemKeys } from '$lib/services/contents/entry/key-paths';
import { getOrCreateBounded } from '$lib/services/utils/cache';

/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { FieldKeyPath, SelectField } from '$lib/types/public';
 */

/**
 * @type {Map<string, any | any[]>}
 */
const labelCacheMap = new Map();
/**
 * Maximum number of labels to retain in {@link labelCacheMap}. The cache key includes the field’s
 * current value, so every edit adds an entry that is never read again — a limit is what stops the
 * map from growing for the whole session. Labels are small, and the live working set is one entry
 * per rendered select field, so this leaves plenty of headroom.
 */
const MAX_LABEL_CACHE_SIZE = 1000;
/**
 * Cache of stringified `options` arrays, keyed on the array reference itself so the expensive
 * serialization only runs once per field configuration.
 * @type {WeakMap<object[], string>}
 */
const optionsKeyCache = new WeakMap();

/**
 * Get a stable cache key fragment for a field’s `options` array.
 * @param {any[]} options Field options.
 * @returns {string} Cache key.
 */
const getOptionsKey = (options) => {
  let key = optionsKeyCache.get(options);

  if (key === undefined) {
    key = JSON.stringify(options);
    optionsKeyCache.set(options, key);
  }

  return key;
};

/**
 * Get the display value for an option.
 * @param {object} args Arguments.
 * @param {SelectField} args.fieldConfig Field configuration.
 * @param {FlattenedEntryContent} args.valueMap Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath Field key path, e.g. `author.name`.
 * @returns {any | any[]} Resolved field value(s).
 */
export const getOptionLabel = ({ fieldConfig, valueMap, keyPath }) => {
  const { multiple, options } = fieldConfig;
  const hasLabels = isObjectArray(options);
  // Extract only the values relevant to this field from `valueMap`, avoiding serialization of the
  // entire entry content (which would cause cache misses on any unrelated field change).
  /** @type {any[] | undefined} */
  let rawValues;

  if (multiple) {
    rawValues = getListItemKeys(valueMap, keyPath).map((key) => valueMap[key]);
  }

  const optionsKey = getOptionsKey(options);

  const cacheKey = multiple
    ? `${keyPath}|${optionsKey}|${JSON.stringify(rawValues)}`
    : `${keyPath}|${optionsKey}|${String(valueMap[keyPath])}`;

  /**
   * Get the label by value.
   * @param {any} _value Stored value.
   * @returns {string} Label.
   */
  const getLabel = (_value) =>
    /** @type {{ label: string, value: string }[]} */ (options).find((o) => o.value === _value)
      ?.label || _value;

  return getOrCreateBounded(
    labelCacheMap,
    cacheKey,
    () => {
      if (multiple) {
        return hasLabels ? /** @type {any[]} */ (rawValues).map(getLabel) : rawValues;
      }

      const value = valueMap[keyPath];

      return hasLabels ? getLabel(value) : value;
    },
    MAX_LABEL_CACHE_SIZE,
  );
};
