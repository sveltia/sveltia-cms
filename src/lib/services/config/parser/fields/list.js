import { parseFieldConfig, parseFields } from '$lib/services/config/parser/fields';
import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';

/**
 * @import {
 * ListFieldWithSubField,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * } from '$lib/types/public';
 * @import {
 * ConfigParserCollectors,
 * ConfigParserContext,
 * FieldParserArgs,
 * } from '$lib/types/private';
 */

/**
 * Check if the field type is valid for a List field’s variable type.
 * @param {string} fieldType Field type.
 * @param {ConfigParserContext} context Context.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @returns {boolean} Whether the field type is valid.
 */
export const checkFieldType = (fieldType, context, collectors) => {
  if (fieldType !== 'object') {
    addMessage({
      strKey: 'invalid_list_variable_type',
      context,
      values: { widget: fieldType },
      collectors,
    });

    return false;
  }

  return true;
};

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
  types?.forEach(({ name, widget: fieldType = 'object', fields: typedFields }, index) => {
    const newContext = { ...context, typedKeyPath: `${typedKeyPath}.*<${name}>` };

    if (
      checkName({ ...checkNameArgs, name, index, context: newContext }) &&
      checkFieldType(fieldType, newContext, collectors) &&
      typedFields
    ) {
      parseFields(typedFields, newContext, collectors);
    }
  });
};
