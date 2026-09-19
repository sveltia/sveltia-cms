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
 * Value types that store an integer.
 */
const INTEGER_VALUE_TYPES = ['int', 'int/string'];
/**
 * Value types that store a floating-point number.
 */
const FLOAT_VALUE_TYPES = ['float', 'float/string'];

/**
 * Check that the `default` option is a number of the `value_type`. A default that doesn’t parse as
 * one is dropped at runtime, so the field comes up empty in a new entry.
 * @param {FieldParserArgs} args Arguments.
 */
const checkDefaultValue = ({ config, context, collectors }) => {
  const { default: defaultValue, value_type: valueType = 'int' } = /** @type {NumberField} */ (
    config
  );

  // A default or value type of the wrong type is reported against the JSON schema
  if (!['string', 'number'].includes(typeof defaultValue)) {
    return;
  }

  const isInteger = INTEGER_VALUE_TYPES.includes(valueType);

  if (!isInteger && !FLOAT_VALUE_TYPES.includes(valueType)) {
    return;
  }

  // Parse a string the same way the runtime does
  const value =
    typeof defaultValue === 'string'
      ? (isInteger ? Number.parseInt : Number.parseFloat)(defaultValue)
      : defaultValue;

  if (isInteger ? !Number.isInteger(value) : !Number.isFinite(value)) {
    addMessage({
      strKey: isInteger ? 'number_field_default_not_integer' : 'number_field_default_not_number',
      values: { value: String(defaultValue), valueType },
      context,
      collectors,
    });
  }
};

/**
 * Parse and validate a Number field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseNumberFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const { step } = /** @type {NumberField} */ (config);

  checkDefaultValue(args);

  // A step of zero or less leaves the arrow keys and buttons with nowhere to go. `any` is fine; it
  // just turns the check off. A value of another type is reported against the JSON schema
  if (typeof step === 'number' && step <= 0) {
    addMessage({ strKey: 'invalid_step', values: { step: String(step) }, context, collectors });
  }

  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });
};
