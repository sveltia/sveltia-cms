/**
 * @import { DateTimeFieldNormalizedProps } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

const TIMEZONE_ENUM = new Set(['local', 'utc']);
/**
 * Cache normalized date-time field configurations by field config reference.
 * @type {WeakMap<DateTimeField, DateTimeFieldNormalizedProps>}
 */
const configCacheMap = new WeakMap();

/**
 * Check if a timezone string is a custom IANA timezone (not a special value). No need to validate
 * the timezone here because that’s handled by `validateTimeZone` in the field parser, and this
 * function is only used to determine if the timezone should be passed to Day.js for
 * parsing/formatting.
 * @param {any} timeZone Timezone string to check.
 * @returns {timeZone is string} True if custom IANA timezone, false otherwise.
 */
export const isCustomTimeZone = (timeZone) =>
  typeof timeZone === 'string' && !TIMEZONE_ENUM.has(timeZone);

/**
 * Parse the DateTime field configuration and return as normalized format.
 * @param {DateTimeField} fieldConfig Field config.
 * @returns {DateTimeFieldNormalizedProps} Normalized properties.
 */
export const parseDateTimeConfig = (fieldConfig) => {
  const cache = configCacheMap.get(fieldConfig);

  if (cache) {
    return cache;
  }

  const {
    type = 'datetime-local',
    min = undefined,
    max = undefined,
    step = undefined,
    format,
    date_format: dateFormat = undefined,
    time_format: timeFormat = undefined,
    picker_utc: pickerUTC = false,
    input_timezone: inputTimeZone = 'local',
    output_utc: outputUTC = false,
  } = fieldConfig;

  const normalizedInputTimeZone =
    typeof inputTimeZone === 'string' && inputTimeZone !== 'any' ? inputTimeZone : 'local';

  const dateFormatStr = typeof dateFormat === 'string' ? dateFormat : '';
  const timeFormatStr = typeof timeFormat === 'string' ? timeFormat : '';
  const dateOnly = type === 'date' || timeFormat === false;
  const timeOnly = type === 'time' || dateFormat === false;
  const defaultMax = dateOnly ? '9999-12-31' : timeOnly ? undefined : '9999-12-31T23:59';

  const _inputTimeZone =
    fieldConfig.input_timezone !== undefined
      ? normalizedInputTimeZone
      : pickerUTC
        ? 'utc'
        : 'local';

  const normalizedConfig = /** @type {DateTimeFieldNormalizedProps} */ ({
    type: dateOnly ? 'date' : timeOnly ? 'time' : 'datetime-local',
    min: typeof min === 'string' && min ? min : undefined,
    max: typeof max === 'string' && max ? max : defaultMax,
    step:
      (typeof step === 'number' && Number.isInteger(step) && step > 0) || step === 'any'
        ? step
        : undefined,
    format: format || [dateFormatStr, timeFormatStr].join(' ').trim() || undefined,
    dateOnly,
    timeOnly,
    inputTimeZone: _inputTimeZone,
    outputUTC: fieldConfig.output_utc !== undefined ? outputUTC : pickerUTC,
    utc: _inputTimeZone === 'utc',
    singleCustomTimeZone: isCustomTimeZone(_inputTimeZone) ? _inputTimeZone : undefined,
  });

  configCacheMap.set(fieldConfig, normalizedConfig);

  return normalizedConfig;
};
