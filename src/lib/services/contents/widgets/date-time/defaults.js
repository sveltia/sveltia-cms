import {
  getCurrentDateTime,
  getCurrentValue,
} from '$lib/services/contents/widgets/date-time/helper';

/**
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 * @import { DateTimeField, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Get the default value for a DateTime field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {string} Default value.
 */
const getDefaultValue = ({ fieldConfig, dynamicValue }) => {
  const config = /** @type {DateTimeField} */ (fieldConfig);
  const defaultValue = config.default;
  const value = dynamicValue ?? defaultValue;

  if (typeof value !== 'string') {
    return '';
  }

  // Decap CMS 3.3.0 changed the default value from the current date/time to blank, requiring
  // `{{now}}` to use the current date/time.
  // @see https://github.com/decaporg/decap-cms/releases/tag/decap-cms%403.3.0
  // @see https://github.com/decaporg/decap-website/commit/01e54d8392e368e5d7b9fec307f50af584b12c91
  if (value === '{{now}}') {
    return /** @type {string} */ (getCurrentValue(getCurrentDateTime(config), '', config));
  }

  return value;
};

/**
 * Get the default value map for a DateTime field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, string>} Default value map.
 */
export const getDefaultValueMap = (args) => ({ [args.keyPath]: getDefaultValue(args) });
