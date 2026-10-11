import { getEmptyOptionValue, getOptionValue } from '$lib/services/contents/fields/select/helpers';

/**
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
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
  // A Relation field has no `options`, so its value is always a string
  const options = /** @type {SelectField} */ (config).options ?? [];
  const [firstOption] = options;

  /**
   * Convert a dynamic default value, which comes as a string, to the value of the matching option,
   * so that a number or boolean option is saved as such rather than as a string.
   * @param {string} token Value given in the URL.
   * @returns {any} Option value, or the given string if no option matches.
   */
  const toOptionValue = (token) => {
    const index = options.findIndex((option) => String(getOptionValue(option)) === token);

    return index > -1 ? getOptionValue(options[index]) : token;
  };

  if (dynamicValue !== undefined && !multiple) {
    // A single value is taken as a whole, as it may contain a comma, e.g. `Smith, John`
    const token = dynamicValue.trim();

    return { [keyPath]: token ? toOptionValue(token) : '' };
  }

  // A default can be given as an option object, whose `value` is what gets saved
  const value =
    dynamicValue !== undefined
      ? dynamicValue.split(/,\s*/).map((val) => toOptionValue(val.trim()))
      : Array.isArray(defaultValue)
        ? defaultValue.map(getOptionValue)
        : getOptionValue(defaultValue);

  if (!multiple) {
    return {
      [keyPath]: value !== undefined ? value : getEmptyOptionValue(getOptionValue(firstOption)),
    };
  }

  if (Array.isArray(value) && value.length) {
    return Object.fromEntries(value.map((val, index) => [`${keyPath}.${index}`, val]));
  }

  return { [keyPath]: [] };
};
