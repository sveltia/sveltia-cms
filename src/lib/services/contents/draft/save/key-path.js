import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import { MULTI_VALUE_FIELD_TYPES } from '$lib/services/contents/widgets';

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
 * Parse a field to generate a sorted key path list.
 * @internal
 * @param {object} args Arguments.
 * @param {Field} args.field Single field.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {FieldKeyPath[]} args.keyPathList Key path list.
 */
export const parseField = ({ field, keyPath, keyPathList }) => {
  const { widget: fieldType } = field;
  const isList = fieldType === 'list';

  keyPathList.push(keyPath);

  if (isList || fieldType === 'object') {
    const { fields: subFields } = /** @type {FieldWithSubFields} */ (field);
    const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (field);

    if (subFields) {
      subFields.forEach((subField) => {
        parseField({
          field: subField,
          keyPath: isList ? `${keyPath}.*.${subField.name}` : `${keyPath}.${subField.name}`,
          keyPathList,
        });
      });
    } else if (types) {
      keyPathList.push(isList ? `${keyPath}.*.${typeKey}` : `${keyPath}.${typeKey}`);

      types.forEach((type) => {
        type.fields?.forEach((subField) => {
          parseField({
            field: subField,
            keyPath: isList ? `${keyPath}.*.${subField.name}` : `${keyPath}.${subField.name}`,
            keyPathList,
          });
        });
      });
    } else if (isList) {
      const { field: subField } = /** @type {ListFieldWithSubField} */ (field);

      if (subField) {
        parseField({
          field: subField,
          keyPath: `${keyPath}.*`,
          keyPathList,
        });
      } else {
        keyPathList.push(`${keyPath}.*`);
      }
    }
  } else if (fieldType && MULTI_VALUE_FIELD_TYPES.includes(fieldType) && isFieldMultiple(field)) {
    // Only add wildcard path for multi-value field types that aren't list/object
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
