import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';

/**
 * @import { Entry, InternalCollection } from '$lib/types/private';
 */

/**
 * Get the collection’s index file name.
 * @param {InternalCollection} collection Collection.
 * @returns {string | undefined} File name if index file inclusion is enabled. Defaults to `_index`.
 * Otherwise `undefined`.
 */
export const getIndexFileName = (collection) => {
  const { _type, index_file: indexFile } = collection;

  if (_type === 'entry' && indexFile) {
    return indexFile.name ?? '_index';
  }

  return undefined;
};

/**
 * Get the collection’s index file label.
 * @param {InternalCollection} collection Collection.
 * @returns {string} Label for the index file. Defaults to Index File or its localized version.
 */
export const getIndexFileLabel = (collection) =>
  collection.index_file?.label ?? get(_)('index_file');

/**
 * Get the collection’s index file icon.
 * @param {InternalCollection} collection Collection.
 * @returns {string} Material Symbols icon name for the index file. Defaults to `home`.
 */
export const getIndexFileIcon = (collection) => collection.index_file?.icon ?? 'home';

/**
 * Check if index file inclusion (for Hugo) is enabled for the collection, and the given entry is
 * the special index file.
 * @param {InternalCollection} collection Collection.
 * @param {Entry} entry Entry.
 * @returns {boolean} Result.
 * @see https://gohugo.io/content-management/organization/#index-pages-_indexmd
 * @see https://github.com/decaporg/decap-cms/issues/7381
 */
export const isCollectionIndexFile = (collection, entry) => {
  const name = getIndexFileName(collection);

  return !!name && entry.slug === name;
};

/**
 * Check if index file creation is allowed in the collection.
 * @param {InternalCollection} collection Collection.
 * @returns {boolean} Result. It returns `false` if the index file already exists.
 */
export const canCreateIndexFile = (collection) => {
  const name = getIndexFileName(collection);

  return !!name && !getEntriesByCollection(collection.name).some(({ slug }) => slug === name);
};
