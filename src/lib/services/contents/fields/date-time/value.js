import { getDateTimeParts } from '@sveltia/utils/datetime';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsLocalizedFormat from 'dayjs/plugin/localizedFormat';
import dayjsTimeZone from 'dayjs/plugin/timezone';
import dayjsUTC from 'dayjs/plugin/utc';

import { parseDateTimeConfig } from './config.js';
import { getDate, getParser, parseWithFormatFallback } from './parse.js';
import { getTimeZoneForStoredValue } from './timezone.js';

/**
 * @import { DateTimeFieldNormalizedProps } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsLocalizedFormat);
dayjs.extend(dayjsUTC);
dayjs.extend(dayjsTimeZone);

const DATE_ONLY_MATCH_REGEX = /^(?<date>\d{4}-[01]\d-[0-3]\d)\b/;
const TIME_SUFFIX_MATCH_REGEX = /(?:^|T)(?<time>[0-2]\d:[0-5]\d)\b/;
const TIME_WITH_SECONDS_REGEX = /(?:^|T)[0-2]\d:[0-5]\d:[0-5]\d/;

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
 * @param {boolean} [args.includeSeconds] Whether to include the actual seconds rather than
 * truncating the time to the minute, as the input does with its default `step`.
 * @returns {string} Formatted display string.
 */
const formatDateTimeValue = ({
  date,
  timeZone,
  inputTimeZone,
  dateOnly,
  timeOnly,
  includeUTCSeconds = false,
  includeSeconds = false,
}) => {
  const tz = timeZone || (inputTimeZone === 'utc' ? 'UTC' : undefined);
  const { year, month, day, hour, minute, second } = getDateTimeParts({ date, timeZone: tz });
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}${includeSeconds ? `:${second}` : ''}`;

  if (dateOnly) {
    return dateStr;
  }

  if (timeOnly) {
    return timeStr;
  }

  if (includeUTCSeconds && tz === 'UTC') {
    return `${dateStr}T${timeStr}${includeSeconds ? '' : ':00'}.000Z`;
  }

  return `${dateStr}T${timeStr}`;
};

/**
 * Whether the value the editor derived from its input should replace the stored value. It shouldn’t
 * when both resolve to the same instant: a user editing an existing entry in a different location
 * than where it was originally written gets an input value shifted to their own time zone, but the
 * epoch doesn’t change. The dates are compared rather than the epochs, because {@link getDate}
 * returns `undefined` for a value it can’t parse, and `NaN !== NaN` would report every such value
 * as a change.
 * @param {object} args Arguments.
 * @param {string | undefined} args.newValue Value derived from the input.
 * @param {string | undefined} args.currentValue Value in the entry draft datastore.
 * @param {DateTimeField} args.fieldConfig Field configuration.
 * @returns {boolean} `true` if the stored value should be replaced.
 */
export const shouldUpdateValue = ({ newValue, currentValue, fieldConfig }) => {
  if (newValue === undefined || newValue === currentValue) {
    return false;
  }

  const newDate = getDate(newValue, fieldConfig);
  const oldDate = getDate(currentValue, fieldConfig);

  if (newDate !== undefined && oldDate !== undefined) {
    return newDate.getTime() !== oldDate.getTime();
  }

  // Neither value resolves to a date, so there’s no epoch to compare and nothing to tell the two
  // apart. Writing one unusable string over another would let the editor’s effects syncing the
  // input and the stored value keep waking each other. Clearing the field is the exception: an
  // empty value settles on the next run
  if (newDate === undefined && oldDate === undefined && newValue !== '') {
    return false;
  }

  return true;
};

/**
 * Get the current date/time.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @param {string} [timeZone] IANA timezone name.
 * @param {object} [options] Options.
 * @param {Date} [options.date] Date to use instead of the current date/time.
 * @param {boolean} [options.includeSeconds] Whether to include the seconds.
 * @returns {string} Current date/time in the ISO 8601 format.
 */
export const getCurrentDateTime = (
  fieldConfig,
  timeZone,
  { date = undefined, includeSeconds = false } = {},
) => {
  const { dateOnly, timeOnly, inputTimeZone } = parseDateTimeConfig(fieldConfig);

  return formatDateTimeValue({
    date,
    timeZone,
    inputTimeZone,
    dateOnly,
    timeOnly,
    includeUTCSeconds: true,
    includeSeconds,
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
  // Check for a seconds component. The input element omits it with the default `step` of 60,
  // yielding `HH:mm` or `YYYY-MM-DDTHH:mm`
  const hasSeconds = !!inputValue && TIME_WITH_SECONDS_REGEX.test(inputValue);
  const timeFormat = hasSeconds ? 'HH:mm:ss' : 'HH:mm';
  const inputFormat = dateOnly ? 'YYYY-MM-DD' : timeOnly ? timeFormat : `YYYY-MM-DDT${timeFormat}`;

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

    // A date has no time zone, so store it as is: converting the midnight it was parsed as would
    // shift it to the previous day east of UTC
    if (dateOnly) {
      return parsed.format(format);
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

  // Append seconds (and milliseconds) for data format & framework compatibility
  const timeSuffix = currentValue ? `:00${currentValue.endsWith('.000') ? '.000' : ''}` : ':00';

  if (timeOnly) {
    const timeValue = hasSeconds ? inputValue : `${inputValue}${timeSuffix}`;

    // Input is already in UTC; store with a `Z` suffix (no conversion needed)
    return inputTimeZone === 'utc' ? `${timeValue}Z` : timeValue;
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
 * Get the current date/time as a value to be stored in the given field, formatted the same way as
 * the field’s input would store it. Used for the `{{now}}` default value and the `auto_now` option.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @param {object} [options] Options.
 * @param {Date} [options.date] Date to use instead of the current date/time.
 * @param {boolean} [options.includeSeconds] Whether to keep the seconds, which the input drops
 * with its default `step`. The `{{now}}` default value is filled in the input, so it doesn’t, while
 * a timestamp set on save does.
 * @returns {string} Current date/time.
 */
export const getCurrentStorableValue = (
  fieldConfig,
  { date = undefined, includeSeconds = false } = {},
) => {
  const { singleCustomTimeZone: timeZone, outputUTC } = parseDateTimeConfig(fieldConfig);

  return /** @type {string} */ (
    getCurrentValue({
      inputValue: getCurrentDateTime(fieldConfig, timeZone, { date, includeSeconds }),
      currentValue: '',
      fieldConfig,
      timeZone,
      outputUTC,
    })
  );
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

  // If the current value is the standard format, return it as is. A value in the custom format has
  // to be parsed with it instead: a 12-hour time like `02:30 PM` starts with the same digits as
  // `02:30` but means `14:30`
  const value =
    format && dayjs(currentValue, format, true).isValid()
      ? undefined
      : dateOnly
        ? currentValue.match(DATE_ONLY_MATCH_REGEX)?.groups?.date
        : timeOnly
          ? // Match both `YYYY-MM-DDTHH:mm(:ss)` and `HH:mm(:ss)` formats
            currentValue.match(TIME_SUFFIX_MATCH_REGEX)?.groups?.time
          : undefined;

  if (value) {
    return value;
  }

  // A date stored in the custom format has no time zone either, so read it as is. Parsing it as UTC
  // midnight with `output_utc` and showing it in a time zone west of UTC would shift it to the
  // previous day
  if (dateOnly && format) {
    const parsed = parseWithFormatFallback({ value: currentValue, format, parseAsUTC: false });

    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
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
