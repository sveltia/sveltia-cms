import { parseFields } from '$lib/services/config/parser/fields';

/**
 * @import { ObjectField } from '$lib/types/public';
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Parse and validate an Object field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseObjectFieldConfig = ({ fieldConfig, context, collectors }) => {
  const { fields: subfields, types } = /** @type {ObjectField} */ (fieldConfig);
  const { typedKeyPath } = context;

  // Handle subfields
  if (subfields) {
    parseFields(subfields, context, collectors);
  }

  // Handle variable types
  types?.forEach(({ name: type, fields: typedFields }) => {
    if (typedFields) {
      parseFields(
        typedFields,
        { ...context, typedKeyPath: `${typedKeyPath}<${type}>` },
        collectors,
      );
    }
  });
};
