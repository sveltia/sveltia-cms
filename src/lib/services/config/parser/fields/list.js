import { parseFieldConfig, parseFields } from '$lib/services/config/parser/fields';
import { addMessage, checkName } from '$lib/services/config/parser/utils/messages';

/**
 * @import { ListField } from '$lib/types/public';
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Parse and validate a List field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseListFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const { field: subfield, fields: subfields, types } = /** @type {ListField} */ (config);
  const { typedKeyPath } = context;
  /** @type {Record<string, number>} */
  const nameCounts = {};
  const strKeyBase = 'variable_type';

  // Validate mutually exclusive options
  if ((subfield && subfields) || (subfield && types) || (subfields && types)) {
    addMessage({
      strKey: 'invalid_list_field',
      context,
      collectors,
    });

    return;
  }

  // Handle single subfield
  if (subfield) {
    parseFieldConfig({
      config: subfield,
      context: { ...context, typedKeyPath: `${typedKeyPath}.*` },
      collectors,
    });
  }

  // Handle subfields
  if (subfields) {
    parseFields(subfields, { ...context, typedKeyPath: `${typedKeyPath}.*` }, collectors);
  }

  // Handle variable types
  types?.forEach(({ name: type, fields: typedFields }, index) => {
    const newContext = { ...context, typedKeyPath: `${typedKeyPath}.*<${type}>` };

    if (
      checkName({ name: type, index, nameCounts, strKeyBase, context: newContext, collectors }) &&
      typedFields
    ) {
      parseFields(typedFields, newContext, collectors);
    }
  });
};
