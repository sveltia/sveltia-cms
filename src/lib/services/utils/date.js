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
