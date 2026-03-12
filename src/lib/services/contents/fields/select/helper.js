import { isObjectArray } from '@sveltia/utils/array';

/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { FieldKeyPath, SelectField } from '$lib/types/public';
 */

/**
 * @type {Map<string, any | any[]>}
 */
const labelCacheMap = new Map();

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
  let rawValues;

  if (multiple) {
    const prefix = `${keyPath}.`;

    rawValues = Object.entries(valueMap)
      .filter(([key]) => key.startsWith(prefix) && /^\d+$/.test(key.slice(prefix.length)))
      .map(([, _value]) => _value);
  }

  const cacheKey = multiple
    ? `${keyPath}|${JSON.stringify(options)}|${JSON.stringify(rawValues)}`
    : `${keyPath}|${JSON.stringify(options)}|${String(valueMap[keyPath])}`;

  const cache = labelCacheMap.get(cacheKey);

  if (cache) {
    return cache;
  }

  /**
   * Get the label by value.
   * @param {any} _value Stored value.
   * @returns {string} Label.
   */
  const getLabel = (_value) =>
    /** @type {{ label: string, value: string }[]} */ (options).find((o) => o.value === _value)
      ?.label || _value;

  if (multiple) {
    const labels = hasLabels ? /** @type {any[]} */ (rawValues).map(getLabel) : rawValues;

    labelCacheMap.set(cacheKey, labels);

    return labels;
  }

  const value = valueMap[keyPath];
  const label = hasLabels ? getLabel(value) : value;

  labelCacheMap.set(cacheKey, label);

  return label;
};
