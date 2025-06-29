import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getAssociatedCollections } from '$lib/services/contents/entry';

/**
 * @import {
 * Entry,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalSiteConfig,
 * } from '$lib/types/private';
 * @import { CollectionFile } from '$lib/types/public';
 */

/**
 * Check if the given collection file is valid. A valid file must have a string `file` property, not
 * be a `divider`, and have `fields` defined as an array.
 * @param {CollectionFile} file File definition.
 * @returns {boolean} Whether the file is valid.
 */
export const isValidCollectionFile = (file) =>
  typeof file.file === 'string' && !file.divider && Array.isArray(file.fields);

/**
 * Get a file in a file/singleton collection by its name.
 * @param {InternalCollection | string} collection Collection or collection name.
 * @param {string} fileName File name.
 * @returns {InternalCollectionFile | undefined} Collection file.
 */
export const getCollectionFile = (collection, fileName) => {
  /** @type {InternalCollection | undefined} */
  const _collection = typeof collection === 'string' ? getCollection(collection) : collection;

  if (!_collection || !('_fileMap' in _collection)) {
    return undefined;
  }

  return _collection._fileMap[fileName];
};

/**
 * Get a human-readable label for a collection file. If the file has a `label` property, it is used;
 * otherwise, the `name` property is used.
 * @param {InternalCollectionFile} file Collection file.
 * @returns {string} File label.
 */
export const getCollectionFileLabel = (file) => file.label || file.name;

/**
 * Get a file/singleton collection’s file configurations that matches the given entry. One file can
 * theoretically appear in multiple collections files depending on the configuration, so that the
 * result is an array.
 * @param {InternalCollection} collection Collection.
 * @param {Entry} entry Entry.
 * @returns {InternalCollectionFile[]} Collection files.
 */
export const getCollectionFilesByEntry = (collection, entry) => {
  if (!('_fileMap' in collection)) {
    // It’s an entry collection
    return [];
  }

  return Object.values(collection._fileMap).filter(
    ({ _file, _i18n }) => _file.fullPath === entry.locales[_i18n.defaultLocale]?.path,
  );
};

/**
 * Get a file/singleton collection entry that matches the given collection name and file name.
 * @param {string} collectionName Collection name.
 * @param {string} fileName Collection file name.
 * @returns {Entry | undefined} File.
 * @see https://decapcms.org/docs/collection-file/
 */
export const getCollectionFileEntry = (collectionName, fileName) =>
  get(allEntries).find((entry) =>
    getAssociatedCollections(entry).some(
      (collection) =>
        collection.name === collectionName &&
        getCollectionFilesByEntry(collection, entry).some((file) => file.name === fileName),
    ),
  );

/**
 * Get the index of a collection file with the given name.
 * @param {string | undefined} collectionName Collection name.
 * @param {string | undefined} fileName Collection file name.
 * @returns {number} Index.
 */
export const getCollectionFileIndex = (collectionName, fileName) => {
  if (collectionName && fileName) {
    const { collections, singletons } = /** @type {InternalSiteConfig} */ (get(siteConfig));

    if (collectionName === '_singletons') {
      return singletons?.findIndex(({ name }) => name === fileName) ?? -1;
    }

    return (
      collections
        .find(({ name }) => name === collectionName)
        ?.files?.findIndex(({ name }) => name === fileName) ?? -1
    );
  }

  return -1;
};
