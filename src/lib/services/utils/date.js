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
 * Format the date to a localized string.
 * @param {Date} date Date to format.
 * @param {LocaleCode | null} [locale] Optional locale to use for formatting. If not provided, the
 * current locale from svelte-i18n will be used.
 * @returns {string} Formatted date string.
 */
export const formatDate = (date, locale) =>
  date.toLocaleString(locale ?? undefined, DATE_TIME_FORMAT_OPTIONS);
