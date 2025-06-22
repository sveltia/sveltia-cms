import { isObjectArray } from '@sveltia/utils/array';
import { escapeRegExp } from '@sveltia/utils/string';

/**
 * @import { FlattenedEntryContent, GetDefaultValueMapFuncArgs } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField, SelectField } from '$lib/types/public';
 */

/**
 * Get the default value map for a Relation/Select field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const config = /** @type {RelationField | SelectField} */ (fieldConfig);
  const { default: defaultValue, multiple = false } = config;

  const value =
    dynamicValue !== undefined ? dynamicValue.split(/,\s*/).map((val) => val.trim()) : defaultValue;

  const isArray = Array.isArray(value) && !!value.length;

  if (!multiple) {
    if (dynamicValue !== undefined) {
      // For single select with dynamicValue, take the first item from split
      const splitValue = dynamicValue.split(/,\s*/).map((val) => val.trim());

      return { [keyPath]: splitValue[0] || '' };
    }

    return { [keyPath]: value !== undefined ? value : '' };
  }

  if (isArray) {
    return Object.fromEntries(value.map((val, index) => [`${keyPath}.${index}`, val]));
  }

  return { [keyPath]: [] };
};

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
  const cacheKey = JSON.stringify({ fieldConfig, valueMap, keyPath });
  const cache = labelCacheMap.get(cacheKey);

  if (cache) {
    return cache;
  }

  const { multiple, options } = fieldConfig;
  const hasLabels = isObjectArray(options);

  /**
   * Get the label by value.
   * @param {any} _value Stored value.
   * @returns {string} Label.
   */
  const getLabel = (_value) =>
    /** @type {{ label: string, value: string }[]} */ (options).find((o) => o.value === _value)
      ?.label || _value;

  if (multiple) {
    const values = Object.entries(valueMap)
      .filter(([key]) => key.match(`^${escapeRegExp(keyPath)}\\.\\d+$`))
      .map(([, _value]) => _value);

    const labels = hasLabels ? values.map(getLabel) : values;

    labelCacheMap.set(cacheKey, labels);

    return labels;
  }

  const value = valueMap[keyPath];
  const label = hasLabels ? getLabel(value) : value;

  labelCacheMap.set(cacheKey, label);

  return label;
};
