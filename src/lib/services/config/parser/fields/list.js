import { parseFieldConfig, parseFields } from '$lib/services/config/parser/fields/registry';
import { getSubFields } from '$lib/services/config/parser/utils/fields';
import { checkFieldReferences } from '$lib/services/config/parser/utils/references';
import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';

/**
 * @import {
 * ComplexListFieldBaseProps,
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
  const { thumbnail } = /** @type {ComplexListFieldBaseProps} */ (config);
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

  // An empty list of subfields or variable types makes every item an empty object. A list without
  // any of the options is a plain list of strings, so only an explicit empty list is a mistake
  if (subfields?.length === 0 || types?.length === 0) {
    addMessage({ strKey: 'list_field_no_subfields', context, collectors });

    return;
  }

  // The `thumbnail` option names a subfield of an item, or the single subfield
  checkFieldReferences({
    option: 'thumbnail',
    keyPaths: thumbnail,
    fields: getSubFields(config),
    context,
    collectors,
  });

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
