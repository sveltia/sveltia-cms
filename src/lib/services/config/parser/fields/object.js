import { parseFields } from '$lib/services/config/parser/fields';
import { addMessage, checkName } from '$lib/services/config/parser/utils/messages';

/**
 * @import { ObjectFieldWithSubFields, ObjectFieldWithTypes } from '$lib/types/public';
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Parse and validate an Object field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseObjectFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const { fields: subfields } = /** @type {ObjectFieldWithSubFields} */ (config);
  const { types } = /** @type {ObjectFieldWithTypes} */ (config);
  const { typedKeyPath } = context;
  const checkNameArgs = { nameCounts: {}, strKeyBase: 'variable_type', collectors };

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
  types?.forEach(({ name, fields: typedFields }, index) => {
    const newContext = { ...context, typedKeyPath: `${typedKeyPath}<${name}>` };

    if (checkName({ ...checkNameArgs, name, index, context: newContext }) && typedFields) {
      parseFields(typedFields, newContext, collectors);
    }
  });
};
