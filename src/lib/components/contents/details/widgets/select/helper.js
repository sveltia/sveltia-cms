import { isObjectArray } from '$lib/services/utils/misc';
import { escapeRegExp } from '$lib/services/utils/strings';

/**
 * Get the display value for an option.
 * @param {object} args Arguments.
 * @param {SelectField} args.fieldConfig Field configuration.
 * @param {FlattenedEntryContent} args.valueMap Object holding current entry values
 * @param {string} args.keyPath Field key path, e.g. `author.name`.
 * @returns {any | any[]} Resolved field value(s).
 */
export const getOptionLabel = ({ fieldConfig, valueMap, keyPath }) => {
  const { multiple, options } = fieldConfig;
  const hasLabels = isObjectArray(options);

  /**
   * Get the label by value.
   * @param {any} _value Stored value.
   * @returns {string} Label.
   */
  const getLabel = (_value) =>
    /** @type {object[]} */ (options).find((o) => o.value === _value)?.label || _value;

  if (multiple) {
    const values = Object.entries(valueMap)
      .filter(([key]) => key.match(`^${escapeRegExp(keyPath)}\\.\\d+$`))
      .map(([, _value]) => _value);

    return hasLabels ? values.map(getLabel) : values;
  }

  const value = valueMap[keyPath];

  return hasLabels ? getLabel(value) : value;
};
