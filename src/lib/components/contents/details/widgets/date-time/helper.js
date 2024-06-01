import { getDateTimeParts } from '@sveltia/utils/datetime';
import moment from 'moment';

/**
 * Get the default value for a DateTime field.
 * @param {DateTimeField} fieldConfig - Field configuration.
 * @returns {string} Default value.
 * @todo Write tests for this.
 */
export const getDefaultValue = (fieldConfig) => {
  const {
    default: defaultValue,
    date_format: dateFormat,
    time_format: timeFormat,
    picker_utc: pickerUTC = false,
  } = fieldConfig;

  if (typeof defaultValue === 'string') {
    return defaultValue;
  }

  // Default to current date/time
  const { year, month, day, hour, minute } = getDateTimeParts({
    timeZone: pickerUTC ? 'UTC' : undefined,
  });

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}`;

  if (timeFormat === false) {
    return dateStr;
  }

  if (dateFormat === false) {
    return timeStr;
  }

  if (pickerUTC) {
    return `${dateStr}T${timeStr}:00.000Z`;
  }

  return `${dateStr}T${timeStr}`;
};

/**
 * Get the current value given the input value.
 * @param {string | undefined} inputValue - Value on the date/time input widget.
 * @param {DateTimeField} fieldConfig - Field configuration.
 * @returns {string | undefined} New value.
 * @todo Write tests for this.
 */
export const getCurrentValue = (inputValue, fieldConfig) => {
  const { format, date_format: dateFormat, picker_utc: pickerUTC = false } = fieldConfig;
  const timeOnly = dateFormat === false;

  if (inputValue === '') {
    return '';
  }

  if (!inputValue) {
    return undefined;
  }

  if (timeOnly) {
    return inputValue;
  }

  try {
    if (format) {
      return (pickerUTC ? moment.utc : moment)(inputValue).format(format);
    }

    if (pickerUTC) {
      return new Date(inputValue).toISOString();
    }

    return inputValue;
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return undefined;
  }
};

/**
 * Get the input value given the current value.
 * @param {string | undefined} currentValue - Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig - Field configuration.
 * @returns {string | undefined} New value.
 * @todo Write tests for this.
 */
export const getInputValue = (currentValue, fieldConfig) => {
  const {
    format,
    date_format: dateFormat,
    time_format: timeFormat,
    picker_utc: pickerUTC = false,
  } = fieldConfig;

  const dateOnly = timeFormat === false;
  const timeOnly = dateFormat === false;

  // If the default value is an empty string, the input will be blank by default
  if (!currentValue) {
    return '';
  }

  // If the current value is the standard format, return it as is
  if (
    (dateOnly && currentValue?.match(/^\d{4}-\d{2}-\d{2}$/)) ||
    (timeOnly && currentValue?.match(/^\d{2}:\d{2}$/)) ||
    currentValue?.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  ) {
    return currentValue;
  }

  try {
    const { year, month, day, hour, minute } = getDateTimeParts({
      date: currentValue
        ? (pickerUTC ? moment.utc : moment)(currentValue, format).toDate()
        : new Date(),
      timeZone: pickerUTC ? 'UTC' : undefined,
    });

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${minute}`;

    if (dateOnly) {
      return dateStr;
    }

    if (timeOnly) {
      return timeStr;
    }

    return `${dateStr}T${timeStr}`;
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return '';
  }
};

/**
 * Get a `Date` object given the current value.
 * @param {string | undefined} currentValue - Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig - Field configuration.
 * @returns {Date | undefined} Date.
 * @todo Write tests for this.
 */
export const getDate = (currentValue, fieldConfig) => {
  const { format, date_format: dateFormat, picker_utc: pickerUTC = false } = fieldConfig;
  const timeOnly = dateFormat === false;

  if (!currentValue) {
    return undefined;
  }

  try {
    if (format) {
      return (pickerUTC ? moment.utc : moment)(currentValue, format).toDate();
    }

    if (timeOnly) {
      return new Date(new Date(`${new Date().toJSON().split('T')[0]}T${currentValue}`));
    }

    return new Date(currentValue);
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return undefined;
  }
};
