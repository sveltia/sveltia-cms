import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { getEntryPaths } from '$lib/services/contents/entry/paths';

/**
 * @import { BaseEntryListItem, Entry, EntryFolderInfo } from '$lib/types/private';
 */

/**
 * Check whether the files of the given collection can be merged into one entry, which is the case
 * with a multi-file i18n structure: the localized files of an entry are grouped by their slug or
 * canonical slug, so a change to one file can move another one to a different entry.
 * @param {EntryFolderInfo} folder Entry folder of a file.
 * @returns {boolean} Result.
 */
export const canMergeFiles = ({ collectionName, fileName }) => {
  const collection = getCollection(collectionName);

  const collectionFile =
    collection && fileName ? getCollectionFile(collection, fileName) : undefined;

  const { structureMap } = (collectionFile ?? collection)?._i18n ?? {};

  return !!(
    structureMap?.i18nMultiFile ||
    structureMap?.i18nMultiFolder ||
    structureMap?.i18nMultiRootFolder
  );
};

/**
 * Work out which of the entries already in the store can stand for the given files as they are, so
 * that a fetch made after the initial load only parses the files that have changed. Parsing every
 * entry again would give the same result for the rest, which `reconcileEntries()` would then throw
 * away in favour of the previous objects anyway.
 *
 * A file is only covered by a previous entry if neither it nor any other file of that entry has
 * changed or gone, and no other previous entry claims it. A file that previously made no entry,
 * e.g. one that failed to parse, is parsed again, so its error is reported again. With a multi-file
 * i18n structure, a new, changed or removed file can regroup the other files of its collection, so
 * the whole collection is parsed again unless every one of its files is covered.
 * @param {object} args Arguments.
 * @param {BaseEntryListItem[]} args.entryFiles Entry files in the latest file list.
 * @param {Entry[]} args.previous Entries in the store at the moment.
 * @param {Set<string>} args.changedPaths Paths of the files whose content differs from what was
 * fetched last time.
 * @returns {{ reusedEntries: Map<string, Entry>, dirtyFiles: BaseEntryListItem[] }} Previous
 * entries to keep, keyed with each of their file paths, and the files to parse.
 */
export const planEntryReparse = ({ entryFiles, previous, changedPaths }) => {
  const currentPaths = new Set(entryFiles.map(({ path }) => path));
  /** @type {Map<string, Entry>} */
  const previousByPath = new Map();
  /** @type {Set<string>} */
  const sharedPaths = new Set();

  previous.forEach((entry) => {
    getEntryPaths(entry).forEach((path) => {
      if (previousByPath.has(path)) {
        sharedPaths.add(path);
      }

      previousByPath.set(path, entry);
    });
  });

  /**
   * Find the previous entry that can stand for the given file.
   * @param {BaseEntryListItem} file File.
   * @param {boolean} mergeable Whether the file can be merged with other files into one entry.
   * @returns {Entry | undefined} Entry.
   */
  const getReusableEntry = ({ path }, mergeable) => {
    const entry = previousByPath.get(path);

    if (!entry || changedPaths.has(path) || sharedPaths.has(path)) {
      return undefined;
    }

    const paths = getEntryPaths(entry);

    // Without merging, an entry is made of its own file only
    if (!mergeable && (paths.length !== 1 || paths[0] !== path)) {
      return undefined;
    }

    const intact = paths.every(
      (_path) => currentPaths.has(_path) && !changedPaths.has(_path) && !sharedPaths.has(_path),
    );

    return intact ? entry : undefined;
  };

  /** @type {Map<string, Entry>} */
  const reusedEntries = new Map();
  /** @type {BaseEntryListItem[]} */
  const dirtyFiles = [];
  /** @type {Map<string, boolean>} */
  const mergeableCache = new Map();
  /** @type {Map<string, { file: BaseEntryListItem, entry: Entry | undefined }[]>} */
  const mergeableGroups = new Map();

  entryFiles.forEach((file) => {
    const { collectionName, fileName } = file.folder;
    const cacheKey = `${collectionName}\n${fileName ?? ''}`;
    let mergeable = mergeableCache.get(cacheKey);

    if (mergeable === undefined) {
      mergeable = canMergeFiles(file.folder);
      mergeableCache.set(cacheKey, mergeable);
    }

    const entry = getReusableEntry(file, mergeable);

    if (mergeable) {
      // Files are grouped within a collection, so that’s the unit to parse again or keep
      const group = mergeableGroups.get(collectionName) ?? [];

      group.push({ file, entry });
      mergeableGroups.set(collectionName, group);
    } else if (entry) {
      reusedEntries.set(file.path, entry);
    } else {
      dirtyFiles.push(file);
    }
  });

  mergeableGroups.forEach((group) => {
    if (group.every(({ entry }) => !!entry)) {
      group.forEach(({ file, entry }) => {
        reusedEntries.set(file.path, /** @type {Entry} */ (entry));
      });
    } else {
      dirtyFiles.push(...group.map(({ file }) => file));
    }
  });

  return { reusedEntries, dirtyFiles };
};

/**
 * Put the previous entries being kept and the freshly parsed ones together, in the order of their
 * first file in the file list, which is the order `prepareEntries()` gives them in.
 * @param {object} args Arguments.
 * @param {BaseEntryListItem[]} args.entryFiles Entry files in the latest file list.
 * @param {Map<string, Entry>} args.reusedEntries Previous entries to keep, keyed with each of their
 * file paths.
 * @param {Entry[]} args.parsedEntries Entries parsed from the other files.
 * @returns {Entry[]} Entries.
 */
export const mergeEntries = ({ entryFiles, reusedEntries, parsedEntries }) => {
  /** @type {Map<string, Entry[]>} */
  const parsedByPath = new Map();

  // A file storing all the entries of an entry collection makes more than one entry
  parsedEntries.forEach((entry) => {
    getEntryPaths(entry).forEach((path) => {
      parsedByPath.set(path, [...(parsedByPath.get(path) ?? []), entry]);
    });
  });

  /** @type {Set<Entry>} */
  const entries = new Set();

  entryFiles.forEach(({ path }) => {
    const reusedEntry = reusedEntries.get(path);

    (reusedEntry ? [reusedEntry] : (parsedByPath.get(path) ?? [])).forEach((entry) => {
      entries.add(entry);
    });
  });

  return [...entries];
};
