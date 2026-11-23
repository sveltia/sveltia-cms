import { isObject } from '@sveltia/utils/object';

import { parseFields, parseVariableTypes } from '$lib/services/config/parser/fields/registry';
import { checkObjectDefault } from '$lib/services/config/parser/utils/defaults';
import { getSubFields } from '$lib/services/config/parser/utils/fields';
import { checkThumbnailField } from '$lib/services/config/parser/utils/references';
import { addMessage } from '$lib/services/config/parser/utils/validator';

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
  const { types, typeKey } = /** @type {ObjectFieldWithTypes} */ (config);
  const { default: defaultValue, thumbnail } = /** @type {ObjectField} */ (config);
  const { typedKeyPath } = context;

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

  // The `default` object holds subfield values, or names a variable type. A value of another type
  // is reported against the JSON schema
  if (isObject(defaultValue)) {
    checkObjectDefault({
      value: defaultValue,
      fields: subfields,
      types,
      typeKey,
      strKeyBase: 'object_field',
      context,
      collectors,
    });
  }

  // The `thumbnail` option names a subfield
  checkThumbnailField({ thumbnail, fields: getSubFields(config), context, collectors });

  // Handle subfields
  if (subfields) {
    parseFields(subfields, context, collectors);
  }

  // Handle variable types
  // `parseFieldConfig()` always sets the key path of the field being parsed
  parseVariableTypes({
    types,
    typeKeyPath: /** @type {string} */ (typedKeyPath),
    context,
    collectors,
  });
};
