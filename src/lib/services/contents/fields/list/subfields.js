/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * ListFieldWithSubField,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * VariableFieldType,
 * } from '$lib/types/public';
 */

/**
 * Get the subfields of an Object field or a List field item whose value is stored in flattened
 * content: the field’s `fields`, or, with the `types` option, those of the variable type whose
 * name is stored under the type key, e.g. `blocks.0.type`.
 * @param {Field} field Field configuration.
 * @param {FlattenedEntryContent} valueMap Flattened entry content.
 * @param {FieldKeyPath} keyPath Key path of the object or list item.
 * @returns {Field[] | undefined} Subfields, or `undefined` if the field has none, or the stored
 * type name matches no variable type with subfields.
 */
export const getFlatSubFields = (field, valueMap, keyPath) => {
  const {
    fields,
    types,
    typeKey = 'type',
  } = /** @type {{ fields?: Field[], types?: VariableFieldType[], typeKey?: string }} */ (field);

  return fields ?? types?.find(({ name }) => name === valueMap[`${keyPath}.${typeKey}`])?.fields;
};

/**
 * Get the subfields of the variable type with the given name.
 * @param {VariableFieldType[]} types Variable types.
 * @param {string | undefined} typeName Type name.
 * @returns {Field[] | undefined} Subfields, or `undefined` if there is no such type.
 */
export const getTypeSubFields = (types, typeName) => {
  const typeConfig = types.find(({ name }) => name === typeName);

  return typeConfig ? (typeConfig.fields ?? []) : undefined;
};

/**
 * Get the subfields of an Object field value or a list item, resolving the variable type against
 * the type name stored in the value.
 * @param {object} args Arguments.
 * @param {Record<string, any> | undefined} args.value Object value.
 * @param {Field[]} [args.fields] Subfields, if the field has them.
 * @param {VariableFieldType[]} [args.types] Variable types, if the field has them.
 * @param {string} [args.typeKey] Property name holding the variable type name.
 * @returns {Field[]} Subfields.
 */
export const getValueSubFields = ({ value, fields, types, typeKey = 'type' }) =>
  fields ?? (types ? getTypeSubFields(types, value?.[typeKey]) : undefined) ?? [];

/**
 * Map the values nested in the given Object or List field value: the object itself, or each list
 * item, either with the list’s single subfield or as an object with its own subfields, resolving
 * the variable type against the type name stored in the value.
 * @param {any} value Field value.
 * @param {Field} fieldConfig Field configuration.
 * @param {(obj: any, fields: Field[], index?: number) => any} mapObject Function called for an
 * Object field value, and each item of a List field without a single subfield, with its subfields
 * and its index if it’s a list item. The value isn’t necessarily an object.
 * @param {(item: any, field: Field, index: number) => any} mapItem Function called for each item
 * of a List field with a single subfield.
 * @returns {any} Result of `mapObject` for an Object field, a new array of the results for the
 * items of a List field, or the value as is for anything else, e.g. a List field value that isn’t
 * an array.
 */
export const mapSubValues = (value, fieldConfig, mapObject, mapItem) => {
  const { widget } = fieldConfig;
  const { field } = /** @type {ListFieldWithSubField} */ (fieldConfig);

  const { fields, types, typeKey } = /** @type {ListFieldWithSubFields & ListFieldWithTypes} */ (
    fieldConfig
  );

  if (widget === 'object') {
    return mapObject(value, getValueSubFields({ value, fields, types, typeKey }));
  }

  if (widget !== 'list' || !Array.isArray(value)) {
    return value;
  }

  return value.map((item, index) =>
    field
      ? mapItem(item, field, index)
      : mapObject(item, getValueSubFields({ value: item, fields, types, typeKey }), index),
  );
};

/**
 * Get all the subfields of the given field: the `field` of a List field, its `fields`, and the
 * `fields` of every variable type, whichever it has.
 * @param {Field} field Field configuration.
 * @returns {Field[]} Subfields.
 */
export const getAllSubFields = (field) => {
  const {
    field: subField,
    fields = [],
    types = [],
  } = /** @type {{ field?: Field, fields?: Field[], types?: VariableFieldType[] }} */ (field);

  return [
    ...(subField ? [subField] : []),
    ...fields,
    ...types.flatMap((type) => type.fields ?? []),
  ];
};

/**
 * Call the given function for each subfield of the given Object or List field configuration, one
 * level down: the single subfield of a List field, which takes the item’s own key path, the
 * subfields, and those of every variable type. Anything that isn’t a list is skipped, so a raw
 * configuration can be walked before it’s validated.
 * @param {Field} field Field configuration.
 * @param {string} keyPath Key path of the field.
 * @param {(subField: Field, keyPath: string) => void} callback Function called with each subfield
 * and its key path, e.g. `blocks.*.src`.
 * @param {boolean} [typed] Whether to add the variable type name to the key path of its subfields,
 * e.g. `blocks.*<image>.src`.
 */
export const forEachSubFieldConfig = (field, keyPath, callback, typed = false) => {
  const { widget, field: subField, fields, types } = /** @type {any} */ (field);

  if (widget !== 'object' && widget !== 'list') {
    return;
  }

  const prefix = widget === 'list' ? `${keyPath}.*` : keyPath;

  /**
   * Call the function for each field in the given list.
   * @param {any} list Field list.
   * @param {string} path Key path of the object holding the fields.
   */
  const visit = (list, path) => {
    if (Array.isArray(list)) {
      list.forEach((_field) => callback(_field, `${path}.${_field?.name}`));
    }
  };

  if (widget === 'list' && subField) {
    callback(subField, prefix);
  }

  visit(fields, prefix);

  if (Array.isArray(types)) {
    types.forEach((type) => visit(type?.fields, typed ? `${prefix}<${type?.name}>` : prefix));
  }
};

/**
 * Check whether the given field or any field below it, at any depth, satisfies the predicate.
 * @param {Field} field Field configuration.
 * @param {(field: Field) => boolean} predicate Function that checks a single field.
 * @param {WeakMap<Field, boolean>} [cache] Cache of results keyed by the field configuration, for
 * a predicate that depends on nothing but the configuration. Use one cache per predicate.
 * @returns {boolean} Result.
 */
export const someSubField = (field, predicate, cache) => {
  const cached = cache?.get(field);

  if (cached !== undefined) {
    return cached;
  }

  const result =
    predicate(field) ||
    getAllSubFields(field).some((subField) => someSubField(subField, predicate, cache));

  cache?.set(field, result);

  return result;
};
