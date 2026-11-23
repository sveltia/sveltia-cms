import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import { MULTI_VALUE_FIELD_TYPES } from '$lib/services/contents/fields';
import { forEachSubFieldConfig } from '$lib/services/contents/fields/list/subfields';

/**
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Parse a field to generate a sorted key path list.
 * @param {object} args Arguments.
 * @param {Field} args.field Single field.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {FieldKeyPath[]} args.keyPathList Key path list.
 */
const parseField = ({ field, keyPath, keyPathList }) => {
  const { widget: fieldType } = field;

  keyPathList.push(keyPath);

  if (fieldType === 'list' || fieldType === 'object') {
    const { field: subField, fields, types, typeKey = 'type' } = /** @type {any} */ (field);
    const prefix = fieldType === 'list' ? `${keyPath}.*` : keyPath;

    if (types && !fields) {
      keyPathList.push(`${prefix}.${typeKey}`);
    } else if (fieldType === 'list' && !fields && !subField) {
      keyPathList.push(prefix);
    }

    forEachSubFieldConfig(field, keyPath, (_field, _keyPath) => {
      parseField({ field: _field, keyPath: _keyPath, keyPathList });
    });
  } else if (fieldType && MULTI_VALUE_FIELD_TYPES.includes(fieldType) && isFieldMultiple(field)) {
    // Only add wildcard path for multi-value field types that aren’t list/object
    keyPathList.push(`${keyPath}.*`);
  }
};

/**
 * Create a list of field names (flattened key path list) from the configured collection fields.
 * @param {Field[]} fields Field list of a collection or a file.
 * @returns {FieldKeyPath[]} Sorted key path list. List items are with `*`.
 * @example [`author.name`, `books.*.title`, `books.*.summary`, `publishDate`, `body`]
 */
export const createKeyPathList = (fields) => {
  /** @type {FieldKeyPath[]} */
  const keyPathList = [];

  // Iterate over the top-level fields first
  fields.forEach((field) => {
    parseField({
      field,
      keyPath: field.name,
      keyPathList,
    });
  });

  return keyPathList;
};
