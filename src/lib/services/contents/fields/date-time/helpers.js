import { getDateTimeParts } from '@sveltia/utils/datetime';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsLocalizedFormat from 'dayjs/plugin/localizedFormat';
import dayjsTimeZone from 'dayjs/plugin/timezone';
import dayjsUTC from 'dayjs/plugin/utc';

import { getCanonicalLocale } from '$lib/services/contents/i18n';
import {
  DATE_FORMAT_OPTIONS,
  DATE_REGEX,
  TIME_FORMAT_OPTIONS,
  TIME_SUFFIX_REGEX,
} from '$lib/services/utils/date';

import { parseDateTimeConfig } from './config.js';
import { getTimeZoneForStoredValue } from './timezone.js';

/**
 * @import { DateTimeFieldNormalizedProps, InternalLocaleCode } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsLocalizedFormat);
dayjs.extend(dayjsUTC);
dayjs.extend(dayjsTimeZone);

const DATE_ONLY_MATCH_REGEX = /^(?<date>\d{4}-[01]\d-[0-3]\d)\b/;
const TIME_SUFFIX_MATCH_REGEX = /(?:^|T)(?<time>[0-2]\d:[0-5]\d)\b/;

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
 * Parse a value with Day.js, falling back to the default parser when the supplied format fails.
 * @param {object} args Arguments.
 * @param {string} args.value Value to parse.
 * @param {string} args.format Format string.
 * @param {boolean} args.parseAsUTC Whether to parse as UTC.
 * @returns {dayjs.Dayjs} Parsed dayjs instance.
 */
const parseWithFormatFallback = ({ value, format, parseAsUTC }) => {
  const parse = getParser(parseAsUTC);
  const parsed = parse(value, format);

  return parsed.isValid() ? parsed : parse(value);
};

/**
 * Build the display-ready date/time strings from the current parts.
 * @param {object} args Arguments.
 * @param {Date} [args.date] Date to derive parts from.
 * @param {string} [args.timeZone] IANA timezone name.
 * @param {DateTimeFieldNormalizedProps['inputTimeZone']} [args.inputTimeZone] Input timezone
 * setting.
 * @param {boolean} [args.dateOnly] Whether the field is date-only.
 * @param {boolean} [args.timeOnly] Whether the field is time-only.
 * @param {boolean} [args.includeUTCSeconds] Whether to append UTC seconds/milliseconds.
 * @returns {string} Formatted display string.
 */
const formatDateTimeValue = ({
  date,
  timeZone,
  inputTimeZone,
  dateOnly,
  timeOnly,
  includeUTCSeconds = false,
}) => {
  const tz = timeZone || (inputTimeZone === 'utc' ? 'UTC' : undefined);
  const { year, month, day, hour, minute } = getDateTimeParts({ date, timeZone: tz });
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}`;

  if (dateOnly) {
    return dateStr;
  }

  if (timeOnly) {
    return timeStr;
  }

  if (includeUTCSeconds && tz === 'UTC') {
    return `${dateStr}T${timeStr}:00.000Z`;
  }

  return `${dateStr}T${timeStr}`;
};

/**
 * Get a `Date` object given the current value.
 * @param {string | undefined} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {Date | undefined} Date or `undefined` if invalid.
 */
export const getDate = (currentValue, fieldConfig) => {
  const { format, timeOnly, utc, outputUTC } = parseDateTimeConfig(fieldConfig);
  // Parse the stored value as UTC when: `input_timezone` is 'utc', OR `output_utc` is `true`. With
  // a custom format, the stored string carries no timezone info, so we must specify UTC explicitly
  // — otherwise the browser’s local offset is applied and the epoch is wrong.
  const parseAsUTC = utc || outputUTC;

  if (!currentValue) {
    return undefined;
  }

  /** @type {Date | undefined} */
  let date;

  // If a format is specified, use Day.js to parse
  if (format) {
    const parsed = parseWithFormatFallback({ value: currentValue, format, parseAsUTC });

    if (parsed.isValid()) {
      return parsed.toDate();
    }

    // eslint-disable-next-line no-console
    console.error('Invalid Date', currentValue);

    return undefined;
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
 * @param {string} [timeZone] IANA timezone name.
 * @returns {string} Current date/time in the ISO 8601 format.
 */
export const getCurrentDateTime = (fieldConfig, timeZone) => {
  const { dateOnly, timeOnly, inputTimeZone } = parseDateTimeConfig(fieldConfig);

  return formatDateTimeValue({
    timeZone,
    inputTimeZone,
    dateOnly,
    timeOnly,
    includeUTCSeconds: true,
  });
};

/**
 * Get the final storable value from the input value.
 * @param {object} args Arguments.
 * @param {string | undefined} args.inputValue Raw value from the input field.
 * @param {string | undefined} args.currentValue Current value in the entry.
 * @param {DateTimeField} args.fieldConfig Field configuration.
 * @param {string | undefined} [args.timeZone] IANA timezone name.
 * @param {boolean} [args.outputUTC] Whether to output UTC time.
 * @returns {string | undefined} The final value.
 */
export const getCurrentValue = ({ inputValue, currentValue, fieldConfig, timeZone, outputUTC }) => {
  const {
    format,
    dateOnly,
    timeOnly,
    inputTimeZone,
    outputUTC: configOutputUTC,
  } = parseDateTimeConfig(fieldConfig);

  const _outputUTC = outputUTC ?? configOutputUTC;
  const inputFormat = dateOnly ? 'YYYY-MM-DD' : timeOnly ? 'HH:mm' : 'YYYY-MM-DDTHH:mm';

  const effectiveTimeZone =
    inputTimeZone === 'utc'
      ? 'UTC'
      : inputTimeZone === 'local'
        ? _outputUTC
          ? timeZone
          : undefined
        : timeZone || inputTimeZone;

  if (inputValue === '') {
    return '';
  }

  if (!inputValue) {
    return undefined;
  }

  if (format) {
    // When the input is in UTC, parse as UTC; otherwise parse as local (timezone conversion happens
    // below via `.tz()` or `.utc()`)
    const parse = getParser(inputTimeZone === 'utc');
    let parsed = parse(inputValue, inputFormat);

    if (!parsed.isValid()) {
      parsed = parse(inputValue);
    }

    // Return empty string for invalid dates to avoid storing 'Invalid Date'
    if (!parsed.isValid()) {
      return '';
    }

    // Apply IANA timezone context first, then optionally convert to UTC
    if (effectiveTimeZone) {
      parsed = parsed.tz(effectiveTimeZone, true);
    }

    if (_outputUTC && inputTimeZone !== 'utc') {
      parsed = parsed.utc();
    }

    return parsed.format(format);
  }

  if (dateOnly) {
    return inputValue;
  }

  const hasSeconds = /:\d{2}$/.test(inputValue);
  // Append seconds (and milliseconds) for data format & framework compatibility
  const timeSuffix = currentValue ? `:00${currentValue.endsWith('.000') ? '.000' : ''}` : ':00';

  if (timeOnly) {
    return hasSeconds ? inputValue : `${inputValue}${timeSuffix}`;
  }

  if (inputTimeZone === 'utc') {
    // Input is already in UTC; store with `Z` suffix (no conversion needed)
    return dayjs.utc(inputValue).format();
  }

  if (_outputUTC) {
    // Convert the local/custom-timezone input to UTC for storage.
    const dt = timeZone ? dayjs.tz(inputValue, timeZone) : dayjs(inputValue);

    return dt.utc().format();
  }

  if (timeZone && inputTimeZone !== 'local') {
    // Preserve the configured custom timezone offset when output_utc is false.
    return dayjs.tz(inputValue, timeZone).format('YYYY-MM-DDTHH:mm:ssZ');
  }

  return hasSeconds ? inputValue : `${inputValue}${timeSuffix}`;
};

/**
 * Get the input value given the current value.
 * @param {object} args Arguments.
 * @param {string | undefined} args.currentValue Value in the entry draft datastore.
 * @param {DateTimeField} args.fieldConfig Field configuration.
 * @param {string} [args.timeZone] IANA timezone name.
 * @returns {string | undefined} New value.
 */
export const getInputValue = ({ currentValue, fieldConfig, timeZone }) => {
  const { dateOnly, timeOnly, inputTimeZone, format, outputUTC } = parseDateTimeConfig(fieldConfig);
  const displayTimeZone = getTimeZoneForStoredValue(currentValue, fieldConfig) ?? timeZone;

  // If the default value is an empty string, the input will be blank by default
  if (!currentValue) {
    return '';
  }

  // If the current value is the standard format, return it as is
  const value = dateOnly
    ? currentValue.match(DATE_ONLY_MATCH_REGEX)?.groups?.date
    : timeOnly
      ? // Match both `YYYY-MM-DDTHH:mm(:ss)` and `HH:mm(:ss)` formats
        currentValue.match(TIME_SUFFIX_MATCH_REGEX)?.groups?.time
      : undefined;

  if (value) {
    return value;
  }

  // `currentValue` is always truthy here (the empty-string guard above returned early). When a
  // custom timezone is active with a format and `output_utc` is `false`, `getDate()` would parse
  // the stored value as browser-local time (wrong epoch when local ≠ input timezone). Interpret it
  // as being in the selected timezone using `.tz(tz, true)` instead. Note: the `output_utc: true`
  // case is handled correctly by `getDate()` via `parseAsUTC`.
  let dateForParts;

  if (displayTimeZone && format && !outputUTC) {
    try {
      const parsed = dayjs(currentValue, format).tz(displayTimeZone, true);

      // `.tz()` returns invalid (without throwing) in rare edge cases; fall through to `??=` below
      dateForParts = parsed.isValid() ? parsed.toDate() : undefined;
    } catch {
      // `.tz()` can throw a RangeError for invalid dates in some dayjs versions
    }

    dateForParts ??= getDate(currentValue, fieldConfig);
  } else {
    dateForParts = getDate(currentValue, fieldConfig);
  }

  // If `getDate` returned `undefined` (parsing failed), return empty string
  if (!dateForParts) {
    return '';
  }

  return formatDateTimeValue({
    date: dateForParts,
    timeZone: displayTimeZone,
    inputTimeZone,
    dateOnly,
    timeOnly,
  });
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
  const { format, dateOnly, timeOnly, utc, singleCustomTimeZone } =
    parseDateTimeConfig(fieldConfig);

  const displayTimeZone = utc ? 'UTC' : singleCustomTimeZone;

  if (typeof currentValue !== 'string' || !currentValue.trim()) {
    return '';
  }

  if (format) {
    const parsed = parseWithFormatFallback({ value: currentValue, format, parseAsUTC: utc });

    if (parsed.isValid()) {
      return parsed.format(format);
    }

    // eslint-disable-next-line no-console
    console.error('Invalid Date', currentValue);

    return '';
  }

  const date = getDate(currentValue, fieldConfig);
  const canonicalLocale = getCanonicalLocale(locale);

  if (!isValidDate(date)) {
    return '';
  }

  if (timeOnly) {
    return date.toLocaleTimeString(canonicalLocale, {
      ...TIME_FORMAT_OPTIONS,
      timeZone: displayTimeZone,
    });
  }

  if (dateOnly) {
    return date.toLocaleDateString(canonicalLocale, {
      ...DATE_FORMAT_OPTIONS,
      timeZone:
        displayTimeZone ||
        (utc || DATE_REGEX.test(currentValue) || TIME_SUFFIX_REGEX.test(currentValue)
          ? 'UTC'
          : undefined),
    });
  }

  return date.toLocaleString(canonicalLocale, {
    ...DATE_FORMAT_OPTIONS,
    ...TIME_FORMAT_OPTIONS,
    timeZone: displayTimeZone,
    timeZoneName: undefined,
  });
};
