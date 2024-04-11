import { isObjectArray } from '$lib/services/utils/misc';
import { escapeRegExp } from '$lib/services/utils/strings';

/**
 * @type {Map<string, any | any[]>}
 */
const labelCache = new Map();

/**
 * Get the display value for an option.
 * @param {object} args - Arguments.
 * @param {SelectField} args.fieldConfig - Field configuration.
 * @param {FlattenedEntryContent} args.valueMap - Object holding current entry values.
 * @param {string} args.keyPath - Field key path, e.g. `author.name`.
 * @returns {any | any[]} Resolved field value(s).
 */
export const getOptionLabel = ({ fieldConfig, valueMap, keyPath }) => {
  const cacheKey = JSON.stringify({ fieldConfig, valueMap, keyPath });
  const cached = labelCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const { multiple, options } = fieldConfig;
  const hasLabels = isObjectArray(options);

  /**
   * Get the label by value.
   * @param {any} _value - Stored value.
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

    labelCache.set(cacheKey, labels);

    return labels;
  }

  const value = valueMap[keyPath];
  const label = hasLabels ? getLabel(value) : value;

  labelCache.set(cacheKey, label);

  return label;
};
