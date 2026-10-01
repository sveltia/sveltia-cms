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
