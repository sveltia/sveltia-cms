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
 * Formatters by options object, then by locale. Creating a formatter is an order of magnitude
 * slower than using one, which `Date.prototype.toLocaleString()` and the like do on every call, and
 * a list of dates, such as the commit history, formats many with the same few. The options are
 * looked up by identity, which is far cheaper than serializing them on every call.
 * @type {WeakMap<Intl.DateTimeFormatOptions, Map<string, Intl.DateTimeFormat>>}
 */
const formatterCache = new WeakMap();

/**
 * Get a cached formatter for the given locale and options.
 * @param {string | null | undefined} locale Locale. Default: the user’s.
 * @param {Intl.DateTimeFormatOptions} options Options. Pass the same object for the same options,
 * e.g. a constant, as they’re cached by identity.
 * @returns {Intl.DateTimeFormat} Formatter.
 */
export const getDateTimeFormatter = (locale, options) =>
  getOrCreate(
    getOrCreate(formatterCache, options, () => new Map()),
    locale ?? '',
    () => new Intl.DateTimeFormat(locale ?? undefined, options),
  );

/**
 * Format the date with a cached formatter. An invalid date gives what `toLocaleString()` gives,
 * where `format()` would throw.
 * @param {Date} date Date.
 * @param {string | null | undefined} locale Locale. Default: the user’s.
 * @param {Intl.DateTimeFormatOptions} options Options.
 * @returns {string} Formatted date.
 */
const formatWith = (date, locale, options) =>
  Number.isNaN(date.getTime())
    ? 'Invalid Date'
    : getDateTimeFormatter(locale, options).format(date);

/**
 * Format the date to a localized string.
 * @param {Date} date Date to format.
 * @param {LocaleCode | null} [locale] Optional locale to use for formatting.
 * @returns {string} Formatted date string.
 */
export const formatDate = (date, locale) => formatWith(date, locale, DATE_TIME_FORMAT_OPTIONS);

/**
 * Options for {@link formatRecentDateTime}: the time alone for today.
 * @type {Intl.DateTimeFormatOptions}
 */
const RECENT_TIME_OPTIONS = { hour: 'numeric', minute: 'numeric' };
/**
 * Options for {@link formatRecentDateTime}: the date without the year for another day this year.
 * @type {Intl.DateTimeFormatOptions}
 */
const RECENT_DATE_OPTIONS = { month: 'short', day: 'numeric', ...RECENT_TIME_OPTIONS };
/**
 * Options for {@link formatRecentDateTime}: the full date for another year.
 * @type {Intl.DateTimeFormatOptions}
 */
const RECENT_YEAR_OPTIONS = { year: 'numeric', ...RECENT_DATE_OPTIONS };
/**
 * Options for {@link formatMonthDay}.
 * @type {Intl.DateTimeFormatOptions}
 */
const MONTH_DAY_OPTIONS = { month: 'short', day: 'numeric' };

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

  return formatWith(
    timestamp,
    locale,
    sameDay ? RECENT_TIME_OPTIONS : sameYear ? RECENT_DATE_OPTIONS : RECENT_YEAR_OPTIONS,
  );
};

/**
 * Format the month and day of the given date briefly, e.g. `Nov 25`.
 * @param {Date} date Date.
 * @param {LocaleCode} [locale] Locale.
 * @returns {string} Formatted date.
 */
export const formatMonthDay = (date, locale) => formatWith(date, locale, MONTH_DAY_OPTIONS);
