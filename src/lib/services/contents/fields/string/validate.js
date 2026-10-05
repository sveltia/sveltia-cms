/**
 * @import { EntryValidityState, ValidateFieldFuncArgs } from '$lib/types/private';
 * @import { StringField, TextField } from '$lib/types/public';
 */

/**
 * @typedef StringFieldValidationDetail
 * @property {number} count Character count.
 * @property {boolean} hasMin Whether the field has a minimum length.
 * @property {boolean} hasMax Whether the field has a maximum length.
 * @property {boolean} invalid Whether the value is invalid.
 */

/**
 * Validate a String/Text field value against the field configuration.
 * @param {ValidateFieldFuncArgs} args Arguments.
 * @returns {{ validity: EntryValidityState, detail: StringFieldValidationDetail }} Result.
 */
export const validateStringField = ({ fieldConfig, value }) => {
  const config = /** @type {StringField | TextField} */ (fieldConfig);
  const { widget: fieldType = 'string', minlength, maxlength } = config;

  const hasMin =
    Number.isInteger(minlength) && /** @type {number} */ (minlength) <= (maxlength ?? Infinity);

  const hasMax =
    Number.isInteger(maxlength) && (minlength ?? 0) <= /** @type {number} */ (maxlength);

  const { type = 'text', prefix, suffix } = /** @type {StringField} */ (config);
  let trimValue = value ?? '';

  // Remove the prefix and suffix, which the user doesn’t type, before counting and validating
  if (fieldType === 'string') {
    if (prefix && trimValue.startsWith(prefix)) {
      trimValue = trimValue.slice(prefix.length);
    }

    if (suffix && trimValue.endsWith(suffix)) {
      trimValue = trimValue.slice(0, -suffix.length);
    }
  }

  const count = [...trimValue.trim()].length;
  const tooShort = hasMin && count < /** @type {number} */ (minlength);
  const tooLong = hasMax && count > /** @type {number} */ (maxlength);
  let typeMismatch = false;

  // Check the URL or email with native form validation
  if (fieldType === 'string' && trimValue) {
    if (type !== 'text') {
      const inputElement = document.createElement('input');

      inputElement.type = type;
      inputElement.value = trimValue;

      ({ typeMismatch } = inputElement.validity);
    }

    // Check if the email’s domain part contains a dot, because native validation marks
    // `me@example` valid but it’s not valid in the real world
    if (type === 'email' && !typeMismatch && !trimValue.split('@')[1]?.includes('.')) {
      typeMismatch = true;
    }
  }

  const invalid = tooShort || tooLong || typeMismatch;

  return {
    validity: { tooShort, tooLong, typeMismatch },
    detail: { count, hasMin, hasMax, invalid },
  };
};
