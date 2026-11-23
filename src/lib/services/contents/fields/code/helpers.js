/**
 * @import { CodeField } from '$lib/types/public';
 */

/**
 * Get the property names a Code field stores the code and the language under: the `keys` option,
 * with its default.
 * @param {CodeField} fieldConfig Field configuration.
 * @returns {{ code: string, lang: string } | undefined} Property names, or `undefined` if the field
 * has the `output_code_only` option, so its value is the code itself rather than an object.
 */
export const getCodeKeys = (fieldConfig) => {
  const { output_code_only: outputCodeOnly = false, keys = { code: 'code', lang: 'lang' } } =
    fieldConfig;

  return outputCodeOnly ? undefined : keys;
};

/**
 * Check if the given key is one of the property names a Code field stores the code and the language
 * under. See {@link getCodeKeys}.
 * @param {CodeField} fieldConfig Field configuration.
 * @param {string} key Key.
 * @returns {boolean} Result.
 */
export const isCodeValueKey = (fieldConfig, key) => {
  const keys = getCodeKeys(fieldConfig);

  return !!keys && [keys.code, keys.lang].includes(key);
};
