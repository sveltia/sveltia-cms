import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import { MULTI_VALUE_WIDGETS } from '$lib/services/contents/widgets';

/**
 * @import {
 * Field,
 * FieldKeyPath,
 * ListField,
 * MultiValueField,
 * ObjectField,
 * } from '$lib/types/public';
 */

/**
 * Parse a field to generate a sorted key path list.
 * @param {object} args Arguments.
 * @param {Field} args.field Single field.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {FieldKeyPath[]} args.keyPathList Key path list.
 */
const parseField = ({ field, keyPath, keyPathList }) => {
  const { widget } = field;
  const isList = widget === 'list';

  keyPathList.push(keyPath);

  if (isList || widget === 'object') {
    const {
      fields: subFields,
      types,
      typeKey = 'type',
    } = /** @type {ListField | ObjectField} */ (field);

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
      const { field: subField } = /** @type {ListField} */ (field);

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
  }

  if (widget && MULTI_VALUE_WIDGETS.includes(widget)) {
    keyPathList.push(isFieldMultiple(field) ? `${keyPath}.*` : keyPath);
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
