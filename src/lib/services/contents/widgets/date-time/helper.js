import { getDateTimeParts } from '@sveltia/utils/datetime';
import moment from 'moment';
import { getCanonicalLocale } from '$lib/services/contents/i18n';
import {
  DATE_FORMAT_OPTIONS,
  DATE_REGEX,
  TIME_FORMAT_OPTIONS,
  TIME_SUFFIX_REGEX,
} from '$lib/services/utils/date';

/**
 * @import { DateTimeFieldNormalizedProps, InternalLocaleCode } from '$lib/types/private';
 * @import { DateTimeField, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Parse the DateTime field configuration and return as normalized format.
 * @param {DateTimeField} fieldConfig Field config.
 * @returns {DateTimeFieldNormalizedProps} Normalized properties.
 */
export const parseDateTimeConfig = (fieldConfig) => {
  const {
    format,
    date_format: dateFormat = undefined,
    time_format: timeFormat = undefined,
    picker_utc: utc = false,
  } = fieldConfig;

  const dateFormatStr = typeof dateFormat === 'string' ? dateFormat : '';
  const timeFormatStr = typeof timeFormat === 'string' ? timeFormat : '';

  return {
    format: format || [dateFormatStr, timeFormatStr].join(' ').trim() || undefined,
    dateOnly: timeFormat === false,
    timeOnly: dateFormat === false,
    utc,
  };
};

/**
 * Get a `Date` object given the current value.
 * @param {string | undefined} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {Date | undefined} Date.
 */
export const getDate = (currentValue, fieldConfig) => {
  const { format, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

  if (!currentValue) {
    return undefined;
  }

  try {
    if (format) {
      return (utc ? moment.utc : moment)(currentValue, format).toDate();
    }

    if (timeOnly) {
      // Use the current date
      return new Date(`${new Date().toJSON().split('T')[0]}T${currentValue}`);
    }

    return new Date(currentValue);
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return undefined;
  }
};

/**
 * Get the current date/time.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {string} Current date/time in the ISO 8601 format.
 */
export const getCurrentDateTime = (fieldConfig) => {
  const { dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

  const { year, month, day, hour, minute } = getDateTimeParts({
    timeZone: utc ? 'UTC' : undefined,
  });

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}`;

  if (dateOnly) {
    return dateStr;
  }

  if (timeOnly) {
    return timeStr;
  }

  if (utc) {
    return `${dateStr}T${timeStr}:00.000Z`;
  }

  return `${dateStr}T${timeStr}`;
};

/**
 * Get the current value given the input value.
 * @param {string | undefined} inputValue Value on the date/time input widget.
 * @param {string | undefined} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {string | undefined} New value.
 */
export const getCurrentValue = (inputValue, currentValue, fieldConfig) => {
  const { format, dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);
  const inputFormat = dateOnly ? 'YYYY-MM-DD' : timeOnly ? 'HH:mm' : 'YYYY-MM-DDTHH:mm';
  // Append seconds (and milliseconds) for data format & framework compatibility
  const timeSuffix = `:00${currentValue?.endsWith('.000') ? '.000' : ''}`;

  if (inputValue === '') {
    return '';
  }

  if (!inputValue) {
    return undefined;
  }

  try {
    if (format) {
      const result = (utc ? moment.utc : moment)(inputValue, inputFormat).format(format);

      // Handle `moment.js` inconsistency where `Z` token might output `+00:00` instead of `Z`
      if (format.includes('Z') && result.endsWith('+00:00')) {
        return result.replace('+00:00', 'Z');
      }

      return result;
    }

    if (dateOnly) {
      return inputValue;
    }

    if (utc) {
      return `${inputValue}:00.000Z`;
    }

    return `${inputValue}${timeSuffix}`;
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return undefined;
  }
};

/**
 * Get the default value for a DateTime field.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {string} Default value.
 */
const getDefaultValue = (fieldConfig) => {
  const { default: defaultValue } = fieldConfig;

  if (typeof defaultValue !== 'string') {
    return '';
  }

  // Decap CMS 3.3.0 changed the default value from the current date/time to blank, requiring
  // `{{now}}` to use the current date/time.
  // @see https://github.com/decaporg/decap-cms/releases/tag/decap-cms%403.3.0
  // @see https://github.com/decaporg/decap-website/commit/01e54d8392e368e5d7b9fec307f50af584b12c91
  if (defaultValue === '{{now}}') {
    return /** @type {string} */ (
      getCurrentValue(getCurrentDateTime(fieldConfig), '', fieldConfig)
    );
  }

  return defaultValue;
};

/**
 * Get the default value map for a DateTime field.
 * @param {object} args Arguments.
 * @param {DateTimeField} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @returns {Record<string, string>} Default value map.
 */
export const getDateTimeFieldDefaultValueMap = ({ fieldConfig, keyPath }) => ({
  [keyPath]: getDefaultValue(fieldConfig),
});

/**
 * Get the input value given the current value.
 * @param {string | undefined} currentValue Value in the entry draft datastore.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {string | undefined} New value.
 */
export const getInputValue = (currentValue, fieldConfig) => {
  const { dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

  // If the default value is an empty string, the input will be blank by default
  if (!currentValue) {
    return '';
  }

  // If the current value is the standard format, return it as is
  const value = dateOnly
    ? currentValue?.match(/^(?<date>\d{4}-[01]\d-[0-3]\d)\b/)?.groups?.date
    : timeOnly
      ? // Match both `YYYY-MM-DDTHH:mm(:ss)` and `HH:mm(:ss)` formats
        currentValue?.match(/(?:^|T)(?<time>[0-2]\d:[0-5]\d)\b/)?.groups?.time
      : undefined;

  if (value) {
    return value;
  }

  try {
    const dateForParts = currentValue ? getDate(currentValue, fieldConfig) : new Date();

    // If `getDate` returned `undefined` (parsing failed), return empty string
    if (currentValue && !dateForParts) {
      return '';
    }

    // If `getDate` returned an invalid `Date` object, return empty string
    if (currentValue && dateForParts && Number.isNaN(dateForParts.getTime())) {
      return '';
    }

    const { year, month, day, hour, minute } = getDateTimeParts({
      date: dateForParts,
      timeZone: utc ? 'UTC' : undefined,
    });

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${minute}`;

    if (dateOnly) {
      return dateStr;
    }

    if (timeOnly) {
      return timeStr;
    }

    return `${dateStr}T${timeStr}`;
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return '';
  }
};

/**
 * Get the display value of a DateTime field.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {DateTimeField} args.fieldConfig Field configuration.
 * @param {string | undefined} args.currentValue Stored value.
 * @returns {string} Display value.
 */
export const getDateTimeFieldDisplayValue = ({ locale, fieldConfig, currentValue }) => {
  const { format, dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig);

  if (typeof currentValue !== 'string' || !currentValue.trim()) {
    return '';
  }

  if (format) {
    try {
      // Parse and reformat the value because it could be saved in a wrong format
      return (utc ? moment.utc : moment)(currentValue, format).format(format);
    } catch {
      //
    }
  }

  const date = getDate(currentValue, fieldConfig);
  const canonicalLocale = getCanonicalLocale(locale);

  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  if (timeOnly) {
    return date.toLocaleTimeString(canonicalLocale, TIME_FORMAT_OPTIONS);
  }

  if (dateOnly) {
    return date.toLocaleDateString(canonicalLocale, {
      ...DATE_FORMAT_OPTIONS,
      timeZone:
        utc || DATE_REGEX.test(currentValue) || TIME_SUFFIX_REGEX.test(currentValue)
          ? 'UTC'
          : undefined,
    });
  }

  return date.toLocaleString(canonicalLocale, {
    ...DATE_FORMAT_OPTIONS,
    ...TIME_FORMAT_OPTIONS,
    timeZone: utc ? 'UTC' : undefined,
    timeZoneName: utc ? undefined : 'short',
  });
};
