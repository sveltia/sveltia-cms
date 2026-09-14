import { addMessage, checkRegex } from '$lib/services/config/parser/utils/validator';

/**
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Pairs of options that bound a value from both sides, in the order they have to be in. Each pair
 * belongs to some field types only, but a pair that isn’t in a field’s configuration is simply not
 * checked, so it’s not worth spelling out which.
 * @type {[string, string][]}
 */
const RANGE_OPTIONS = [
  ['min', 'max'],
  ['minlength', 'maxlength'],
];

/**
 * Check the options that any field type can have. A `pattern` that can’t be compiled makes the
 * field skip its validation, and a range whose lower bound is above its upper bound can’t be
 * satisfied, but neither is reported at runtime.
 * @param {FieldParserArgs} args Arguments.
 */
export const checkCommonFieldOptions = ({ config, context, collectors }) => {
  const { pattern } = /** @type {Record<string, any>} */ (config);

  // The `pattern` option is a `[regex, message]` pair; anything else is reported against the JSON
  // schema
  if (Array.isArray(pattern)) {
    checkRegex({ option: 'pattern', pattern: pattern[0], context, collectors });
  }

  RANGE_OPTIONS.forEach(([minOption, maxOption]) => {
    const { [minOption]: min, [maxOption]: max } = /** @type {Record<string, any>} */ (config);

    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      addMessage({
        strKey: 'invalid_range_options',
        values: { min: minOption, max: maxOption },
        context,
        collectors,
      });
    }
  });
};
