/**
 * Validate a String/Text field value against the field configuration.
 * @param {StringField | TextField} fieldConfig - Field configuration.
 * @param {string | undefined} value - Current value.
 * @returns {{ count: number, hasMin: boolean, hasMax: boolean, tooShort: boolean, tooLong: boolean,
 * invalid: boolean }} Result.
 */
export const validateStringField = (fieldConfig, value) => {
  const { minlength, maxlength } = fieldConfig;

  const hasMin =
    Number.isInteger(minlength) && /** @type {number} */ (minlength) <= (maxlength ?? Infinity);

  const hasMax =
    Number.isInteger(maxlength) && (minlength ?? 0) <= /** @type {number} */ (maxlength);

  const count = value ? [...value.trim()].length : 0;
  const tooShort = hasMin && count < /** @type {number} */ (minlength);
  const tooLong = hasMax && count > /** @type {number} */ (maxlength);
  const invalid = tooShort || tooLong;

  return { count, hasMin, hasMax, tooShort, tooLong, invalid };
};
