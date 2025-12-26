import { getDateTimeParts } from '@sveltia/utils/datetime';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsLocalizedFormat from 'dayjs/plugin/localizedFormat';
import dayjsUTC from 'dayjs/plugin/utc';

import { getCanonicalLocale } from '$lib/services/contents/i18n';
import {
  DATE_FORMAT_OPTIONS,
  DATE_REGEX,
  TIME_FORMAT_OPTIONS,
  TIME_SUFFIX_REGEX,
} from '$lib/services/utils/date';

/**
 * @import { DateTimeFieldNormalizedProps, InternalLocaleCode } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsLocalizedFormat);
dayjs.extend(dayjsUTC);

/**
 * Parse the DateTime field configuration and return as normalized format.
 * @param {DateTimeField} fieldConfig Field config.
 * @returns {DateTimeFieldNormalizedProps} Normalized properties.
 */
export const parseDateTimeConfig = (fieldConfig) => {
  const {
    format,
    date_format: dateFormat = undefined,
    time_format: timeFormat = undefined,
    picker_utc: utc = false,
  } = fieldConfig;

  const dateFormatStr = typeof dateFormat === 'string' ? dateFormat : '';
  const timeFormatStr = typeof timeFormat === 'string' ? timeFormat : '';

  return {
    format: format || [dateFormatStr, timeFormatStr].join(' ').trim() || undefined,
    dateOnly: timeFormat === false,
    timeOnly: dateFormat === false,
    utc,
  };
};

/**
 * Check if the given value is a valid `Date` object.
 * @param {any} input Value to check.
 * @returns {input is Date} `true` if valid `Date`, `false` otherwise.
 */
export const isValidDate = (input) => input instanceof Date && !Number.isNaN(input.getTime());

/**
 * Get the Day.js parser based on UTC setting.
 * @param {boolean} utc UTC flag.
 * @returns {dayjs.utc | dayjs} Day.js parser.
 */
export const getParser = (utc) => (utc ? dayjs.utc : dayjs);

/**
 * Get a `Date` object given the current value.
 * @param {string | undefined} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {Date | undefined} Date or `undefined` if invalid.
 */
export const getDate = (currentValue, fieldConfig) => {
  const { format, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

  if (!currentValue) {
    return undefined;
  }

  /** @type {Date | undefined} */
  let date;

  // If a format is specified, use Day.js to parse
  if (format) {
    const parse = getParser(utc);
    // Parse using the specified format
    let parsed = parse(currentValue, format);

    // Fallback: Try parsing without format
    if (!parsed.isValid()) {
      parsed = parse(currentValue);

      if (!parsed.isValid()) {
        // eslint-disable-next-line no-console
        console.error('Invalid Date', currentValue);

        return undefined;
      }
    }

    return parsed.toDate();
  }

  if (timeOnly) {
    // Use the current date
    date = new Date(`${new Date().toJSON().split('T')[0]}T${currentValue}`);
  } else {
    date = new Date(currentValue);
  }

  if (isValidDate(date)) {
    return date;
  }

  // eslint-disable-next-line no-console
  console.error('Invalid Date', currentValue);

  return undefined;
};

/**
 * Get the current date/time.
 * @param {DateTimeField} fieldConfig Field configuration.
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
 * @param {string | undefined} inputValue Value on the date/time input control.
 * @param {string | undefined} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {string | undefined} New value.
 */
export const getCurrentValue = (inputValue, currentValue, fieldConfig) => {
  const { format, dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);
  const inputFormat = dateOnly ? 'YYYY-MM-DD' : timeOnly ? 'HH:mm' : 'YYYY-MM-DDTHH:mm';
  // Append seconds (and milliseconds) for data format & framework compatibility
  const timeSuffix = `:00${currentValue?.endsWith('.000') ? '.000' : ''}`;

  if (inputValue === '') {
    return '';
  }

  if (!inputValue) {
    return undefined;
  }

  if (format) {
    const parse = getParser(utc);
    let parsed = parse(inputValue, inputFormat);

    // Fallback: Try parsing without format
    if (!parsed.isValid()) {
      parsed = parse(inputValue);

      if (!parsed.isValid()) {
        // eslint-disable-next-line no-console
        console.info('Invalid date', inputValue);

        return '';
      }
    }

    return parsed.format(format);
  }

  if (dateOnly) {
    return inputValue;
  }

  if (utc) {
    return `${inputValue}:00.000Z`;
  }

  return `${inputValue}${timeSuffix}`;
};

/**
 * Get the input value given the current value.
 * @param {string | undefined} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {string | undefined} New value.
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
      ? // Match both `YYYY-MM-DDTHH:mm(:ss)` and `HH:mm(:ss)` formats
        currentValue?.match(/(?:^|T)(?<time>[0-2]\d:[0-5]\d)\b/)?.groups?.time
      : undefined;

  if (value) {
    return value;
  }

  const dateForParts = currentValue ? getDate(currentValue, fieldConfig) : new Date();

  // If `getDate` returned `undefined` (parsing failed), return empty string
  if (!dateForParts) {
    return '';
  }

  const { year, month, day, hour, minute } = getDateTimeParts({
    date: dateForParts,
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
};

/**
 * Get the display value of a DateTime field.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {DateTimeField} args.fieldConfig Field configuration.
 * @param {string | undefined} args.currentValue Stored value.
 * @returns {string} Display value.
 */
export const getDateTimeFieldDisplayValue = ({ locale, fieldConfig, currentValue }) => {
  const { format, dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

  if (typeof currentValue !== 'string' || !currentValue.trim()) {
    return '';
  }

  if (format) {
    const parse = getParser(utc);
    // Parse using the specified format
    let parsed = parse(currentValue, format);

    // Fallback: Try parsing without format
    if (!parsed.isValid()) {
      parsed = parse(currentValue);

      if (!parsed.isValid()) {
        // eslint-disable-next-line no-console
        console.error('Invalid Date', currentValue);

        return '';
      }
    }

    return parsed.format(format);
  }

  const date = getDate(currentValue, fieldConfig);
  const canonicalLocale = getCanonicalLocale(locale);

  if (!isValidDate(date)) {
    return '';
  }

  if (timeOnly) {
    return date.toLocaleTimeString(canonicalLocale, TIME_FORMAT_OPTIONS);
  }

  if (dateOnly) {
    return date.toLocaleDateString(canonicalLocale, {
      ...DATE_FORMAT_OPTIONS,
      timeZone:
        utc || DATE_REGEX.test(currentValue) || TIME_SUFFIX_REGEX.test(currentValue)
          ? 'UTC'
          : undefined,
    });
  }

  return date.toLocaleString(canonicalLocale, {
    ...DATE_FORMAT_OPTIONS,
    ...TIME_FORMAT_OPTIONS,
    timeZone: utc ? 'UTC' : undefined,
    timeZoneName: utc ? undefined : 'short',
  });
};
