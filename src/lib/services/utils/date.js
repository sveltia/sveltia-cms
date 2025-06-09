/**
 * Regular expression to match partial or complete ISO 8601 date format.
 * @see https://stackoverflow.com/q/3143070
 */
export const FULL_DATE_TIME_REGEX =
  /^(?:\d{4}-[01]\d-[0-3]\d)?(?:T?[0-2]\d:[0-5]\d)?(?::[0-5]\d)?(?:\.\d+)?(?:[+-][0-2]\d:[0-5]\d|Z)?$/;

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
