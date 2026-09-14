import { getRootFields } from '$lib/services/config/parser/utils/fields';
import { checkFieldReferences } from '$lib/services/config/parser/utils/references';

/**
 * @import { FieldParserArgs } from '$lib/types/private';
 * @import { ComputeField } from '$lib/types/public';
 */

/**
 * Parse and validate a Compute field configuration. The `value` template reads other fields of the
 * entry through `{{fields.*}}` tags, and a tag that names no field yields an empty string, so the
 * computed value silently comes out wrong. Bare tags are not field references: `{{index}}` is the
 * position of the item in a list, and any other one yields nothing, so there is no point checking
 * them against the fields.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseComputeFieldConfig = ({ config, context, collectors }) => {
  const { value } = /** @type {ComputeField} */ (config);
  // The fields of a custom editor component aren’t known here, so only a field of a collection or
  // file can be checked
  const fields = getRootFields(context);

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
