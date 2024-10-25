/**
 * Regular expression to match partial or complete ISO 8601 date format.
 * @see https://stackoverflow.com/q/3143070
 */
export const fullDateTimeRegEx =
  /^(?:\d{4}-[01]\d-[0-3]\d)?(?:T?[0-2]\d:[0-5]\d)?(?::[0-5]\d)?(?:\.\d+)?(?:[+-][0-2]\d:[0-5]\d|Z)?$/;

/**
 * Standard date format options.
 * @type {Intl.DateTimeFormatOptions}
 */
export const dateFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

/**
 * Standard time format options.
 * @type {Intl.DateTimeFormatOptions}
 */
export const timeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
