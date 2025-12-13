/**
 * @import { StringField, TextField } from '$lib/types/public';
 */

/**
 * @typedef StringFieldValidationResult
 * @property {number} count Character count.
 * @property {boolean} hasMin Whether the field has a minimum length.
 * @property {boolean} hasMax Whether the field has a maximum length.
 * @property {boolean} invalid Whether the value is invalid.
 * @property {object} validity Validity state.
 * @property {boolean} validity.tooShort Whether the value is too short.
 * @property {boolean} validity.tooLong Whether the value is too long.
 * @property {boolean} validity.typeMismatch Whether the value has a type mismatch.
 */

/**
 * Validate a String/Text field value against the field configuration.
 * @param {object} args Arguments.
 * @param {StringField | TextField} args.fieldConfig Field configuration.
 * @param {string | undefined} args.value Current value.
 * @returns {StringFieldValidationResult} Result.
 */
export const validateStringField = ({ fieldConfig, value }) => {
  const { widget: fieldType = 'string', minlength, maxlength } = fieldConfig;

  const hasMin =
    Number.isInteger(minlength) && /** @type {number} */ (minlength) <= (maxlength ?? Infinity);

  const hasMax =
    Number.isInteger(maxlength) && (minlength ?? 0) <= /** @type {number} */ (maxlength);

  const count = value ? [...value.trim()].length : 0;
  const tooShort = hasMin && count < /** @type {number} */ (minlength);
  const tooLong = hasMax && count > /** @type {number} */ (maxlength);
  let typeMismatch = false;

  // Check the URL or email with native form validation
  if (fieldType === 'string' && value) {
    const { type = 'text', prefix, suffix } = /** @type {StringField} */ (fieldConfig);
    let trimValue = value;

    // Remove the prefix/suffix before validation
    if (prefix && trimValue.startsWith(prefix)) {
      trimValue = trimValue.slice(prefix.length);
    }

    if (suffix && trimValue.endsWith(suffix)) {
      trimValue = trimValue.slice(0, -suffix.length);
    }

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

  return {
    count,
    hasMin,
    hasMax,
    invalid: tooShort || tooLong || typeMismatch,
    validity: { tooShort, tooLong, typeMismatch },
  };
};
