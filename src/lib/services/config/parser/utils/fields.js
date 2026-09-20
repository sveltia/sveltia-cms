import { DEFAULT_CANONICAL_SLUG } from '$lib/services/contents/i18n/config/constants';
import { mergeI18nConfigs } from '$lib/services/contents/i18n/config/merge';
import { isNumeric } from '$lib/services/utils/number';

/**
 * @import { ConfigParserContext, InternalSingletonCollection } from '$lib/types/private';
 * @import {
 * CmsConfig,
 * Collection,
 * CollectionDivider,
 * CollectionFile,
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
 * Get the canonical slug key of the given collection or file. When i18n is enabled, the key —
 * `translationKey` by default — is added to the content of each localized entry, allowing entries
 * to be matched across locales. It can therefore be used wherever a field key path is expected,
 * such as the `value_field` of a Relation field or the `filter` option of a collection, even though
 * it’s not defined as a field.
 * @param {object} args Arguments.
 * @param {CmsConfig | undefined} args.cmsConfig The site configuration.
 * @param {Collection | CollectionDivider | InternalSingletonCollection} args.collection Collection.
 * @param {CollectionFile} [args.file] Collection file, if the collection is a file collection.
 * @returns {string | undefined} The key, or `undefined` if i18n is not enabled for the collection
 * or file.
 * @see https://sveltiacms.app/en/docs/i18n/slugs#localizing-entry-slugs
 */
export const getCanonicalSlugKey = ({ cmsConfig, collection, file }) => {
  const config = mergeI18nConfigs({ cmsConfig, collection, file });

  if (!config?.locales?.length) {
    return undefined;
  }

  return config.canonical_slug?.key ?? DEFAULT_CANONICAL_SLUG.key;
};

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
 * Find the fields the given key path can point to in the given field list. This is a lenient
 * version of `getField()`, which lives in the runtime module graph (stores, backends) this parser
 * runs before, and which needs entry values to resolve variable types. Without those values, a
 * name shared by the subfields of several variable types resolves to each of them.
 * @param {Field[]} fields Field list.
 * @param {FieldKeyPath} keyPath Field key path, e.g. `author.name` or `images.0.src`.
 * @returns {Field[]} Field configurations. An empty array if the field is not defined.
 */
export const findFields = (fields, keyPath) => {
  /** @type {Field[]} */
  let matches = [];
  let isFirstSegment = true;

  const isResolved = keyPath.split('.').every((segment) => {
    // Strip the explicit variable type, which is not part of the field name
    const key = segment.replace(EXPLICIT_TYPE_REGEX, '');

    // A list item index (`authors.0`) or wildcard (`images.*.src`) doesn’t point to a field itself,
    // so stay at the same level
    if (!key || key === '*' || isNumeric(key)) {
      return true;
    }

    const candidates = isFirstSegment ? fields : matches.flatMap((field) => getSubFields(field));

    isFirstSegment = false;
    matches = candidates.filter(({ name }) => name === key);

    return !!matches.length;
  });

  return isResolved ? matches : [];
};

/**
 * Check if the given key path points to a field defined in the given field list.
 * @param {Field[]} fields Field list.
 * @param {FieldKeyPath} keyPath Field key path, e.g. `author.name` or `images.0.src`.
 * @returns {boolean} Whether the field is defined.
 */
export const hasField = (fields, keyPath) => !!findFields(fields, keyPath).length;

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
