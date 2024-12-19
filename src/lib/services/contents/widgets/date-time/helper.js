import { getDateTimeParts } from '@sveltia/utils/datetime';
import moment from 'moment';

/**
 * Parse the DateTime field configuration and return as normalized format.
 * @param {DateTimeField} fieldConfig - Field config.
 * @returns {DateTimeFieldNormalizedProps} Normalized properties.
 */
export const parseDateTimeConfig = (fieldConfig) => {
  const {
    format,
    date_format: dateFormat = undefined,
    time_format: timeFormat = undefined,
    picker_utc: utc = false,
  } = fieldConfig;

  return {
    format,
    dateFormat,
    timeFormat,
    dateOnly: timeFormat === false,
    timeOnly: dateFormat === false,
    utc,
  };
};

/**
 * Get a `Date` object given the current value.
 * @param {string | undefined} currentValue - Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig - Field configuration.
 * @returns {Date | undefined} Date.
 * @todo Write tests for this.
 */
export const getDate = (currentValue, fieldConfig) => {
  const { format, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

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
 * Get the current value given the input value.
 * @param {string | undefined} inputValue - Value on the date/time input widget.
 * @param {string | undefined} currentValue - Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig - Field configuration.
 * @returns {string | undefined} New value.
 * @todo Write tests for this.
 */
export const getCurrentValue = (inputValue, currentValue, fieldConfig) => {
  const { format, dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);
  // Append seconds (and milliseconds) for data format & framework compatibility
  const timeSuffix = `:00${currentValue?.endsWith('.000') ? '.000' : ''}`;

  if (inputValue === '') {
    return '';
  }

  if (!inputValue) {
    return undefined;
  }

  if (timeOnly) {
    return `${inputValue}${timeSuffix}`;
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

    return `${inputValue}${timeSuffix}`;
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return undefined;
  }
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
    return /** @type {string} */ (
      getCurrentValue(getCurrentDateTime(fieldConfig), '', fieldConfig)
    );
  }

  return defaultValue;
};

/**
 * Get the input value given the current value.
 * @param {string | undefined} currentValue - Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig - Field configuration.
 * @returns {string | undefined} New value.
 * @todo Write tests for this.
 */
export const getInputValue = (currentValue, fieldConfig) => {
  const { dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

  // If the default value is an empty string, the input will be blank by default
  if (!currentValue) {
    return '';
  }

  // If the current value is the standard format, return it as is
  const value = dateOnly
    ? currentValue?.match(/^(?<date>\d{4}-[01]\d-[0-3]\d)\b/)?.groups?.date
    : timeOnly
      ? currentValue?.match(/^(?<time>[0-2]\d:[0-5]\d)\b/)?.groups?.time
      : undefined;

  if (value) {
    return value;
  }

  try {
    const { year, month, day, hour, minute } = getDateTimeParts({
      date: currentValue ? getDate(currentValue, fieldConfig) : new Date(),
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
