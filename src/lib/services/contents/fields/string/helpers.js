/**
 * @import { StringField } from '$lib/types/public';
 */

/**
 * Get the value to be shown in the editor’s text input for the given stored value: the value as a
 * string, without the field’s `prefix` and `suffix`, which the editor adds on its own.
 * @param {object} args Arguments.
 * @param {any} args.currentValue Value in the entry draft. A non-string value, e.g. a number from a
 * hand-edited file, is shown as a string.
 * @param {StringField} args.fieldConfig Field configuration.
 * @returns {string} Value to be shown.
 */
export const getStringInputValue = ({ currentValue, fieldConfig }) => {
  const { prefix = '', suffix = '' } = fieldConfig;
  let value = typeof currentValue === 'string' ? currentValue : String(currentValue ?? '');

  if (prefix && value.startsWith(prefix)) {
    value = value.slice(prefix.length);
  }

  if (suffix && value.endsWith(suffix)) {
    value = value.slice(0, -suffix.length);
  }

  return value;
};

/**
 * Get the value to be stored in the entry draft for the given text input value: the value with the
 * field’s `prefix` and `suffix` added, unless it’s blank, so an empty field stays empty.
 * @param {object} args Arguments.
 * @param {string} args.inputValue Value of the text input.
 * @param {StringField} args.fieldConfig Field configuration.
 * @returns {string} Value to be stored.
 */
export const getStringFieldValue = ({ inputValue, fieldConfig }) => {
  const { prefix = '', suffix = '' } = fieldConfig;

  if (inputValue.trim() && (prefix || suffix)) {
    return `${prefix}${inputValue}${suffix}`;
  }

  return inputValue;
};
