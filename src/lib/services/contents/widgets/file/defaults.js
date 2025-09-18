import { isMultiple } from '$lib/services/integrations/media-libraries/shared';

/**
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 * @import { MediaField } from '$lib/types/public';
 */

/**
 * Get the default value map for a File/Image field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<string, any>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const config = /** @type {MediaField} */ (fieldConfig);
  const defaultValue = config.default;
  const multiple = isMultiple(config);
  /** @type {string | string[]} */
  let value = '';

  if (dynamicValue !== undefined) {
    value = multiple ? dynamicValue.split(/,\s*/) : dynamicValue;
  } else if (multiple) {
    value = Array.isArray(defaultValue) ? defaultValue : [];
  } else {
    value = typeof defaultValue === 'string' ? defaultValue : '';
  }

  /** @type {Record<string, any>} */
  const content = {};

  if (multiple && Array.isArray(value)) {
    value = value.map((val) => val.trim()).filter((val) => val !== '');

    if (value.length) {
      content[keyPath] = [];
      value.forEach((val, index) => {
        content[`${keyPath}.${index}`] = val;
      });
    }
  }

  if (!multiple && typeof value === 'string') {
    value = value.trim();

    if (value) {
      content[keyPath] = value;
    }
  }

  return content;
};
