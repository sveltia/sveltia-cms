import { parseFieldConfig, parseFields } from '$lib/services/config/parser/fields';
import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';

/**
 * @import {
 * ListFieldWithSubField,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * } from '$lib/types/public';
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Parse and validate a List field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseListFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const { field: subfield } = /** @type {ListFieldWithSubField} */ (config);
  const { fields: subfields } = /** @type {ListFieldWithSubFields} */ (config);
  const { types } = /** @type {ListFieldWithTypes} */ (config);
  const { typedKeyPath } = context;
  const checkNameArgs = { nameCounts: {}, strKeyBase: 'variable_type', collectors };

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
  types?.forEach(({ name, fields: typedFields }, index) => {
    const newContext = { ...context, typedKeyPath: `${typedKeyPath}.*<${name}>` };

    if (checkName({ ...checkNameArgs, name, index, context: newContext }) && typedFields) {
      parseFields(typedFields, newContext, collectors);
    }
  });
};
