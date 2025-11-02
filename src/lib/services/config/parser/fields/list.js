import { parseFieldConfig, parseFields } from '$lib/services/config/parser/fields';

/**
 * @import { ListField } from '$lib/types/public';
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Parse and validate a List field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseListFieldConfig = ({ fieldConfig, context, collectors }) => {
  const { field: subfield, fields: subfields, types } = /** @type {ListField} */ (fieldConfig);
  const { typedKeyPath } = context;

  // Handle single subfield
  if (subfield) {
    parseFieldConfig({
      fieldConfig: subfield,
      context: { ...context, typedKeyPath: `${typedKeyPath}.*` },
      collectors,
    });
  }

  // Handle subfields
  if (subfields) {
    parseFields(subfields, { ...context, typedKeyPath: `${typedKeyPath}.*` }, collectors);
  }

  // Handle variable types
  types?.forEach(({ name: type, fields: typedFields }) => {
    if (typedFields) {
      parseFields(
        typedFields,
        { ...context, typedKeyPath: `${typedKeyPath}.*<${type}>` },
        collectors,
      );
    }
  });
};
