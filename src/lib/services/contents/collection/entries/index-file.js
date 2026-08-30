import { _, locale as appLocale } from '@sveltia/i18n';

import { isEntryCollection } from '$lib/services/contents/collection';

/**
 * @import { Entry, InternalCollection } from '$lib/types/private';
 * @import { Collection, CollectionIndexFile } from '$lib/types/public';
 */

/**
 * Default name of Hugo’s special index file, used when the collection doesn’t specify one.
 */
const DEFAULT_INDEX_FILE_NAME = '_index';
/**
 * Cache of index file configurations, keyed by the collection object. `getCollection()` returns a
 * stable object per collection, so this is effectively per collection for the session.
 * @type {WeakMap<InternalCollection | Collection, { locale: string | undefined, indexFile:
 * CollectionIndexFile | undefined }>}
 */
const indexFileCacheMap = new WeakMap();

/**
 * Get the name of the collection’s index file, without building the full configuration object. This
 * is the cheap path for {@link isCollectionIndexFile}, which is called once per entry in several
 * list-wide operations.
 * @param {InternalCollection | Collection} collection Collection.
 * @returns {string | undefined} Index file name, or `undefined` if index file inclusion is not
 * enabled for the collection.
 */
const getIndexFileName = (collection) => {
  if (!isEntryCollection(collection)) {
    return undefined;
  }

  const { index_file: indexFile } = collection;

  if (!indexFile) {
    return undefined;
  }

  return (indexFile === true ? undefined : indexFile.name) ?? DEFAULT_INDEX_FILE_NAME;
};

/**
 * Get the collection’s index file configuration. This function returns the index file configuration
 * if index file inclusion is enabled for the collection. If no specific configuration is provided,
 * it returns a default configuration with the `_index` file name, which is used for Hugo’s special
 * index file.
 *
 * The result is cached per collection, because the default label is localized and looking it up —
 * along with allocating a fresh object — on every call adds up in the entry list and the editor.
 * @param {InternalCollection | Collection} collection Collection.
 * @returns {CollectionIndexFile | undefined} Index file configuration if index file inclusion is
 * enabled for the collection, otherwise `undefined`.
 * @see https://gohugo.io/content-management/organization/#index-pages-_indexmd
 * @see https://github.com/decaporg/decap-cms/issues/7381
 * @see https://sveltiacms.app/en/docs/collections/entries#managing-hugo-s-special-index-file
 */
export const getIndexFile = (collection) => {
  const cached = indexFileCacheMap.get(collection);

  // The default label is translated, so a cached entry is only valid for the app locale it was
  // built with
  if (cached && cached.locale === appLocale.current) {
    return cached.indexFile;
  }

  const name = getIndexFileName(collection);
  /** @type {CollectionIndexFile | undefined} */
  let indexFile;

  if (name !== undefined) {
    const { index_file: config } = /** @type {any} */ (collection);
    const file = config === true ? {} : config;

    indexFile = {
      name,
      label: file.label || _('index_file'),
      icon: file.icon ?? 'home',
      // The following properties are inherited from the collection file, collection or global
      // config
      fields: file.fields,
      editor: file.editor,
    };
  }

  indexFileCacheMap.set(collection, { locale: appLocale.current, indexFile });

  return indexFile;
};

/**
 * Check if index file inclusion (for Hugo) is enabled for the collection, and the given entry is
 * the special index file.
 * @param {InternalCollection} collection Collection.
 * @param {Entry} entry Entry.
 * @returns {boolean} Result.
 */
export const isCollectionIndexFile = (collection, entry) => {
  const name = getIndexFileName(collection);

  return name !== undefined && entry.slug === name;
};
