import { UUID_TYPES } from '$lib/services/common/template/constants';
import { parseTransformations } from '$lib/services/common/transformations';
import { getRootFields } from '$lib/services/config/parser/utils/fields';
import { checkFieldReferences } from '$lib/services/config/parser/utils/references';
import { addMessage } from '$lib/services/config/parser/utils/validator';
import { parseExpression } from '$lib/services/contents/fields/compute/expression';

/**
 * @import { FieldParserArgs } from '$lib/types/private';
 * @import { ComputeField } from '$lib/types/public';
 */

/**
 * Check the arithmetic expression of a Compute field with a numeric `value_type`. An invalid one,
 * or one with a UUID tag, which never resolves to a number, would leave the value empty.
 * @param {FieldParserArgs} args Arguments.
 */
const checkExpression = ({ config, context, collectors }) => {
  const { value, value_type: valueType } = /** @type {ComputeField} */ (config);
  const { tree, tags } = parseExpression(value);

  if (!tree) {
    addMessage({
      strKey: 'compute_field_invalid_expression',
      values: { valueType },
      context,
      collectors,
    });

    return;
  }

  if (tags.some((tag) => Object.hasOwn(UUID_TYPES, parseTransformations(tag).value))) {
    addMessage({
      strKey: 'compute_field_uuid_in_expression',
      values: { valueType },
      context,
      collectors,
    });
  }
};

/**
 * Parse and validate a Compute field configuration. The `value` template reads other fields of the
 * entry through `{{fields.*}}` tags, and a tag that names no field yields an empty string, so the
 * computed value silently comes out wrong. Bare tags are not field references: `{{index}}` is the
 * position of the item in a list, `{{uuid}}` and its shorter variants are generated, and any other
 * one yields nothing, so there is no point checking them against the fields. With a numeric
 * `value_type`, the `value` is also checked as an arithmetic expression.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseComputeFieldConfig = ({ config, context, collectors }) => {
  const { value, value_type: valueType = 'string' } = /** @type {ComputeField} */ (config);
  // The fields of a custom editor component aren’t known here, so only a field of a collection or
  // file can be checked
  const fields = getRootFields(context);

  // A value of another type is reported against the JSON schema
  if (valueType !== 'string' && typeof value === 'string') {
    checkExpression({ config, context, collectors });
  }

  if (fields?.length) {
    checkFieldReferences({
      option: 'value',
      template: value,
      prefixedOnly: true,
      fields,
      context,
      collectors,
    });
  }
};
