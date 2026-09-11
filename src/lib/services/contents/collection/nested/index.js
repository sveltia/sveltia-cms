import { getPathInfo } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';

import { isEntryCollection } from '$lib/services/contents/collection';
import { EXTENSION_FORMAT_MAP, MARKDOWN_EXTENSIONS } from '$lib/services/contents/file';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { Entry, InternalCollection } from '$lib/types/private';
 * @import { Collection, EntryCollection } from '$lib/types/public';
 */

/**
 * Normalized options for a nested collection.
 * @typedef {object} NestedCollectionConfig
 * @property {number} depth Maximum number of path segments below the collection folder. Entries
 * deeper than this are not part of the collection. `Infinity` if unlimited.
 * @property {string | undefined} summary Summary template used for tree node labels, which
 * overrides the collection’s `summary` option.
 * @property {boolean} subfolders Whether each entry lives in its own subfolder as an index file. If
 * `false`, entries are regular files placed directly in the folders.
 */

/**
 * Normalized options for the `meta.path` entry path editor. The `widget` and `label` options are
 * accepted for compatibility with Netlify/Decap CMS but ignored: the editor is always a folder
 * picker with a built-in label.
 * @typedef {object} MetaPathConfig
 * @property {string | undefined} indexFileName File name, without an extension, used for every
 * entry in the collection, e.g. `_index`. If `undefined`, the entry’s own file name is used.
 */

/**
 * File names conventionally given to a folder’s own entry when the collection doesn’t configure one
 * with the `meta.path.index_file` option.
 */
export const DEFAULT_INDEX_FILE_NAMES = ['index', '_index'];

/**
 * File extensions that can be written by the CMS. Used to spot an `index_file` option that has been
 * given with an extension.
 */
const CONTENT_EXTENSIONS = [...MARKDOWN_EXTENSIONS, ...Object.keys(EXTENSION_FORMAT_MAP)];

/**
 * Normalize the `meta.path.index_file` option. The option is a file name without an extension, but
 * it’s easy to write it with one, which would otherwise save every entry as `index.md.md`.
 * @param {string | undefined} name Configured file name.
 * @returns {string | undefined} File name without an extension, or `undefined` if unusable.
 */
const normalizeIndexFileName = (name) => {
  if (typeof name !== 'string' || !name.trim()) {
    return undefined;
  }

  const path = stripSlashes(name.trim());
  const { filename, extension } = getPathInfo(path);

  return extension !== undefined && CONTENT_EXTENSIONS.includes(extension) ? filename : path;
};

/**
 * Directory path, relative to the selected collection’s folder, that the entry list is currently
 * limited to. An empty string means the collection’s root folder. Only relevant while a nested
 * collection is selected.
 * @type {{ current: string }}
 */
export const nestedFilterPath = createRawState('');

/**
 * Get the normalized options for a nested collection.
 * @param {Collection | InternalCollection} collection Collection.
 * @returns {NestedCollectionConfig | undefined} Options, or `undefined` if the collection is not a
 * nested entry collection.
 * @see https://decapcms.org/docs/collection-nested/
 */
export const getNestedConfig = (collection) => {
  const rawCollection = /** @type {Collection} */ (collection);

  if (!isEntryCollection(rawCollection)) {
    return undefined;
  }

  const { nested } = rawCollection;

  if (!nested || typeof nested !== 'object') {
    return undefined;
  }

  const { depth, summary, subfolders } = nested;

  return {
    depth: typeof depth === 'number' && depth >= 1 ? Math.floor(depth) : Infinity,
    summary: typeof summary === 'string' && !!summary.trim() ? summary : undefined,
    subfolders: subfolders !== false,
  };
};

/**
 * Check if the given collection is a nested collection.
 * @param {Collection | InternalCollection} collection Collection.
 * @returns {boolean} Result.
 */
export const isNestedCollection = (collection) => !!getNestedConfig(collection);

/**
 * Get the normalized options for the `meta.path` entry path editor, which lets the user choose
 * where an entry is stored within the collection folder. The option requires the `nested` option:
 * without it, an entry is always a direct child of the collection folder, so there is no hierarchy
 * to place it in.
 * @param {Collection | InternalCollection} collection Collection.
 * @returns {MetaPathConfig | undefined} Options, or `undefined` if the path editor is not enabled
 * for the collection.
 * @see https://decapcms.org/docs/collection-nested/
 */
export const getMetaPathConfig = (collection) => {
  if (!isNestedCollection(collection)) {
    return undefined;
  }

  const path = /** @type {EntryCollection} */ (collection).meta?.path;

  if (!path || typeof path !== 'object') {
    return undefined;
  }

  return { indexFileName: normalizeIndexFileName(path.index_file) };
};

/**
 * Get the name of the index file a nested collection stores its entries as, e.g. `_index`. Unlike
 * the `index_file` collection option, which marks one special entry within a collection, this file
 * name is meaningful throughout a nested collection: it names every entry in the `subfolders` mode,
 * and each folder’s own entry otherwise.
 * @param {Collection | InternalCollection} collection Collection.
 * @returns {string | undefined} File name without an extension, or `undefined` if the collection
 * doesn’t use one.
 */
export const getNestedIndexFileName = (collection) =>
  isNestedCollection(collection) ? getMetaPathConfig(collection)?.indexFileName : undefined;

/**
 * Get the file name that every entry in the collection is saved as, which is what makes a folder
 * itself an entry. Without the `subfolders` mode there is no such name: entries are regular files
 * that keep their own names, so an `index_file` option only says what a folder’s own entry is
 * called, and forcing it on every entry would save them all over one another.
 * @param {Collection | InternalCollection} collection Collection.
 * @returns {string | undefined} File name without an extension, or `undefined` if each entry has a
 * file name of its own.
 * @see https://github.com/decaporg/decap-cms/issues/7606
 */
export const getSharedEntryFileName = (collection) =>
  getNestedConfig(collection)?.subfolders === false
    ? undefined
    : getMetaPathConfig(collection)?.indexFileName;

/**
 * Strip the file name shared by every entry in a nested collection from the given slug, which is
 * the entry’s path within the collection folder. That name is how the content folder stores an
 * entry, not part of how the entry is referred to — in a preview URL, or in another entry’s
 * Relation field — so it’s left out of both.
 * @param {Collection | InternalCollection} collection Collection the entry belongs to.
 * @param {string} slug Entry slug.
 * @returns {string} Slug without the trailing file name. The collection’s own index file is left
 * alone, because there would be nothing left of it.
 * @see https://github.com/decaporg/decap-cms/issues/4963
 */
export const stripIndexFileName = (collection, slug) => {
  const indexFileName = getSharedEntryFileName(collection);

  return indexFileName && slug.endsWith(`/${indexFileName}`)
    ? slug.slice(0, -indexFileName.length - 1)
    : slug;
};

/**
 * Check whether the folder chosen with the path editor is what decides where an entry goes. A blank
 * folder means the entry goes where it would without the editor, so the collection’s own `path`
 * option and slug take over; clearing a folder that was set, on the other hand, deliberately moves
 * the entry up to the collection folder.
 *
 * A new entry in a collection where every entry shares one file name is the exception: the folder
 * is where the entry is created rather than the entry’s own folder, so even the collection folder
 * is a meaningful choice.
 * @param {object} draft Entry draft, or the parts of one that hold the folder.
 * @param {Collection | InternalCollection} draft.collection Collection the entry belongs to.
 * @param {boolean} [draft.isNew] Whether the entry is being created.
 * @param {string} [draft.originalPath] Folder at the time of draft creation.
 * @param {string} [draft.currentPath] Folder as edited with the path editor.
 * @returns {boolean} Whether the path editor decides the entry’s destination.
 * @see https://github.com/decaporg/decap-cms/issues/7094
 */
export const usesCustomEntryPath = ({ collection, isNew, originalPath, currentPath }) => {
  if (currentPath === undefined) {
    return false;
  }

  if (isNew && !!getSharedEntryFileName(collection)) {
    return true;
  }

  return !!stripSlashes(currentPath) || !!stripSlashes(originalPath ?? '');
};

/**
 * Get the directory path of an entry within the collection folder.
 * @param {string} subPath Entry’s sub path, which is the file path relative to the collection
 * folder, without the file extension and locale.
 * @returns {string} Directory path without leading and trailing slashes. An empty string if the
 * entry is directly in the collection folder.
 */
export const getEntryDirPath = (subPath) => {
  const index = subPath.lastIndexOf('/');

  return index === -1 ? '' : subPath.slice(0, index);
};

/**
 * Check if the given entry is stored in the given directory or one of its descendants.
 * @param {string} dirPath Directory path relative to the collection folder. An empty string matches
 * every entry.
 * @param {string} subPath Entry’s sub path.
 * @returns {boolean} Result.
 */
export const isDescendantPath = (dirPath, subPath) => !dirPath || subPath.startsWith(`${dirPath}/`);

/**
 * Check whether the given folder is part of a nested collection’s tree, which is what the folder
 * route browses. A folder is there as long as it holds an entry, directly or further down; the
 * collection’s root folder is always there, even while the collection is still empty.
 * @param {object} args Arguments.
 * @param {Collection | InternalCollection} args.collection Collection.
 * @param {Entry[]} args.entries Entries in the collection.
 * @param {string} args.dirPath Directory path relative to the collection folder. An empty string
 * for the collection’s root folder.
 * @returns {boolean} Result. Always `false` for a collection that isn’t nested, which has no
 * folders to browse.
 */
export const isNestedFolder = ({ collection, entries, dirPath }) => {
  if (!isNestedCollection(collection)) {
    return false;
  }

  const basePath = stripSlashes(dirPath);

  return !basePath || entries.some(({ subPath }) => isDescendantPath(basePath, subPath));
};

/**
 * Limit the given entries to those that should be listed while the user is browsing a folder of a
 * nested collection. Only the immediate children of the folder are listed, because the deeper
 * entries are reachable through the collection tree.
 *
 * In the default `subfolders` mode, each entry is an index file within its own folder, so an
 * immediate child is two segments below the current folder, e.g. `about/_index` below the root. The
 * collection’s own index file, e.g. `_index` at the root, is listed as well, because there is no
 * other place to reach it from.
 * @param {object} args Arguments.
 * @param {Collection | InternalCollection} args.collection Collection.
 * @param {Entry[]} args.entries Entries in the collection.
 * @param {string} args.dirPath Directory path relative to the collection folder. An empty string
 * for the collection’s root folder.
 * @returns {Entry[]} Filtered entries. The given entries are returned as is if the collection is
 * not a nested collection.
 */
export const filterNestedEntries = ({ collection, entries, dirPath }) => {
  const config = getNestedConfig(collection);

  if (!config) {
    return entries;
  }

  const { subfolders } = config;
  const basePath = stripSlashes(dirPath);

  return entries.filter(({ subPath }) => {
    if (!isDescendantPath(basePath, subPath)) {
      return false;
    }

    const restPath = basePath ? subPath.slice(basePath.length + 1) : subPath;
    const depth = restPath.split('/').length;

    if (subfolders) {
      // At the root, also list the collection’s own index file, which has no folder of its own
      return basePath ? depth === 2 : depth <= 2;
    }

    return depth === 1;
  });
};
