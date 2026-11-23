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
 * Field,
 * ListField,
 * ListFieldWithSubField,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * RelationField,
 * SelectField,
 * StringField,
 * } from '$lib/types/public';
 * @import {
 * ConfigParserCollectors,
 * ConfigParserContext,
 * FieldParserArgs,
 * } from '$lib/types/private';
 */

/**
 * Field types that can hold the key of a List field item stored as a map, as each of them has a
 * single string value.
 */
const MAP_KEY_FIELD_TYPES = ['string', 'relation', 'select'];

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
 * Check the `map_key_field` option, which names the subfield whose value becomes the key of each
 * item when the list is stored as a map. The subfield has to be a required String, Relation or
 * Select field that exists in every locale, and with variable types, every type has to have it, or
 * some items would have no key. A Relation or Select field can’t take multiple values, which can’t
 * make a single key, and a Select field’s options must have string values, as a key read back from
 * a file is always a string. A list of plain values or with a single `field` has no subfields to
 * take a key from.
 * @param {FieldParserArgs} args Arguments.
 * @see https://github.com/sveltia/sveltia-cms/issues/1077
 * @see https://github.com/sveltia/sveltia-cms/issues/1082
 */
export const checkMapKeyField = ({ config, context, collectors }) => {
  const { fields: subfields } = /** @type {ListFieldWithSubFields} */ (config);
  const { types } = /** @type {ListFieldWithTypes} */ (config);

  const { map_key_field: name } = /** @type {ListFieldWithSubFields | ListFieldWithTypes} */ (
    config
  );

  // A value of another type is reported against the JSON schema
  if (typeof name !== 'string' || !name) {
    return;
  }

  if (!subfields && !types) {
    addMessage({ strKey: 'list_field_map_key_no_subfields', context, collectors });

    return;
  }

  /**
   * Check the key subfield among the given fields.
   * @param {Field[]} fields Subfields of the list, or of one of its types.
   * @param {string} [type] Name of the variable type, if any.
   */
  const checkSubFields = (fields, type) => {
    const subfield = fields.find((field) => field.name === name);

    if (!subfield) {
      addMessage({
        strKey: type ? 'list_field_map_key_missing_in_type' : 'list_field_map_key_not_found',
        values: { name, type },
        context,
        collectors,
      });

      return;
    }

    const { widget: fieldType = 'string', i18n } = subfield;
    const { required = true } = /** @type {StringField} */ (subfield);

    if (!MAP_KEY_FIELD_TYPES.includes(fieldType)) {
      addMessage({
        strKey: 'list_field_map_key_invalid_type',
        values: { name, widget: fieldType },
        context,
        collectors,
      });
    }

    if (/** @type {RelationField | SelectField} */ (subfield).multiple === true) {
      addMessage({
        strKey: 'list_field_map_key_multiple',
        values: { name },
        context,
        collectors,
      });
    }

    const { options } = /** @type {SelectField} */ (subfield);

    // Options of another type are reported against the JSON schema
    if (
      fieldType === 'select' &&
      Array.isArray(options) &&
      options.some((option) => typeof (isObject(option) ? option.value : option) !== 'string')
    ) {
      addMessage({
        strKey: 'list_field_map_key_option_not_string',
        values: { name },
        context,
        collectors,
      });
    }

    // An item can’t be saved without a key, so the subfield can’t be optional in any locale
    if (required !== true) {
      addMessage({
        strKey: 'list_field_map_key_not_required',
        values: { name },
        context,
        collectors,
      });
    }

    // A subfield that only exists in the default locale would leave the items in the other locales
    // without a key
    if (i18n === false || i18n === 'none') {
      addMessage({
        strKey: 'list_field_map_key_not_localized',
        values: { name },
        context,
        collectors,
      });
    }
  };

  if (subfields) {
    checkSubFields(subfields);
  } else {
    types.forEach(({ name: type, fields = [] }) => checkSubFields(fields, type));
  }
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
  checkMapKeyField(args);

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
