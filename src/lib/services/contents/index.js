import { get, writable } from 'svelte/store';
import { getCollection } from '$lib/services/contents/collection';

/**
 * @import { Writable } from 'svelte/store';
 * @import { Entry, EntryCollection, EntryFolderInfo } from '$lib/types/private';
 */

/**
 * @type {Writable<boolean>}
 */
export const dataLoaded = writable(false);
/**
 * @type {Writable<number | undefined>}
 */
export const dataLoadedProgress = writable();
/**
 * @type {Writable<EntryFolderInfo[]>}
 */
export const allEntryFolders = writable([]);
/**
 * @type {Writable<Entry[]>}
 */
export const allEntries = writable([]);
/**
 * @type {Writable<Error[]>}
 */
export const entryParseErrors = writable([]);

/**
 * Get collection entry folders that match the given path.
 * @param {string} path Entry path.
 * @returns {EntryFolderInfo[]} Entry folders. Sometimes it’s hard to find the right folder because
 * multiple collections can have the same folder or partially overlapping folder paths, but the
 * first one is most likely what you need.
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
