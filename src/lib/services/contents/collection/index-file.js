import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { isEntryCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';

/**
 * @import { Entry, InternalCollection } from '$lib/types/private';
 * @import { Collection, CollectionIndexFile } from '$lib/types/public';
 */

/**
 * Get the localized label for the index file. Use `try-catch` to handle cases where svelte-i18n is
 * not initialized during automated tests.
 * @returns {string} Localized label for the index file.
 */
const getLocalizedLabel = () => {
  try {
    return get(_)('index_file');
  } catch {
    return 'Index File';
  }
};

/**
 * Get the collection’s index file configuration. This function returns the index file configuration
 * if index file inclusion is enabled for the collection. If no specific configuration is provided,
 * it returns a default configuration with the `_index` file name, which is used for Hugo’s special
 * index file.
 * @param {InternalCollection | Collection} collection Collection.
 * @returns {CollectionIndexFile | undefined} Index file configuration if index file inclusion is
 * enabled for the collection, otherwise `undefined`.
 * @see https://gohugo.io/content-management/organization/#index-pages-_indexmd
 * @see https://github.com/decaporg/decap-cms/issues/7381
 * @see https://github.com/sveltia/sveltia-cms#including-hugos-special-index-file-in-a-folder-collection
 */
export const getIndexFile = (collection) => {
  const { index_file: indexFile } = collection;

  if (!isEntryCollection(collection) || !indexFile) {
    return undefined;
  }

  const file = indexFile === true ? {} : indexFile;

  return {
    name: file.name ?? '_index',
    label: file.label ?? getLocalizedLabel(),
    icon: file.icon ?? 'home',
    // The following properties are inherited from the collection file, collection or global config
    fields: file.fields,
    editor: file.editor,
  };
};

/**
 * Check if index file inclusion (for Hugo) is enabled for the collection, and the given entry is
 * the special index file.
 * @param {InternalCollection} collection Collection.
 * @param {Entry} entry Entry.
 * @returns {boolean} Result.
 */
export const isCollectionIndexFile = (collection, entry) => {
  const indexFile = getIndexFile(collection);

  if (!indexFile) {
    return false;
  }

  return entry.slug === indexFile.name;
};

/**
 * Check if index file creation is allowed in the collection.
 * @param {InternalCollection} collection Collection.
 * @returns {boolean} Result. It returns `false` if the index file already exists.
 */
export const canCreateIndexFile = (collection) => {
  const indexFile = getIndexFile(collection);

  if (!indexFile) {
    return false;
  }

  return !getEntriesByCollection(collection.name).some(({ slug }) => slug === indexFile.name);
};
