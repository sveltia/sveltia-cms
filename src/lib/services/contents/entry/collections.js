import { allEntryFolders } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getEntryFoldersByPath } from '$lib/services/contents/folders';

/**
 * @import { Entry, EntryFolderInfo, InternalCollection } from '$lib/types/private';
 */

/**
 * Cache of {@link getEntryFolders} results, dropped whenever `allEntryFolders` changes. The lookup
 * tests the entry’s path against every entry collection’s folder and sorts the matches, and it’s
 * repeated for every entry on each search keystroke, asset reference scan and so on. An entry is
 * replaced rather than modified when its files change, so its object is a safe key.
 */
const entryFoldersCache = {
  source: /** @type {EntryFolderInfo[] | undefined} */ (undefined),
  /** @type {WeakMap<Entry, EntryFolderInfo[]>} */
  map: new WeakMap(),
};

/**
 * Get the collection entry folders matching the given entry’s path.
 * @param {Entry} entry Entry.
 * @returns {EntryFolderInfo[]} Entry folders.
 */
const getEntryFolders = (entry) => {
  const source = allEntryFolders.current;

  if (source !== entryFoldersCache.source) {
    entryFoldersCache.source = source;
    entryFoldersCache.map = new WeakMap();
  }

  let folders = entryFoldersCache.map.get(entry);

  if (!folders) {
    folders = getEntryFoldersByPath(Object.values(entry.locales)[0].path);
    entryFoldersCache.map.set(entry, folders);
  }

  return folders;
};

/**
 * Get a list of collections the given entry belongs to. One entry can theoretically appear in
 * multiple collections depending on the configuration, so that the result is an array.
 * @param {Entry} entry Entry.
 * @returns {InternalCollection[]} Collections.
 */
export const getAssociatedCollections = (entry) =>
  getEntryFolders(entry)
    .map(({ collectionName }) => getCollection(collectionName))
    .filter((collection) => !!collection);
