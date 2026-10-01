import dayjs from 'dayjs';
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
import { getDate, isValidDate, parseWithFormatFallback } from './parse.js';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

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
    const parsed = parseWithFormatFallback({ value: currentValue, format, parseAsUTC: utc });

    if (parsed.isValid()) {
      return parsed.format(format);
    }

    // eslint-disable-next-line no-console
    console.error('Invalid Date', currentValue);

    return '';
  }

  const date = getDate(currentValue, fieldConfig);
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
    return getDisplayFormatter({
      locale: canonicalLocale,
      parts: 'date',
      timeZone:
        displayTimeZone ||
        (utc || DATE_REGEX.test(currentValue) || TIME_SUFFIX_REGEX.test(currentValue)
          ? 'UTC'
          : undefined),
    }).format(date);
  }

  return getDisplayFormatter({
    locale: canonicalLocale,
    parts: 'datetime',
    timeZone: displayTimeZone,
  }).format(date);
};
