/**
 * @import {
 * CollectionType,
 * InternalCollection,
 * } from '$lib/types/private';
 * @import {
 * Collection,
 * CollectionDivider,
 * CollectionFile,
 * EntryCollection,
 * FileCollection,
 * } from '$lib/types/public';
 */

/**
 * Check if the given collection is an entry collection. An entry collection is defined as one that
 * has the `fields` property that is an array and does not have the `files` property. Its entries
 * are stored in the `folder`, or in the single `file`, which the config parser requires one of.
 * @param {Collection} collection Collection definition.
 * @returns {collection is EntryCollection} Whether the collection is an entry collection.
 */
export const isEntryCollection = (collection) =>
  // @ts-ignore
  Array.isArray(collection.fields) && !Array.isArray(collection.files);

/**
 * Check if the given collection is a file collection. A file collection is defined as one that has
 * the `files` property that is an array.
 * @param {Collection} collection Collection definition.
 * @returns {collection is FileCollection} Whether the collection is a file collection.
 */
export const isFileCollection = (collection) =>
  // @ts-ignore
  Array.isArray(collection.files);

/**
 * Check if the given collection is a singleton collection. A singleton collection is a special type
 * of file collection that has the name `_singletons`.
 * @param {Collection} collection Collection definition.
 * @returns {collection is FileCollection} Whether the collection is a singleton collection.
 */
export const isSingletonCollection = (collection) =>
  isFileCollection(collection) && collection.name === '_singletons';

/**
 * Check if the given collection is an entry collection storing all the entries in one file, defined
 * with the `file` option, as an array of objects.
 * @param {InternalCollection | undefined} collection Collection.
 * @returns {boolean} Result.
 */
export const isArrayFileCollection = (collection) =>
  collection?._type === 'entry' && !!collection._file.arrayFile;

/**
 * Check if the given collection is a valid entry or file collection. A valid collection must have a
 * `fields` property for entry collections or a `files` property for file collections. It must not
 * be a divider.
 * @param {Collection | CollectionDivider} collection Collection definition or divider.
 * @param {object} [options] Filter options.
 * @param {boolean} [options.visible] Whether to filter out hidden collections. Defaults to `false`.
 * @param {CollectionType} [options.type] Type of collections to filter by. If provided, only
 * collections of this type will be returned.
 * @returns {collection is Collection} Whether the collection is valid.
 */
export const isValidCollection = (collection, { visible = undefined, type = undefined } = {}) => {
  if ('divider' in collection) {
    return false;
  }

  if (visible && collection.hide) {
    return false;
  }

  if (type === 'entry') {
    return isEntryCollection(collection);
  }

  if (type === 'file') {
    return isFileCollection(collection);
  }

  if (type === 'singleton') {
    return isSingletonCollection(collection);
  }

  return isEntryCollection(collection) || isFileCollection(collection);
};

/**
 * Check if the given collection file is valid. A valid file must have a string `file` property, not
 * be a `divider`, and have `fields` defined as an array.
 * @param {CollectionFile | CollectionDivider} file File definition or divider.
 * @returns {boolean} Whether the file is valid.
 */
export const isValidCollectionFile = (file) =>
  !('divider' in file) && typeof file.file === 'string' && Array.isArray(file.fields);

/**
 * Get a list of valid collection files from the given file definitions. This filters out dividers
 * and invalid files that do not have a string `file` property or do not have `fields` defined as an
 * array.
 * @param {(CollectionFile | CollectionDivider)[]} files File definitions. May include dividers.
 * @returns {CollectionFile[]} List of valid collection files.
 */
export const getValidCollectionFiles = (files) =>
  /** @type {CollectionFile[]} */ (files.filter((file) => isValidCollectionFile(file)));
