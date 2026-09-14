import { addMessage, checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';

/**
 * @import { FieldParserArgs, UnsupportedOption } from '$lib/types/private';
 * @import { NumberField } from '$lib/types/public';
 */

/**
 * Unsupported options for Number fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  // Deprecated camelCase option in Netlify/Decap CMS config, should be converted to snake_case.
  { prop: 'valueType', newProp: 'value_type' },
];

/**
 * Parse and validate a Number field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseNumberFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const { step } = /** @type {NumberField} */ (config);

  // A step of zero or less leaves the arrow keys and buttons with nowhere to go. `any` is fine; it
  // just turns the check off. A value of another type is reported against the JSON schema
  if (typeof step === 'number' && step <= 0) {
    addMessage({ strKey: 'invalid_step', values: { step: String(step) }, context, collectors });
  }

  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });
};
