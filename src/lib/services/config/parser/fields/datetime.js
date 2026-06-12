import { addMessage, checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';
import { isCustomTimeZone } from '$lib/services/contents/fields/date-time/config';

/**
 * @import { FieldParserArgs, UnsupportedOption } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

/**
 * Unsupported options for DateTime fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  // Deprecated camelCase options in Netlify/Decap CMS config, should be converted to snake_case.
  { prop: 'dateFormat', newProp: 'date_format' },
  { prop: 'timeFormat', newProp: 'time_format' },
  { prop: 'pickerUtc', newProp: 'picker_utc' },
];

/**
 * Validate an IANA timezone identifier.
 * @param {string} timeZone IANA timezone identifier to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
const validateTimeZone = (timeZone) => {
  try {
    // Attempt to use the timezone - will throw `RangeError` if invalid.
    Intl.DateTimeFormat('en-US', { timeZone });

    return true;
  } catch {
    return false;
  }
};

/**
 * Validate timezone-related options in the DateTime field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
const validateTimeZoneOptions = (args) => {
  const { config, context, collectors } = args;

  const {
    picker_utc: pickerUTC,
    input_timezone: inputTimeZone,
    output_utc: outputUTC,
  } = /** @type {DateTimeField} */ (config);

  // Warn when both old and new options are present
  if (pickerUTC !== undefined && (inputTimeZone !== undefined || outputUTC !== undefined)) {
    addMessage({
      type: 'warning',
      strKey: 'conflicting_timezone_options',
      context,
      collectors,
    });
  }

  if (isCustomTimeZone(inputTimeZone) && !validateTimeZone(inputTimeZone)) {
    addMessage({
      strKey: 'invalid_timezone',
      values: { timeZone: inputTimeZone },
      context,
      collectors,
    });
  }
};

/**
 * Parse and validate a DateTime field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseDateTimeFieldConfig = (args) => {
  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });
  validateTimeZoneOptions(args);
};
