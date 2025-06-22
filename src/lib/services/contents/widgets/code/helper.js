import { isObject } from '@sveltia/utils/object';

/**
 * @import { CodeField, FieldKeyPath } from '$lib/types/public';
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 */

/**
 * Get the default value map for a Code field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const {
    default: defaultValue,
    output_code_only: outputCodeOnly = false,
    keys: outputKeys = { code: 'code', lang: 'lang' },
  } = /** @type {CodeField} */ (fieldConfig);

  const value = dynamicValue !== undefined ? dynamicValue : defaultValue;

  if (outputCodeOnly) {
    return { [keyPath]: typeof value === 'string' ? value : '' };
  }

  const obj = isObject(value) ? /** @type {Record<string, any>} */ (value) : undefined;
  const code = obj?.[outputKeys.code] ?? value;
  const lang = obj?.[outputKeys.lang] ?? '';

  return {
    [keyPath]: {},
    [`${keyPath}.${outputKeys.code}`]: typeof code === 'string' ? code : '',
    [`${keyPath}.${outputKeys.lang}`]: typeof lang === 'string' ? lang : '',
  };
};
