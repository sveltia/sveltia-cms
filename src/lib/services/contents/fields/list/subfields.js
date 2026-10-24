/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { Field, FieldKeyPath, VariableFieldType } from '$lib/types/public';
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
