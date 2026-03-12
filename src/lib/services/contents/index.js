import { get, writable } from 'svelte/store';

import { getCollection } from '$lib/services/contents/collection';

/**
 * @import { Writable } from 'svelte/store';
 * @import { Entry, EntryFolderInfo, InternalEntryCollection } from '$lib/types/private';
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
 * Cache for {@link getEntryFoldersByPath} to avoid rescanning `allEntryFolders` on every call.
 * `fileMap`: maps each locale-specific file path to the matching `EntryFolderInfo` objects
 * (file/singleton collections). Provides O(1) lookup instead of O(n×m) linear scan.
 * `regexFolders`: entry collections that use `fullPathRegEx`; regex is pre-fetched once.
 */
const entryFoldersByPathCache = {
  source: /** @type {EntryFolderInfo[] | undefined} */ (undefined),
  /** @type {Map<string, EntryFolderInfo[]>} */
  fileMap: new Map(),
  /** @type {Array<[EntryFolderInfo, RegExp | undefined]>} */
  regexFolders: [],
};

/**
 * Rebuild {@link entryFoldersByPathCache} when `allEntryFolders` changes.
 * @returns {typeof entryFoldersByPathCache} Cache object.
 */
const getEntryFolderCache = () => {
  const _allEntryFolders = get(allEntryFolders);

  if (_allEntryFolders === entryFoldersByPathCache.source) {
    return entryFoldersByPathCache;
  }

  /** @type {Map<string, EntryFolderInfo[]>} */
  const fileMap = new Map();
  /** @type {Array<[EntryFolderInfo, RegExp | undefined]>} */
  const regexFolders = [];

  _allEntryFolders.forEach((folder) => {
    if (folder.filePathMap) {
      // Pre-index every locale-specific path so lookups are O(1).
      // Deduplicate paths first: multiple locales can share the same physical file path, and
      // we only want the folder to appear once per path in the results.
      [...new Set(Object.values(folder.filePathMap))].forEach((filePath) => {
        const arr = fileMap.get(filePath);

        if (arr) {
          arr.push(folder);
        } else {
          fileMap.set(filePath, [folder]);
        }
      });
    } else {
      // Pre-fetch the regex so we avoid calling getCollection() per path per call
      regexFolders.push([
        folder,
        /** @type {InternalEntryCollection} */ (getCollection(folder.collectionName))?._file
          ?.fullPathRegEx,
      ]);
    }
  });

  entryFoldersByPathCache.source = _allEntryFolders;
  entryFoldersByPathCache.fileMap = fileMap;
  entryFoldersByPathCache.regexFolders = regexFolders;

  return entryFoldersByPathCache;
};

/**
 * Get collection entry folders that match the given path.
 * @param {string} path Entry path.
 * @returns {EntryFolderInfo[]} Entry folders. Sometimes it’s hard to find the right folder because
 * multiple collections can have the same folder or partially overlapping folder paths, but the
 * first one is most likely what you need.
 */
export const getEntryFoldersByPath = (path) => {
  const { fileMap, regexFolders } = getEntryFolderCache();

  const results = [
    ...(fileMap.get(path) ?? []),
    ...regexFolders.filter(([, regex]) => regex?.test(path)).map(([folder]) => folder),
  ];

  return results.sort((a, b) => (b.folderPath ?? '').localeCompare(a.folderPath ?? ''));
};
