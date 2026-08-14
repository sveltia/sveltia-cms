import { isNumeric } from '$lib/services/utils/number';

/**
 * @import {
 * Field,
 * FieldKeyPath,
 * FieldWithSubFields,
 * FieldWithTypes,
 * ListFieldWithSubField,
 * } from '$lib/types/public';
 */

/**
 * Regular expression to match the explicit variable type in a key path segment, e.g. the `<button>`
 * part of `body<button>`.
 * @type {RegExp}
 */
const EXPLICIT_TYPE_REGEX = /<[^>]+>$/;

/**
 * Get the sub fields of the given field configuration: the single subfield of a List field, the
 * subfields of a List or Object field, or the subfields of all the variable types.
 * @param {Field} field Field configuration.
 * @returns {Field[]} Sub fields. An empty array if the field doesn’t have any.
 */
const getSubFields = (field) => {
  const { field: subField } = /** @type {ListFieldWithSubField} */ (field);
  const { fields: subFields } = /** @type {FieldWithSubFields} */ (field);
  const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (field);

  if (subField) {
    return [subField];
  }

  if (subFields) {
    return subFields;
  }

  if (types) {
    return [
      // Any of the types could be used for an item, so accept a subfield of any of them
      ...types.flatMap(({ fields: typeFields = [] }) => typeFields),
      // The type key, e.g. `blocks.0.type`, is a valid property although it’s not a field
      /** @type {Field} */ ({ name: typeKey }),
    ];
  }

  return [];
};

/**
 * Check if the given key path points to a field defined in the given field list. This is a lenient
 * version of `getField()`, which lives in the runtime module graph (stores, backends) this parser
 * runs before, and which needs entry values to resolve variable types.
 * @internal
 * @param {Field[]} fields Field list.
 * @param {FieldKeyPath} keyPath Field key path, e.g. `author.name` or `images.0.src`.
 * @returns {boolean} Whether the field is defined.
 */
export const hasField = (fields, keyPath) => {
  /** @type {Field[]} */
  let candidates = fields;
  /** @type {Field | undefined} */
  let field = undefined;

  const isResolved = keyPath.split('.').every((segment) => {
    // Strip the explicit variable type, which is not part of the field name
    const key = segment.replace(EXPLICIT_TYPE_REGEX, '');

    // A list item index (`authors.0`) or wildcard (`images.*.src`) doesn’t point to a field itself,
    // so stay at the same level
    if (!key || key === '*' || isNumeric(key)) {
      return true;
    }

    if (field) {
      candidates = getSubFields(field);
    }

    field = candidates.find(({ name }) => name === key);

    return !!field;
  });

  return isResolved && !!field;
};
