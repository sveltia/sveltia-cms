/**
 * @import { LocaleCode } from '$lib/types/public';
 */

/**
 * Format the time a draft backup was made, for the dialog asking whether to restore it. The date
 * is omitted for a backup made today, and the year for one made this year. Both dates are compared
 * in the user’s time zone, which the time is formatted in as well.
 * @param {object} args Arguments.
 * @param {Date} args.timestamp Time of the backup.
 * @param {LocaleCode} [args.locale] Locale to format the time in, e.g. the app locale.
 * @param {Date} [args.now] Current time, which defaults to the time of the call.
 * @returns {string} Formatted date and time.
 */
export const formatBackupTime = ({ timestamp, locale, now = new Date() }) => {
  const sameYear = now.getFullYear() === timestamp.getFullYear();

  const sameDay =
    sameYear && now.getMonth() === timestamp.getMonth() && now.getDate() === timestamp.getDate();

  return timestamp.toLocaleString(locale, {
    year: sameYear ? undefined : 'numeric',
    month: sameDay ? undefined : 'short',
    day: sameDay ? undefined : 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
};
