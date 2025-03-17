import { isObject } from '@sveltia/utils/object';

/**
 * @import { CodeField, FieldKeyPath } from '$lib/typedefs/public';
 */

/**
 * Get the default value for a Code field.
 * @param {object} args Arguments.
 * @param {CodeField} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @returns {Record<string, any>} Default value.
 * @todo Write tests for this.
 */
export const getDefaultValue = ({ fieldConfig, keyPath }) => {
  /** @type {Record<string, any>} */
  const content = {};

  const {
    default: defaultValue,
    output_code_only: outputCodeOnly = false,
    keys: outputKeys = { code: 'code', lang: 'lang' },
  } = /** @type {CodeField} */ (fieldConfig);

  if (outputCodeOnly) {
    content[keyPath] = typeof defaultValue === 'string' ? defaultValue : '';
  } else {
    const obj = isObject(defaultValue)
      ? /** @type {Record<string, any>} */ (defaultValue)
      : undefined;

    const code = obj ? obj[outputKeys.code] : /** @type {string | undefined} */ (defaultValue);
    const lang = obj ? obj[outputKeys.lang] : '';

    content[keyPath] = {};
    content[`${keyPath}.${outputKeys.code}`] = typeof code === 'string' ? code : '';
    content[`${keyPath}.${outputKeys.lang}`] = typeof lang === 'string' ? lang : '';
  }

  return content;
};
