import { getDateTimeParts } from '@sveltia/utils/datetime';
import moment from 'moment';

/**
 * Parse the DateTime field configuration and return as normalized format.
 * @param {DateTimeField} fieldConfig - Field config.
 * @returns {DateTimeFieldNormalizedProps} Normalized properties.
 */
export const parseDateTimeConfig = (fieldConfig) => {
  const {
    date_format: dateFormat = undefined,
    time_format: timeFormat = undefined,
    picker_utc: utc = false,
  } = fieldConfig;

  return {
    dateFormat,
    timeFormat,
    dateOnly: timeFormat === false,
    timeOnly: dateFormat === false,
    utc,
  };
};

/**
 * Get the current date/time.
 * @param {DateTimeField} fieldConfig - Field configuration.
 * @returns {string} Current date/time in the ISO 8601 format.
 */
export const getCurrentDateTime = (fieldConfig) => {
  const { dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

  const { year, month, day, hour, minute } = getDateTimeParts({
    timeZone: utc ? 'UTC' : undefined,
  });

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}`;

  if (dateOnly) {
    return dateStr;
  }

  if (timeOnly) {
    return timeStr;
  }

  if (utc) {
    return `${dateStr}T${timeStr}:00.000Z`;
  }

  return `${dateStr}T${timeStr}`;
};

/**
 * Get the default value for a DateTime field.
 * @param {DateTimeField} fieldConfig - Field configuration.
 * @returns {string} Default value.
 * @todo Write tests for this.
 */
export const getDefaultValue = (fieldConfig) => {
  const { default: defaultValue } = fieldConfig;

  if (typeof defaultValue !== 'string') {
    return '';
  }

  // Decap CMS 3.3.0 changed the default value from the current date/time to blank, requiring
  // `{{now}}` to use the current date/time.
  // @see https://github.com/decaporg/decap-cms/releases/tag/decap-cms%403.3.0
  // @see https://github.com/decaporg/decap-website/commit/01e54d8392e368e5d7b9fec307f50af584b12c91
  if (defaultValue === '{{now}}') {
    return getCurrentDateTime(fieldConfig);
  }

  return defaultValue;
};

/**
 * Get the current value given the input value.
 * @param {string | undefined} inputValue - Value on the date/time input widget.
 * @param {DateTimeField} fieldConfig - Field configuration.
 * @returns {string | undefined} New value.
 * @todo Write tests for this.
 */
export const getCurrentValue = (inputValue, fieldConfig) => {
  const { format } = fieldConfig;
  const { dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

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
      return (utc ? moment.utc : moment)(inputValue).format(format);
    }

    if (utc) {
      return new Date(inputValue).toISOString();
    }

    if (dateOnly) {
      return inputValue;
    }

    // Append seconds for framework (Hugo) compatibility
    return `${inputValue}:00`;
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
  const { format } = fieldConfig;
  const { dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

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
      date: currentValue ? (utc ? moment.utc : moment)(currentValue, format).toDate() : new Date(),
      timeZone: utc ? 'UTC' : undefined,
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
  const { format } = fieldConfig;
  const { timeOnly, utc } = parseDateTimeConfig(fieldConfig);

  if (!currentValue) {
    return undefined;
  }

  try {
    if (timeOnly) {
      return new Date(new Date(`${new Date().toJSON().split('T')[0]}T${currentValue}`));
    }

    if (format) {
      return (utc ? moment.utc : moment)(currentValue, format).toDate();
    }

    return new Date(currentValue);
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return undefined;
  }
};
