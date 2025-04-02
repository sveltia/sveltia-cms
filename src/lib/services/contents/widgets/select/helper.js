import { isObjectArray } from '@sveltia/utils/array';
import { escapeRegExp } from '@sveltia/utils/string';

/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField, SelectField } from '$lib/types/public';
 */

/**
 * Get the default value map for a Relation/Select field.
 * @param {object} args Arguments.
 * @param {RelationField | SelectField} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @returns {Record<string, any>} Default value map.
 */
export const getSelectFieldDefaultValueMap = ({ fieldConfig, keyPath }) => {
  const { default: defaultValue, multiple = false } = fieldConfig;
  const isArray = Array.isArray(defaultValue) && !!defaultValue.length;
  /** @type {Record<string, any>}  */
  const content = {};

  if (!multiple) {
    content[keyPath] = defaultValue !== undefined ? defaultValue : '';
  } else if (isArray) {
    defaultValue.forEach((value, index) => {
      content[[keyPath, index].join('.')] = value;
    });
  } else {
    content[keyPath] = [];
  }

  return content;
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
