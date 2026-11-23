import { getPathInfo } from '@sveltia/utils/file';

import { getCollection } from '$lib/services/contents/collection';
import { getSharedEntryFileName } from '$lib/services/contents/collection/nested';
import { getEntryLocaleFile } from '$lib/services/contents/entry/paths';
import { getBaseName, getDirName } from '$lib/services/utils/file';

/**
 * @import {
 * Entry,
 * InternalCollection,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * LocalizedEntry,
 * } from '$lib/types/private';
 */

/**
 * Regex to extract the folder path from an entry file path. For example, it extracts `blog/post`
 * from `blog/post.md` or `blog/post/index.md`.
 * @type {RegExp}
 */
const FOLDER_PATH_REGEX = /(?<path>.+?)(?:\/[^/]+)?$/;

/**
 * Check whether an entry file is the index file that every entry in a collection with nested
 * entries is stored as, which makes the folder holding it the entry’s own.
 * @param {string} filePath Entry file path without its extension.
 * @param {string | undefined} indexFileName Shared index file name, if the collection has one.
 * @returns {boolean} Result.
 */
const isSharedIndexFile = (filePath, indexFileName) => {
  if (!indexFileName) {
    return false;
  }

  const fileName = getBaseName(filePath);

  // The `multiple_files` i18n structure appends the locale to the file name, e.g. `_index.en`
  return fileName === indexFileName || fileName.startsWith(`${indexFileName}.`);
};

/*
 * The rules here decide where an entry’s relative assets are stored, so the code that saves them
 * and the code that finds them for a stored field value have to share them.
 */

/**
 * Get the path of the folder an entry occupies, which holds the entry’s relative assets along with
 * anything else stored below it. Only some file structures give an entry a folder of its own; in
 * the others, an entry is a file sharing a folder with the rest of the collection, so its relative
 * assets are shared as well.
 * @param {InternalCollection} collection Collection the entry belongs to.
 * @param {string} entryFilePath Entry file path, e.g. `content/blog/hello-world/index.md`.
 * @returns {string | undefined} Folder path, e.g. `content/blog/hello-world`. `undefined` if the
 * entry has no folder of its own.
 * @example
 * // A `path` option ending in a fixed file name gives the entry a folder
 * getOwnedEntryFolderPath(collection, 'content/blog/hello-world/index.md') // `{{slug}}/index`
 * // => 'content/blog/hello-world'
 * @example
 * // Every entry in a collection with nested entries is an index file, with or without a `path`
 * // option, e.g. `index_file: _index`
 * getOwnedEntryFolderPath(collection, 'content/pages/about/_index.md')
 * // => 'content/pages/about'
 * @example
 * // The slug is the last segment here, so the entry file sits next to the folder named after it
 * // with a `{{year}}/{{month}}/{{slug}}` path option
 * getOwnedEntryFolderPath(collection, 'content/blog/2025/06/hello-world.md')
 * // => 'content/blog/2025/06/hello-world'
 * @example
 * // A plain file collection shares one folder, so there’s nothing the entry owns
 * getOwnedEntryFolderPath(collection, 'content/blog/hello-world.md') // no `path` option
 * // => undefined
 */
export const getOwnedEntryFolderPath = (collection, entryFilePath) => {
  if (collection._type !== 'entry') {
    return undefined;
  }

  const { subPath } = /** @type {InternalEntryCollection} */ (collection)._file;
  // Remove the file extension, which is always present
  const filePath = entryFilePath.substring(0, entryFilePath.lastIndexOf('.'));
  const lastSubPathSegment = subPath?.includes('/') ? getBaseName(subPath) : undefined;

  // The entry file has a fixed name within the folder holding it, either because the `path` option
  // ends in one, or because the collection stores every entry as an index file. Either way the
  // folder is the entry, so strip the file name off
  if (
    (!!lastSubPathSegment && !lastSubPathSegment.includes('{{')) ||
    isSharedIndexFile(filePath, getSharedEntryFileName(collection))
  ) {
    return /** @type {string} */ (filePath.match(FOLDER_PATH_REGEX)?.groups?.path);
  }

  // The `path` option puts the entry in a folder of its own, such as `{{year}}/{{month}}/{{slug}}`,
  // and the entry file is named after the slug, so a folder of the same name sits next to it. A
  // locale folder doesn’t count: it holds every entry of that locale, not this one
  if (subPath?.includes('/')) {
    return filePath;
  }

  return undefined;
};

/**
 * Get the folder that holds an entry’s relative assets: the folder the entry occupies if it has one
 * of its own, and otherwise the folder its file is stored in, which it shares with the rest of the
 * collection. With a `multiple_folders` i18n structure that shared folder is the locale’s own, so
 * the assets sit beside the entry either way.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {string} args.entryFilePath Entry file path.
 * @param {string} args.internalPath Internal path from folder config.
 * @returns {string} Folder path.
 */
export const getEntryAssetFolderPath = ({ collection, entryFilePath, internalPath }) =>
  getOwnedEntryFolderPath(collection, entryFilePath) ??
  // A file collection has no folder of its own to fall back on
  (collection._type === 'entry'
    ? (getPathInfo(entryFilePath).dirname ?? internalPath)
    : internalPath);

/**
 * Get the folder that holds the relative assets of an existing entry, like
 * {@link getEntryAssetFolderPath} does when they are saved, so an asset is listed, referenced and
 * found in the same place it’s stored.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry.
 * @param {InternalLocaleCode} [args.locale] Locale whose entry file is used. With the
 * `multiple_folders` or `multiple_root_folders` i18n structure, each locale’s file has a folder of
 * its own. Default: the entry’s first locale.
 * @param {string} [args.collectionName] Name of the collection the asset folder belongs to. Without
 * it, or for a collection that can’t be found, the folder of the entry file is used.
 * @returns {string} Folder path, or an empty string for an entry file at the repository root.
 */
export const getExistingEntryAssetFolderPath = ({ entry, locale, collectionName }) => {
  const entryFilePath = /** @type {LocalizedEntry} */ (getEntryLocaleFile(entry, { locale })).path;
  const entryFolderPath = getDirName(entryFilePath);
  const collection = collectionName ? getCollection(collectionName) : undefined;

  return collection
    ? getEntryAssetFolderPath({ collection, entryFilePath, internalPath: entryFolderPath })
    : entryFolderPath;
};
