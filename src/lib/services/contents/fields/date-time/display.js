import dayjs from 'dayjs';
import dayjsAdvancedFormat from 'dayjs/plugin/advancedFormat';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsLocalizedFormat from 'dayjs/plugin/localizedFormat';
import dayjsTimeZone from 'dayjs/plugin/timezone';
import dayjsUTC from 'dayjs/plugin/utc';

import { getCanonicalLocale } from '$lib/services/contents/i18n';
import { getOrCreate } from '$lib/services/utils/cache';
import {
  DATE_FORMAT_OPTIONS,
  DATE_REGEX,
  TIME_FORMAT_OPTIONS,
  TIME_SUFFIX_REGEX,
} from '$lib/services/utils/date';

import { parseDateTimeConfig } from './config.js';
import { getFormatLocale } from './locales.js';
import {
  getDate,
  hasOffsetOutsideFormat,
  hasOffsetToken,
  isValidDate,
  parseWithFormatFallback,
} from './parse.js';
import { formatInFieldTimeZone, formatInTimeZone } from './value.js';

/**
 * @import { Dayjs } from 'dayjs';
 * @import { InternalLocaleCode } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

dayjs.extend(dayjsAdvancedFormat);
dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsLocalizedFormat);
dayjs.extend(dayjsUTC);
dayjs.extend(dayjsTimeZone);

/**
 * Cache of the formatters used by {@link getDateTimeFieldDisplayValue}, keyed by locale, the parts
 * shown and time zone. `Date.prototype.toLocaleString()` and the like create a new formatter on
 * each call when options are given, which is an order of magnitude slower than reusing one, and a
 * display value is resolved for every referenced entry when the options of a Relation field are
 * built. The keys come from the site configuration, so the cache stays small.
 * @type {Map<string, Intl.DateTimeFormat>}
 */
const displayFormatterCache = new Map();

/**
 * Get a cached formatter for {@link getDateTimeFieldDisplayValue}. The options are the same as the
 * ones the `Date` locale methods would be given, so the output is identical.
 * @param {object} args Arguments.
 * @param {string | undefined} args.locale Canonical locale.
 * @param {'date' | 'time' | 'datetime'} args.parts Parts to be shown.
 * @param {string | undefined} args.timeZone Time zone.
 * @returns {Intl.DateTimeFormat} Formatter.
 */
const getDisplayFormatter = ({ locale, parts, timeZone }) =>
  getOrCreate(displayFormatterCache, [locale, parts, timeZone].join('|'), () => {
    if (parts === 'time') {
      return new Intl.DateTimeFormat(locale, { ...TIME_FORMAT_OPTIONS, timeZone });
    }

    if (parts === 'date') {
      return new Intl.DateTimeFormat(locale, { ...DATE_FORMAT_OPTIONS, timeZone });
    }

    return new Intl.DateTimeFormat(locale, {
      ...DATE_FORMAT_OPTIONS,
      ...TIME_FORMAT_OPTIONS,
      timeZone,
      timeZoneName: undefined,
    });
  });

/**
 * Match a UTC offset written in a value, like `+09:00` or `-0800`.
 */
const OFFSET_TEXT_REGEX = /[+-]\d{2}:?\d{2}/g;

/**
 * Check if a value in a format with a UTC offset token is written in the format exactly, with one
 * of the offsets it contains. Day.js reads such a value as an instant in the browser’s time zone,
 * so its strict mode would only accept a value written with the browser’s offset.
 * @param {string} value Stored value.
 * @param {Dayjs} instant Instant the value was parsed as.
 * @param {string} format Format string.
 * @param {string} [localeKey] Day.js locale, as returned by `getFormatLocale()`.
 * @returns {boolean} Result.
 */
const isWrittenWithOffset = (value, instant, format, localeKey) =>
  [...new Set(value.match(OFFSET_TEXT_REGEX))].some(
    (offset) => formatInTimeZone(instant.utcOffset(offset), format, localeKey) === value,
  );

/**
 * Get the display value of a DateTime field.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {DateTimeField} args.fieldConfig Field configuration.
 * @param {string | undefined} args.currentValue Stored value.
 * @returns {string} Display value.
 */
export const getDateTimeFieldDisplayValue = ({ locale, fieldConfig, currentValue }) => {
  const { format, dateOnly, timeOnly, utc, singleCustomTimeZone } =
    parseDateTimeConfig(fieldConfig);

  const displayTimeZone = utc ? 'UTC' : singleCustomTimeZone;

  if (typeof currentValue !== 'string' || !currentValue.trim()) {
    return '';
  }

  if (format) {
    const localeKey = getFormatLocale(fieldConfig, locale);

    // A value with an offset the format can’t hold, like an ISO 8601 value written before the
    // format was set, is an instant shown in the field’s time zone. Any other value is shown as
    // written, which is also much faster than converting it to a time zone
    if (hasOffsetOutsideFormat(currentValue, format)) {
      const date = getDate(currentValue, fieldConfig, locale);

      return date ? formatInFieldTimeZone(dayjs(date), format, fieldConfig, localeKey) : '';
    }

    const parsed = parseWithFormatFallback({
      value: currentValue,
      format,
      parseAsUTC: utc,
      localeKey,
    });

    if (parsed.isValid()) {
      if (!hasOffsetToken(format)) {
        return parsed.format(format);
      }

      // Day.js reads a value with an offset, or a Unix timestamp, as an instant in the browser’s
      // time zone. One written in the format is shown as written; any other, like an ISO 8601 value
      // written before the format was set, is shown in the field’s time zone, like the input does
      return isWrittenWithOffset(currentValue, parsed, format, localeKey)
        ? currentValue
        : formatInFieldTimeZone(parsed, format, fieldConfig, localeKey);
    }

    // eslint-disable-next-line no-console
    console.error('Invalid Date', currentValue);

    return '';
  }

  const date = getDate(currentValue, fieldConfig, locale);
  const canonicalLocale = getCanonicalLocale(locale);

  if (!isValidDate(date)) {
    return '';
  }

  if (timeOnly) {
    return getDisplayFormatter({
      locale: canonicalLocale,
      parts: 'time',
      timeZone: displayTimeZone,
    }).format(date);
  }

  if (dateOnly) {
    // `getDate()` reads a date as UTC midnight, which the custom time zone would show as the
    // previous day west of UTC, so only a value with a time is shown in that zone
    return getDisplayFormatter({
      locale: canonicalLocale,
      parts: 'date',
      timeZone:
        utc || DATE_REGEX.test(currentValue) || TIME_SUFFIX_REGEX.test(currentValue)
          ? 'UTC'
          : displayTimeZone,
    }).format(date);
  }

  return getDisplayFormatter({
    locale: canonicalLocale,
    parts: 'datetime',
    timeZone: displayTimeZone,
  }).format(date);
};
