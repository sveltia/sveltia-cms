import { parseFields } from '$lib/services/config/parser/fields/registry';
import { getSubFields } from '$lib/services/config/parser/utils/fields';
import { checkFieldReferences } from '$lib/services/config/parser/utils/references';
import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';

/**
 * @import { ObjectField, ObjectFieldWithSubFields, ObjectFieldWithTypes } from '$lib/types/public';
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
  const { thumbnail } = /** @type {ObjectField} */ (config);
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

  // An empty list of subfields or variable types makes the field an empty object. One of the
  // options is required by the JSON schema, so only an explicit empty list is checked here
  if (subfields?.length === 0 || types?.length === 0) {
    addMessage({ strKey: 'object_field_no_subfields', context, collectors });

    return;
  }

  // The `thumbnail` option names a subfield
  checkFieldReferences({
    option: 'thumbnail',
    keyPaths: thumbnail,
    fields: getSubFields(config),
    context,
    collectors,
  });

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
