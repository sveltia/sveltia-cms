import { isNumeric } from '$lib/services/utils/number';

/**
 * @import { ConfigParserContext } from '$lib/types/private';
 * @import {
 * EntryCollection,
 * Field,
 * FieldKeyPath,
 * FieldWithSubFields,
 * FieldWithTypes,
 * ListFieldWithSubField,
 * } from '$lib/types/public';
 */

/**
 * Entry metadata property keys that can be used in the `filter`, `sortable_fields`, `view_groups`
 * and `view_filters` options in place of a field key path. These are resolved by
 * `getPropertyValue()` from the entry itself rather than the collection’s `fields`.
 * @type {string[]}
 */
export const METADATA_KEYS = ['slug', 'commit_author', 'commit_date'];

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
export const getSubFields = (field) => {
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

/**
 * Get the top-level fields of the entry a field being parsed belongs to: those of the collection
 * file, or the index file, or the collection. These are the fields an option that refers to the
 * entry’s fields, such as a template, can name.
 * @param {ConfigParserContext} context Context.
 * @returns {Field[] | undefined} Fields, or `undefined` outside a collection, e.g. for a field of a
 * custom editor component.
 */
export const getRootFields = ({ collection, collectionFile, isIndexFile }) => {
  if (collectionFile) {
    return collectionFile.fields;
  }

  if (!collection || !('folder' in collection)) {
    return undefined;
  }

  const { fields, index_file: indexFile } = /** @type {EntryCollection} */ (collection);

  if (isIndexFile && typeof indexFile === 'object' && indexFile.fields) {
    return indexFile.fields;
  }

  return fields;
};
