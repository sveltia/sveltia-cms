import { parseFields } from '$lib/services/config/parser/fields';
import { addMessage, checkName } from '$lib/services/config/parser/utils/messages';

/**
 * @import { ObjectField } from '$lib/types/public';
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Parse and validate an Object field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseObjectFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const { fields: subfields, types } = /** @type {ObjectField} */ (config);
  const { typedKeyPath } = context;
  /** @type {Record<string, number>} */
  const nameCounts = {};
  const strKeyBase = 'variable_type';

  // Validate mutually exclusive options
  if (subfields && types) {
    addMessage({
      strKey: 'invalid_object_field',
      context,
      collectors,
    });

    return;
  }

  // Ensure at least one of `fields` or `types` is defined
  if (!subfields && !types) {
    addMessage({
      strKey: 'object_field_missing_fields',
      context,
      collectors,
    });

    return;
  }

  // Handle subfields
  if (subfields) {
    parseFields(subfields, context, collectors);
  }

  // Handle variable types
  types?.forEach(({ name: type, fields: typedFields }, index) => {
    const newContext = { ...context, typedKeyPath: `${typedKeyPath}<${type}>` };

    if (
      checkName({ name: type, index, nameCounts, strKeyBase, context: newContext, collectors }) &&
      typedFields
    ) {
      parseFields(typedFields, newContext, collectors);
    }
  });
};
