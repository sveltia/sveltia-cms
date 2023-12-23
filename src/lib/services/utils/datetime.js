/**
 * Get an object containing date parts that can be used for the `YYYY-MM-DD` format, especially in
 * the local time zone.
 * @param {object} [options] - Options.
 * @param {Date} [options.date] - Date to use.
 * @param {string} [options.timeZone] - Time zone, e.g. `UTC`.
 * @returns {{ [key: string]: string }} Result like `{ year: '2023', month: '01', day: '23', ... }`.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts
 */
export const getDateTimeParts = ({ date = new Date(), timeZone = undefined } = {}) => {
  /** @type {Intl.DateTimeFormatOptions} */
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'longOffset',
  };

  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { ...options, hour12: false, timeZone })
      .formatToParts(date)
      .filter(({ type }) => type in options)
      .map(({ type, value }) => [type, type === 'hour' && value === '24' ? '00' : value]),
  );
};
