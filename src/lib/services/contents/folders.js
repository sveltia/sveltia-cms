import { allEntryFolders } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getOrCreate, memoizeOnSource } from '$lib/services/utils/cache';

/**
 * @import { EntryFolderInfo, InternalEntryCollection } from '$lib/types/private';
 */

/**
 * Index of `allEntryFolders` for {@link getEntryFoldersByPath} to avoid rescanning it on every
 * call, rebuilt when the store is replaced.
 * `fileMap`: maps each locale-specific file path to the matching `EntryFolderInfo` objects
 * (file/singleton collections). Provides O(1) lookup instead of O(n×m) linear scan.
 * `regexFolders`: entry collections that use `fullPathRegEx`; regex is pre-fetched once.
 * @type {() => {
 * fileMap: Map<string, EntryFolderInfo[]>,
 * regexFolders: Array<[EntryFolderInfo, RegExp | undefined]>,
 * }}
 */
const getEntryFolderCache = memoizeOnSource(
  () => allEntryFolders.current,
  (_allEntryFolders) => {
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
          getOrCreate(fileMap, filePath, () => []).push(folder);
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

    return { fileMap, regexFolders };
  },
);

/**
 * Get collection entry folders that match the given path.
 * @param {string} path Entry path.
 * @returns {EntryFolderInfo[]} Entry folders. Sometimes it’s hard to find the right folder because
 * multiple collections can have the same folder or partially overlapping folder paths, but the
 * first one is most likely what you need.
 */
export const getEntryFoldersByPath = (path) => {
  const { fileMap, regexFolders } = getEntryFolderCache();

  return [
    // A file/singleton collection declares the exact path, so it’s always more specific than an
    // entry collection, whose folder may happen to contain the same file. This notably applies to
    // Hugo’s special index file: `content/blog/_index.md` can be declared as a file collection item
    // while `content/blog` is also an entry collection’s folder
    ...(fileMap.get(path) ?? []),
    // Deeper folder paths are more specific, so sort them in descending order
    ...regexFolders
      .filter(([, regex]) => regex?.test(path))
      .map(([folder]) => folder)
      .sort((a, b) => (b.folderPath ?? '').localeCompare(a.folderPath ?? '')),
  ];
};
