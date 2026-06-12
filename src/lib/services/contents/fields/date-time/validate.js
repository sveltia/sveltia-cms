import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';
import { getInputValue } from '$lib/services/contents/fields/date-time/helper';

/**
 * @import { EntryValidityState, ValidateFieldFuncArgs } from '$lib/types/private';
 * @import { DateTimeField, DateTimeInputType } from '$lib/types/public';
 */

/**
 * @typedef DateTimeFieldValidationDetail
 * @property {boolean} hasMin Whether the field has a minimum value.
 * @property {boolean} hasMax Whether the field has a maximum value.
 * @property {boolean} invalid Whether the value is invalid.
 */

/**
 * Validate a DateTime field value against the field configuration.
 * @param {ValidateFieldFuncArgs} args Arguments.
 * @returns {{ validity: EntryValidityState, detail: DateTimeFieldValidationDetail }} Result.
 */
export const validateDateTimeField = ({ fieldConfig, value }) => {
  const config = /** @type {DateTimeField} */ (fieldConfig);
  const { type, min, max, singleCustomTimeZone: timeZone } = parseDateTimeConfig(config);
  const hasMin = typeof min === 'string' && !!min;
  const hasMax = typeof max === 'string' && !!max;
  let rangeUnderflow = false;
  let rangeOverflow = false;

  if (value && (hasMin || hasMax)) {
    // Convert stored value to native input format for comparison
    const inputValue = getInputValue({ currentValue: value, fieldConfig: config, timeZone });

    if (inputValue) {
      const inputElement = document.createElement('input');

      inputElement.type = type;
      if (hasMin) inputElement.min = min;
      if (hasMax) inputElement.max = max;
      inputElement.value = inputValue;

      ({ rangeUnderflow, rangeOverflow } = inputElement.validity);
    }
  }

  const invalid = rangeUnderflow || rangeOverflow;

  return {
    validity: { rangeUnderflow, rangeOverflow },
    detail: { hasMin, hasMax, invalid },
  };
};

/**
 * Intl.DateTimeFormat instance for formatting time strings in a more human-friendly way.
 */
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour12: true,
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Format a time string (e.g. "14:30") to a more human-friendly format (e.g. "2:30 PM").
 * @param {string} value Time string in "HH:mm" format.
 * @returns {string} Formatted time string.
 */
export const formatTime = (value) =>
  timeFormatter.format(new Date(`1970-01-01T${value}Z`)).toUpperCase();

/**
 * Format a date/time string based on the field type and configuration. For date-only fields, it
 * returns the date part. For time-only fields, it returns the time part formatted in a more
 * human-friendly way. For date-time fields, it returns both parts formatted in a more
 * human-friendly way.
 * @param {DateTimeInputType} type The type of the date/time field.
 * @param {string} value Date/time string in ISO format.
 * @returns {string} Formatted date/time string.
 */
export const getFormattedDateTime = (type, value) => {
  if (type === 'date') {
    return value;
  }

  if (type === 'time') {
    return formatTime(value);
  }

  const [datePart, timePart] = value.split('T');

  return `${datePart}, ${formatTime(timePart)}`;
};
