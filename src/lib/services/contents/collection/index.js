import { stripSlashes } from '@sveltia/utils/string';
import { get, writable } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { siteConfig } from '$lib/services/config';
import {
  getValidCollectionFiles,
  isValidCollectionFile,
} from '$lib/services/contents/collection/files';
import { getFileConfig } from '$lib/services/contents/file';
import { normalizeI18nConfig } from '$lib/services/contents/i18n/config';

/**
 * @import { Writable } from 'svelte/store';
 * @import {
 * CollectionType,
 * EntryCollection,
 * FileCollection,
 * InternalCollection,
 * InternalI18nOptions,
 * } from '$lib/types/private';
 * @import { Collection, CollectionDivider, CollectionFile, FieldKeyPath } from '$lib/types/public';
 */

/**
 * @type {Writable<InternalCollection | undefined>}
 */
export const selectedCollection = writable();

/**
 * @type {Map<string, InternalCollection | undefined>}
 */
export const collectionCacheMap = new Map();

/**
 * Check if the given collection is an entry collection. An entry collection is defined as one that
 * has the `folder` property that is a string and does not have the `files` property.
 * @param {Collection} collection Collection definition.
 * @returns {boolean} Whether the collection is an entry collection.
 */
export const isEntryCollection = (collection) =>
  typeof collection.folder === 'string' && !Array.isArray(collection.files);

/**
 * Check if the given collection is a file collection. A file collection is defined as one that has
 * the `files` property that is an array and does not have the `folder` property.
 * @param {Collection} collection Collection definition.
 * @returns {boolean} Whether the collection is a file collection.
 */
export const isFileCollection = (collection) =>
  collection.folder === undefined && Array.isArray(collection.files);

/**
 * Check if the given collection is a singleton collection. A singleton collection is a special type
 * of file collection that has the name `_singletons`.
 * @param {Collection} collection Collection definition.
 * @returns {boolean} Whether the collection is a singleton collection.
 */
export const isSingletonCollection = (collection) =>
  isFileCollection(collection) && collection.name === '_singletons';

/**
 * Check if the given collection is a valid entry or file collection. A valid collection must have a
 * `folder` property for entry collections or a `files` property for file collections. It must not
 * be a divider.
 * @param {Collection | CollectionDivider} collection Collection definition or divider.
 * @param {object} [options] Filter options.
 * @param {boolean} [options.visible] Whether to filter out hidden collections. Defaults to `false`.
 * @param {CollectionType} [options.type] Type of collections to filter by. If provided, only
 * collections of this type will be returned.
 * @returns {boolean} Whether the collection is valid.
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
 * Get a list of valid collections from the given collection definitions. This filters out dividers
 * and invalid collections that do not have a `folder` property for entry collections or a `files`
 * property for file collections.
 * @param {object} [options] Options.
 * @param {(Collection | CollectionDivider)[]} [options.collections] Collection definitions. May
 * include dividers. Defaults to the collections defined in the site configuration.
 * @param {boolean} [options.visible] Whether to filter out hidden collections. Defaults to `false`.
 * @param {CollectionType} [options.type] Type of collections to filter by. If provided, only
 * collections of this type will be returned.
 * @returns {Collection[]} List of valid collections.
 */
export const getValidCollections = ({
  collections = get(siteConfig)?.collections ?? [],
  visible,
  type,
} = {}) =>
  /** @type {Collection[]} */ (
    collections.filter((collection) => isValidCollection(collection, { visible, type }))
  );

/**
 * Get the first visible entry collection or file collection in the collection list.
 * @returns {Collection | undefined} Found collection.
 */
export const getFirstCollection = () => getValidCollections({ visible: true })[0];

/**
 * Get a list of field key paths to be used to find an entry thumbnail.
 * @param {Collection} rawCollection Raw collection definition.
 * @returns {FieldKeyPath[]} Key path list.
 */
const getThumbnailFieldNames = (rawCollection) => {
  const { folder, fields, thumbnail } = rawCollection;

  if (!folder) {
    return [];
  }

  if (typeof thumbnail === 'string') {
    return [thumbnail];
  }

  // Support multiple field names
  if (Array.isArray(thumbnail)) {
    return thumbnail;
  }

  // Collect the names of all non-nested Image/File fields for inference
  if (fields?.length) {
    return fields
      .filter(({ widget = 'string' }) => ['image', 'file'].includes(widget))
      .map(({ name }) => name);
  }

  return [];
};

/**
 * Parse an entry collection and add additional properties.
 * @param {Collection} rawCollection Raw collection definition.
 * @param {InternalI18nOptions} _i18n I18n options of the collection.
 * @returns {EntryCollection} Parsed entry collection with additional properties.
 */
const parseEntryCollection = (rawCollection, _i18n) => ({
  ...rawCollection,
  _i18n,
  _type: 'entry',
  _file: getFileConfig({ rawCollection, _i18n }),
  _thumbnailFieldNames: getThumbnailFieldNames(rawCollection),
});

/**
 * Parse a file/singleton collection and add additional properties.
 * @param {Collection} rawCollection Raw collection definition.
 * @param {InternalI18nOptions} _i18n I18n options of the collection.
 * @param {CollectionFile[]} files List of files in the collection.
 * @returns {FileCollection} Parsed file/singleton collection with additional properties.
 */
const parseFileCollection = (rawCollection, _i18n, files) => ({
  ...rawCollection,
  _i18n,
  _type: isSingletonCollection(rawCollection) ? 'singleton' : 'file',
  _fileMap: Object.fromEntries(
    files.filter(isValidCollectionFile).map((file) => {
      const __i18n = normalizeI18nConfig(rawCollection, file);
      const __file = getFileConfig({ rawCollection, file, _i18n: __i18n });

      return [file.name, { ...file, _file: __file, _i18n: __i18n }];
    }),
  ),
});

/**
 * Get the pseudo singleton file collection. This is a collection that contains all singleton files
 * defined in the site configuration. It is used to handle singletons as a collection, allowing for
 * easier access and management.
 * @returns {InternalCollection | undefined} Singleton collection, or `undefined` if no singletons
 * are defined.
 */
export const getSingletonCollection = () => {
  const singletons = get(siteConfig)?.singletons;

  if (!Array.isArray(singletons)) {
    return undefined;
  }

  const files = getValidCollectionFiles(singletons) //
    .map((file) => ({ ...file, file: stripSlashes(file.file) }));

  if (!files.length) {
    return undefined;
  }

  /** @type {Collection} */
  const rawCollection = { name: '_singletons', files };
  const _i18n = normalizeI18nConfig(rawCollection);

  return parseFileCollection(rawCollection, _i18n, files);
};

/**
 * Get a collection by name.
 * @param {string} name Collection name.
 * @returns {InternalCollection | undefined} Collection, including some extra, normalized
 * properties.
 */
export const getCollection = (name) => {
  const cache = collectionCacheMap.get(name);

  if (cache) {
    return cache;
  }

  if (name === '_singletons') {
    const collection = getSingletonCollection();

    collectionCacheMap.set(name, collection);

    return collection;
  }

  const rawCollection = getValidCollections().find((c) => c.name === name);
  const _isEntryCollection = rawCollection ? isEntryCollection(rawCollection) : false;
  const _isFileCollection = rawCollection ? isFileCollection(rawCollection) : false;

  // Ignore invalid collection
  if (!rawCollection || (!_isEntryCollection && !_isFileCollection)) {
    collectionCacheMap.set(name, undefined);

    return undefined;
  }

  const { folder, files = [] } = rawCollection;

  // Normalize folder/file paths by removing leading/trailing slashes
  if (_isEntryCollection) {
    rawCollection.folder = stripSlashes(/** @type {string} */ (folder));
  } else {
    files.forEach((f) => {
      if (f.file) {
        f.file = stripSlashes(f.file);
      }
    });
  }

  const _i18n = normalizeI18nConfig(rawCollection);

  const collection = _isEntryCollection
    ? parseEntryCollection(rawCollection, _i18n)
    : parseFileCollection(rawCollection, _i18n, files);

  collectionCacheMap.set(name, collection);

  return collection;
};

/**
 * Get the label for a collection. If the collection is a singleton, it returns a localized label
 * for files. Otherwise, it returns the collection’s label or name.
 * @param {InternalCollection} collection Collection object.
 * @param {object} [options] Options for label formatting.
 * @param {boolean} [options.useSingular] Whether to use a singular form of the label.
 * @returns {string} Human-readable label for the collection.
 */
export const getCollectionLabel = (collection, { useSingular = false } = {}) => {
  const { _type, name, label, label_singular: singularLabel } = collection;

  if (_type === 'singleton') {
    return get(_)('files');
  }

  if (useSingular && singularLabel) {
    return singularLabel;
  }

  return label || name;
};

/**
 * Get the index of a collection with the given name.
 * @param {string | undefined} collectionName Collection name.
 * @returns {number} Index.
 */
export const getCollectionIndex = (collectionName) => {
  if (!collectionName) {
    return -1;
  }

  // Singleton collection is always at the end
  if (collectionName === '_singletons') {
    return 9999999;
  }

  return get(siteConfig)?.collections.findIndex(({ name }) => name === collectionName) ?? -1;
};
