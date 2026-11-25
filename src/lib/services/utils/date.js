import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { LocaleCode } from '$lib/types/public';
 */

export const DATE_REGEX = /^\d{4}-[01]\d-[0-3]\d$/;
export const TIME_SUFFIX_REGEX = /T00:00(?::00)?(?:\.000)?Z$/;

/**
 * Standard date format options.
 * @type {Intl.DateTimeFormatOptions}
 */
export const DATE_FORMAT_OPTIONS = { year: 'numeric', month: 'short', day: 'numeric' };

/**
 * Standard time format options.
 * @type {Intl.DateTimeFormatOptions}
 */
export const TIME_FORMAT_OPTIONS = { hour: 'numeric', minute: 'numeric', hour12: true };

/**
 * Standard date/time format options.
 * @type {Intl.DateTimeFormatOptions}
 */
export const DATE_TIME_FORMAT_OPTIONS = { ...DATE_FORMAT_OPTIONS, ...TIME_FORMAT_OPTIONS };

/**
 * Formatters used by {@link formatDate}, keyed by locale. Creating a formatter is far slower than
 * using one, and a list of dates, such as the commit history, formats many with the same locale.
 * @type {Map<string, Intl.DateTimeFormat>}
 */
const dateTimeFormatterCache = new Map();
/**
 * Formatters used by {@link formatRecentDateTime}, keyed by locale and by which parts of the date
 * are shown: the time alone, the date without the year, or the full date. A history list formats
 * many timestamps with the same few formatters.
 * @type {Map<string, Intl.DateTimeFormat>}
 */
const recentDateTimeFormatterCache = new Map();
/**
 * Formatters used by {@link formatMonthDay}, keyed by locale.
 * @type {Map<string, Intl.DateTimeFormat>}
 */
const monthDayFormatterCache = new Map();

/**
 * Format the date to a localized string.
 * @param {Date} date Date to format.
 * @param {LocaleCode | null} [locale] Optional locale to use for formatting.
 * @returns {string} Formatted date string.
 */
export const formatDate = (date, locale) => {
  // Same as what `toLocaleString()` gives, where `format()` would throw
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  return getOrCreate(
    dateTimeFormatterCache,
    locale ?? '',
    () => new Intl.DateTimeFormat(locale ?? undefined, DATE_TIME_FORMAT_OPTIONS),
  ).format(date);
};

/**
 * Format a recent date and time briefly, e.g. when a draft backup was made or someone started
 * editing an entry. The date is omitted for today, and the year for this year. Both dates are
 * compared in the user’s time zone, which the time is formatted in as well.
 * @param {object} args Arguments.
 * @param {Date} args.timestamp Date and time.
 * @param {LocaleCode} [args.locale] Locale to format the time in, e.g. the app locale.
 * @param {Date} [args.now] Current time, which defaults to the time of the call.
 * @returns {string} Formatted date and time.
 */
export const formatRecentDateTime = ({ timestamp, locale, now = new Date() }) => {
  const sameYear = now.getFullYear() === timestamp.getFullYear();

  const sameDay =
    sameYear && now.getMonth() === timestamp.getMonth() && now.getDate() === timestamp.getDate();

  // Same as what `toLocaleString()` gives, where `format()` would throw
  if (Number.isNaN(timestamp.getTime())) {
    return 'Invalid Date';
  }

  const shape = sameDay ? 'time' : sameYear ? 'date' : 'year';

  return getOrCreate(
    recentDateTimeFormatterCache,
    `${locale ?? ''}|${shape}`,
    () =>
      new Intl.DateTimeFormat(locale, {
        year: shape === 'year' ? 'numeric' : undefined,
        month: shape === 'time' ? undefined : 'short',
        day: shape === 'time' ? undefined : 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }),
  ).format(timestamp);
};

/**
 * Format the month and day of the given date briefly, e.g. `Nov 25`.
 * @param {Date} date Date.
 * @param {LocaleCode} [locale] Locale.
 * @returns {string} Formatted date.
 */
export const formatMonthDay = (date, locale) =>
  Number.isNaN(date.getTime())
    ? 'Invalid Date'
    : getOrCreate(
        monthDayFormatterCache,
        locale ?? '',
        () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
      ).format(date);
