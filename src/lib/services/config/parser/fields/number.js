import { checkUnsupportedOptions } from '$lib/services/config/parser/utils/messages';

/**
 * @import { FieldParserArgs, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options for Number fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [{ prop: 'valueType', newProp: 'value_type' }];

/**
 * Parse and validate a Number field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseNumberFieldConfig = (args) => {
  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });
};
