import { checkUnsupportedOptions } from '$lib/services/config/parser/utils/messages';

/**
 * @import { FieldParserArgs, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options for DateTime fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  { prop: 'dateFormat', newProp: 'date_format' },
  { prop: 'timeFormat', newProp: 'time_format' },
  { prop: 'pickerUtc', newProp: 'picker_utc' },
];

/**
 * Parse and validate a DateTime field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseDateTimeFieldConfig = (args) => {
  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });
};
