import { isObjectArray } from '@sveltia/utils/array';
import { isObject } from '@sveltia/utils/object';

import { getListItemKeys } from '$lib/services/contents/entry/key-paths';
import { getOrCreateBounded } from '$lib/services/utils/cache';

/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { FieldKeyPath, SelectField, SelectFieldValue } from '$lib/types/public';
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

/**
 * Check whether a value is one of the options of a Select field. `null`, `false` and an empty
 * string can be valid choices, so this tells a selected option apart from a missing value.
 * @param {object} args Arguments.
 * @param {SelectField} args.fieldConfig Field configuration.
 * @param {any} args.value Stored value.
 * @returns {boolean} Whether the value is one of the options.
 */
export const isOptionValue = ({ fieldConfig, value }) =>
  fieldConfig.options.some((option) => (isObject(option) ? option.value : option) === value);

/**
 * Get the labels to be shown in the preview of a Select field. A value is shown by its label if
 * the options have labels; otherwise, or if the value is not found in the options, it’s shown as
 * is.
 * @param {object} args Arguments.
 * @param {SelectField} args.fieldConfig Field configuration.
 * @param {SelectFieldValue | SelectFieldValue[] | undefined} args.currentValue Stored value(s).
 * @returns {string[]} Labels, sorted if there are multiple values. Empty if there is no value,
 * including `null` unless it’s one of the options.
 */
export const getPreviewLabels = ({ fieldConfig, currentValue }) => {
  const { options, multiple = false } = fieldConfig;
  const hasLabels = isObjectArray(options);

  /**
   * Get the label by value.
   * @param {SelectFieldValue} value Stored value.
   * @returns {string} Label.
   */
  const getLabel = (value) =>
    hasLabels
      ? /** @type {{ label: string, value: SelectFieldValue }[]} */ (options).find(
          (o) => o.value === value,
        )?.label || String(value)
      : String(value);

  if (multiple) {
    return Array.isArray(currentValue) ? currentValue.map(getLabel).sort() : [];
  }

  return currentValue === undefined ||
    (currentValue === null && !isOptionValue({ fieldConfig, value: null }))
    ? []
    : [getLabel(/** @type {SelectFieldValue} */ (currentValue))];
};

/**
 * Get the data type of a Select field option value, which `@sveltia/ui` uses to cast the value
 * read from the option element’s `data-value` attribute back to the original type. `null` is typed
 * as a number: the attribute is omitted for `null`, and a missing number is cast to `null`.
 * @param {SelectFieldValue} value Option value.
 * @returns {string} Data type.
 */
export const getOptionValueType = (value) => (value === null ? 'number' : typeof value);

/**
 * Get the value that clears a single Select field, which the “unselected” option holds and a new
 * entry starts with: an empty string if the options are strings, or `null` if they are another
 * type, e.g. numbers or booleans, for which an empty string would be a type mismatch. The type is
 * taken from the first option.
 * @param {SelectFieldValue | undefined} firstValue Value of the first option, or `undefined` if
 * there are no options.
 * @returns {'' | null} Empty value.
 */
export const getEmptyOptionValue = (firstValue) =>
  firstValue === undefined || typeof firstValue === 'string' ? '' : null;
