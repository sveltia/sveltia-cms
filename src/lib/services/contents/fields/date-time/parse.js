import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsLocalizedFormat from 'dayjs/plugin/localizedFormat';
import dayjsTimeZone from 'dayjs/plugin/timezone';
import dayjsUTC from 'dayjs/plugin/utc';

import { parseDateTimeConfig } from './config.js';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsLocalizedFormat);
dayjs.extend(dayjsUTC);
dayjs.extend(dayjsTimeZone);

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
export const parseWithFormatFallback = ({ value, format, parseAsUTC }) => {
  const parse = getParser(parseAsUTC);
  const parsed = parse(value, format);

  return parsed.isValid() ? parsed : parse(value);
};

/**
 * Match a value ending in a time followed by a UTC offset, like `10:30:00Z` or `10:30+09:00`. A
 * date-only value like `2026-01-15` has no time before its last hyphen, so it doesn’t match.
 */
const OFFSET_SUFFIX_REGEX = /\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;
/**
 * Match an offset token (`Z` or `ZZ`) in a Day.js format, once the escaped text in square brackets
 * has been removed.
 */
const FORMAT_OFFSET_TOKEN_REGEX = /Z/;

/**
 * Get the instant of a wall-clock time in the given time zone.
 * @param {dayjs.Dayjs} wallTime Wall-clock time, parsed as UTC.
 * @param {string} timeZone `UTC` or an IANA time zone name.
 * @returns {Date} Date.
 */
const getDateInTimeZone = (wallTime, timeZone) =>
  timeZone === 'UTC'
    ? wallTime.toDate()
    : dayjs.tz(wallTime.format('YYYY-MM-DDTHH:mm:ss.SSS'), timeZone).toDate();

/**
 * Parse an ISO 8601 value. A value with a UTC offset is an instant on its own, while one without
 * an offset is read in the given time zone, or the browser’s if none is given.
 * @param {string} value Value to parse.
 * @param {string} [timeZone] `UTC` or an IANA time zone name.
 * @returns {Date | undefined} Date, which can be invalid, or `undefined` if the value can’t be
 * parsed in the time zone.
 */
const parseISODate = (value, timeZone) => {
  if (!timeZone || OFFSET_SUFFIX_REGEX.test(value)) {
    return new Date(value);
  }

  const wallTime = dayjs.utc(value);

  return wallTime.isValid() ? getDateInTimeZone(wallTime, timeZone) : undefined;
};

/**
 * Get a `Date` object given the current value. A stored value without a UTC offset is read in the
 * time zone of the field: UTC with `input_timezone: utc`, the deprecated `picker_utc` or, in a
 * custom format, `output_utc`, which stores the value in UTC; an IANA time zone with
 * `input_timezone` set to one; and the browser’s otherwise. A date without a time is read as is.
 * @param {string | undefined} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {Date | undefined} Date or `undefined` if invalid.
 */
export const getDate = (currentValue, fieldConfig) => {
  const { format, dateOnly, timeOnly, utc, outputUTC, singleCustomTimeZone } =
    parseDateTimeConfig(fieldConfig);

  if (!currentValue) {
    return undefined;
  }

  const timeZone =
    utc || (format && outputUTC) ? 'UTC' : dateOnly ? undefined : singleCustomTimeZone;

  /** @type {Date | undefined} */
  let date;

  if (format) {
    if (timeZone === 'UTC' || !timeZone) {
      // A value stored in the custom format carries no time zone, so it has to be parsed in the
      // field’s explicitly — otherwise the browser’s local offset is applied and the epoch is wrong
      const parsed = parseWithFormatFallback({
        value: currentValue,
        format,
        parseAsUTC: timeZone === 'UTC',
      });

      date = parsed.isValid() ? parsed.toDate() : undefined;
    } else {
      const wallTime = dayjs.utc(currentValue, format);

      date = !wallTime.isValid()
        ? // The value isn’t in the custom format, e.g. an ISO 8601 value written before the format
          // was set
          parseISODate(currentValue, timeZone)
        : FORMAT_OFFSET_TOKEN_REGEX.test(format.replaceAll(/\[.*?]/g, ''))
          ? wallTime.toDate()
          : getDateInTimeZone(wallTime, timeZone);
    }
  } else if (timeOnly) {
    // Use the current date
    date = parseISODate(`${new Date().toJSON().split('T')[0]}T${currentValue}`, timeZone);
  } else {
    date = parseISODate(currentValue, timeZone);
  }

  if (isValidDate(date)) {
    return date;
  }

  // eslint-disable-next-line no-console
  console.error('Invalid Date', currentValue);

  return undefined;
};
