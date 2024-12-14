import { get, writable } from 'svelte/store';
import { getCollection } from '$lib/services/contents/collection';

/**
 * @type {import('svelte/store').Writable<boolean>}
 */
export const dataLoaded = writable(false);
/**
 * @type {import('svelte/store').Writable<number | undefined>}
 */
export const dataLoadedProgress = writable();
/**
 * @type {import('svelte/store').Writable<CollectionEntryFolder[]>}
 */
export const allEntryFolders = writable([]);
/**
 * @type {import('svelte/store').Writable<Entry[]>}
 */
export const allEntries = writable([]);
/**
 * @type {import('svelte/store').Writable<Error[]>}
 */
export const entryParseErrors = writable([]);

/**
 * Get collection entry folders that match the given path.
 * @param {string} path - Entry path.
 * @returns {CollectionEntryFolder[]} Entry folders. Sometimes it’s hard to find the right folder
 * because multiple collections can have the same folder or partially overlapping folder paths, but
 * the first one is most likely what you need.
 */
export const getEntryFoldersByPath = (path) =>
  get(allEntryFolders)
    .filter(({ collectionName, filePathMap }) => {
      if (filePathMap) {
        return Object.values(filePathMap).includes(path);
      }

      return /** @type {EntryCollection} */ (
        getCollection(collectionName)
      )?._file?.fullPathRegEx?.test(path);
    })
    .sort((a, b) => b.folderPath?.localeCompare(a.folderPath ?? '') ?? 0);
