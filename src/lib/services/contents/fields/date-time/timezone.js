import { parseDateTimeConfig } from './config.js';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

const TIMEZONE_OFFSET_REGEX =
  /(?<hours>[+-]\d{2})(?::?(?<minutes>\d{2}))?(?::?(?<seconds>\d{2}))?(?:\.\d+)?$|Z$/;

/**
 * Format a string representing a number with leading zeros.
 * @param {string | undefined} str String to format.
 * @returns {string} Formatted string.
 */
const formatPart = (str) => String(Math.abs(Number(str))).padStart(2, '0');

/**
 * Find the configured IANA timezone whose offset matches the stored value’s explicit offset. This
 * is used to restore the most appropriate timezone when the field allows multiple choices.
 * @param {string | undefined} currentValue Stored value.
 * @param {DateTimeField} fieldConfig Field config.
 * @returns {string | undefined} Matching timezone name, if any.
 */
export const getTimeZoneForStoredValue = (currentValue, fieldConfig) => {
  if (typeof currentValue !== 'string' || !currentValue.trim()) {
    return undefined;
  }

  const { inputTimeZone } = parseDateTimeConfig(fieldConfig);

  if (inputTimeZone === 'local' || inputTimeZone === 'utc') {
    return undefined;
  }

  const date = new Date(currentValue);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const offsetMatch = currentValue.match(TIMEZONE_OFFSET_REGEX);

  if (!offsetMatch?.groups) {
    return undefined;
  }

  const { hours, minutes = '0' } = offsetMatch.groups;

  const storedOffset =
    offsetMatch[0] === 'Z'
      ? '+00:00'
      : `${hours.startsWith('-') ? '-' : '+'}${formatPart(hours)}:${formatPart(minutes)}`;

  const offset =
    new Intl.DateTimeFormat('en-US', { timeZone: inputTimeZone, timeZoneName: 'longOffset' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? '';

  return offset.replace('GMT', '') === storedOffset ? inputTimeZone : undefined;
};

/**
 * Resolve the initial timezone for the editor.
 * @param {string | undefined} currentValue Stored value.
 * @param {DateTimeField} fieldConfig Field configuration.
 * @returns {string | undefined} Initial timezone, if any.
 */
export const getInitialTimeZone = (currentValue, fieldConfig) => {
  const storedTimeZone = getTimeZoneForStoredValue(currentValue, fieldConfig);

  if (storedTimeZone) {
    return storedTimeZone;
  }

  const { inputTimeZone, singleCustomTimeZone } = parseDateTimeConfig(fieldConfig);

  if (singleCustomTimeZone) {
    return singleCustomTimeZone;
  }

  try {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (inputTimeZone === 'local') {
      return browserTimeZone;
    }
  } catch {
    return inputTimeZone === 'local' ? '' : undefined;
  }

  return undefined;
};

/**
 * Get a formatted timezone label for display.
 * @param {string} timeZone IANA timezone identifier.
 * @param {Date} [date] Date to calculate offset from. Defaults to current date.
 * @returns {string} Formatted label like `(−05:00) New York`.
 */
export const getTimeZoneLabel = (timeZone, date = new Date()) => {
  try {
    const offset =
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')?.value ?? '';

    const cityName = timeZone.split('/').pop()?.replaceAll('_', ' ') ?? timeZone;

    return `(${offset.replace('GMT', '')}) ${cityName}`;
  } catch {
    return timeZone;
  }
};
