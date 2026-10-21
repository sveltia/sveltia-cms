import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsLocalizedFormat from 'dayjs/plugin/localizedFormat';
import dayjsTimeZone from 'dayjs/plugin/timezone';
import dayjsUTC from 'dayjs/plugin/utc';

import { parseDateTimeConfig } from './config.js';
import { getFormatLocale } from './locales.js';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
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
 * Match a time token in a Day.js format, including a localized format with a time and a Unix
 * timestamp, once the escaped text in square brackets has been removed.
 */
// cspell:disable-next-line
const FORMAT_TIME_TOKEN_REGEX = /[AaHhkmSsXx]|LT|LLL|lll/;
/**
 * Remove the escaped text in square brackets from a Day.js format, leaving its tokens.
 * @param {string} format Format string.
 * @returns {string} Tokens.
 */
const getFormatTokens = (format) => format.replaceAll(/\[.*?]/g, '');
/**
 * Check if the given Day.js format has a UTC offset token.
 * @param {string} format Format string.
 * @returns {boolean} Result.
 */
const hasOffsetToken = (format) => FORMAT_OFFSET_TOKEN_REGEX.test(getFormatTokens(format));

/**
 * Check if a value has a UTC offset that the given Day.js format, which has a time, can’t hold,
 * like an ISO 8601 value written before the format was set. Such a value is only parsed with the
 * format if it’s written in it exactly, e.g. with an escaped `[Z]`: the parser would otherwise read
 * the time and drop the offset, shifting the instant by it. A date in a format without a time is
 * read as written.
 * @param {string} value Value to parse.
 * @param {string} format Format string.
 * @returns {boolean} Result.
 */
export const hasOffsetOutsideFormat = (value, format) =>
  OFFSET_SUFFIX_REGEX.test(value) &&
  FORMAT_TIME_TOKEN_REGEX.test(getFormatTokens(format)) &&
  !hasOffsetToken(format);

/**
 * Parse a value in the given format with a Day.js parser. A value with a UTC offset is parsed
 * strictly in a format with a time but no offset, see {@link hasOffsetOutsideFormat}.
 * @param {dayjs.utc | dayjs} parse Day.js parser, as returned by {@link getParser}.
 * @param {string} value Value to parse.
 * @param {string} format Format string.
 * @param {string} [localeKey] Day.js locale the value is written in.
 * @returns {dayjs.Dayjs} Parsed dayjs instance.
 */
const parseWithFormat = (parse, value, format, localeKey) =>
  // The UTC parser takes a locale like `dayjs()` does, though its type doesn’t say so
  /** @type {typeof dayjs} */ (parse)(
    value,
    format,
    localeKey,
    hasOffsetOutsideFormat(value, format),
  );

/**
 * Parse a value with Day.js, falling back to the default parser when the supplied format fails.
 * @param {object} args Arguments.
 * @param {string} args.value Value to parse.
 * @param {string} args.format Format string.
 * @param {boolean} args.parseAsUTC Whether to parse as UTC.
 * @param {string} [args.localeKey] Day.js locale the value is written in, as returned by
 * `getFormatLocale()`. English if omitted. The parsed instance formats in the same locale.
 * @returns {dayjs.Dayjs} Parsed dayjs instance.
 */
export const parseWithFormatFallback = ({ value, format, parseAsUTC, localeKey }) => {
  const parse = getParser(parseAsUTC);
  const parsed = parseWithFormat(parse, value, format, localeKey);

  return parsed.isValid() ? parsed : parse(value);
};

/**
 * Format a Day.js instance in the given locale.
 * @param {dayjs.Dayjs} instance Day.js instance.
 * @param {string} format Format string.
 * @param {string} [localeKey] Day.js locale, as returned by `getFormatLocale()`. If omitted, the
 * instance’s own locale is used, which is English unless it was parsed in another.
 * @returns {string} Formatted value.
 */
export const formatInLocale = (instance, format, localeKey) =>
  (localeKey ? instance.locale(localeKey) : instance).format(format);

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
 * Get the time zone a stored value without a UTC offset is read in. See {@link getDate}.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {string | undefined} `UTC`, an IANA time zone name, or `undefined` for the browser’s.
 */
export const getStoredValueTimeZone = (fieldConfig) => {
  const { format, dateOnly, utc, outputUTC, singleCustomTimeZone } =
    parseDateTimeConfig(fieldConfig);

  return utc || (format && outputUTC) ? 'UTC' : dateOnly ? undefined : singleCustomTimeZone;
};

/**
 * Get a `Date` object given the current value. A stored value without a UTC offset is read in the
 * time zone of the field: UTC with `input_timezone: utc`, the deprecated `picker_utc` or, in a
 * custom format, `output_utc`, which stores the value in UTC; an IANA time zone with
 * `input_timezone` set to one; and the browser’s otherwise. A date without a time is read as is.
 * @param {string | undefined} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @param {InternalLocaleCode} [locale] Locale of the content the value belongs to, which a value in
 * a custom format is written in with `localize_format: true`.
 * @returns {Date | undefined} Date or `undefined` if invalid.
 */
export const getDate = (currentValue, fieldConfig, locale) => {
  const { format, timeOnly } = parseDateTimeConfig(fieldConfig);

  if (!currentValue) {
    return undefined;
  }

  const timeZone = getStoredValueTimeZone(fieldConfig);
  /** @type {Date | undefined} */
  let date;

  if (format) {
    const localeKey = getFormatLocale(fieldConfig, locale);

    if (timeZone === 'UTC' || !timeZone) {
      // A value stored in the custom format carries no time zone, so it has to be parsed in the
      // field’s explicitly — otherwise the browser’s local offset is applied and the epoch is wrong
      const parsed = parseWithFormatFallback({
        value: currentValue,
        format,
        parseAsUTC: timeZone === 'UTC',
        localeKey,
      });

      date = parsed.isValid() ? parsed.toDate() : undefined;
    } else {
      const wallTime = parseWithFormat(getParser(true), currentValue, format, localeKey);

      date = !wallTime.isValid()
        ? // The value isn’t in the custom format, e.g. an ISO 8601 value written before the format
          // was set
          parseISODate(currentValue, timeZone)
        : hasOffsetToken(format)
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
