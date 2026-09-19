import { isObject } from '@sveltia/utils/object';

import { parseFieldConfig, parseFields } from '$lib/services/config/parser/fields/registry';
import { checkObjectDefault } from '$lib/services/config/parser/utils/defaults';
import { getSubFields } from '$lib/services/config/parser/utils/fields';
import { checkThumbnailField } from '$lib/services/config/parser/utils/references';
import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';
import { BUILTIN_FIELD_TYPES } from '$lib/services/contents/fields';

/**
 * @import {
 * ComplexListFieldBaseProps,
 * ListField,
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
 * Field types whose value is an object, so a List field with one of them as its single `field`
 * holds objects rather than plain values.
 */
const OBJECT_FIELD_TYPES = ['keyvalue', 'object'];

/**
 * Check the shape of the `default` option, which depends on how the field is configured. The JSON
 * schema only ensures it’s an array of strings or objects; what’s checked here is whether each item
 * is what the field holds: a plain value for a simple list or a list with a single `field` of a
 * plain type, an object with known properties for a list with `fields`, and an object naming one
 * of the `types` for a list with variable types. A mismatched item would be dropped or saved as-is,
 * so the user would find nothing or something unexpected in a new entry.
 * @param {FieldParserArgs} args Arguments.
 */
export const checkDefaultValue = ({ config, context, collectors }) => {
  const { default: defaultValue } = /** @type {ListField} */ (config);
  const { field: subfield } = /** @type {ListFieldWithSubField} */ (config);
  const { fields: subfields } = /** @type {ListFieldWithSubFields} */ (config);
  const { types, typeKey = 'type' } = /** @type {ListFieldWithTypes} */ (config);

  if (!Array.isArray(defaultValue)) {
    return;
  }

  /** @type {any[]} */ (defaultValue).forEach((item) => {
    if (!subfields && !types) {
      // A simple list holds plain values; so does a list whose single `field` is a plain type. A
      // custom field type can hold anything, so it’s left alone
      const { widget: subfieldType = 'string' } = subfield ?? {};

      const holdsObjects =
        !!subfield &&
        (OBJECT_FIELD_TYPES.includes(subfieldType) ||
          !(/** @type {string[]} */ (BUILTIN_FIELD_TYPES).includes(subfieldType)));

      if (isObject(item) && !holdsObjects) {
        addMessage({ strKey: 'list_field_invalid_default_object', context, collectors });
      }

      return;
    }

    if (!isObject(item)) {
      addMessage({
        strKey: 'list_field_invalid_default_item',
        values: { value: String(item) },
        context,
        collectors,
      });

      return;
    }

    checkObjectDefault({
      value: item,
      fields: subfields,
      types,
      typeKey,
      strKeyBase: 'list_field',
      context,
      collectors,
    });
  });
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

  checkDefaultValue(args);

  // The `thumbnail` option names a subfield of an item, or the single subfield
  checkThumbnailField({ thumbnail, fields: getSubFields(config), context, collectors });

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
