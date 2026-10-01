import { readAsText } from '@sveltia/utils/file';

import { getAssetKind } from '$lib/services/assets/kinds';
import { allAssets } from '$lib/services/assets/state';
import { getAllFiles } from '$lib/services/backends/fs/shared/scan';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { createFileList, describeFileList } from '$lib/services/backends/process';
import { allEntries, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';
import { getGitHash } from '$lib/services/utils/file';
import { createDebugLogger } from '$lib/services/utils/logging';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import {
 * Asset,
 * BaseAssetListItem,
 * BaseConfigListItem,
 * BaseEntryListItem,
 * BaseFileListItem,
 * } from '$lib/types/private';
 */

/**
 * Cached Git object ID of an asset file, along with the file’s size and modification time at the
 * time it was hashed. The hash is reused as long as both still match, so an unchanged file isn’t
 * read again on the next load.
 * @typedef {object} AssetHashCacheRecord
 * @property {string} sha Git object ID (SHA-1 hash) of the file.
 * @property {number} size File size in bytes.
 * @property {number} lastModified Modification time of the file, in milliseconds since the epoch.
 */

/**
 * Maximum file size in bytes to read content from. (10 MB).
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
/**
 * Maximum number of files processed at the same time, to balance performance with memory safety.
 * @see https://github.com/sveltia/sveltia-cms/issues/224
 */
const FILE_PROCESS_CONCURRENCY = 10;

/**
 * Process the given files with a limited number of them in flight. Unlike fixed batches, a new file
 * is picked up as soon as a slot frees up, so one large file doesn’t stall the others.
 * @template T, R
 * @param {T[]} items Files to process.
 * @param {(item: T) => Promise<R>} task Task to be performed for each file.
 * @returns {Promise<R[]>} Results, in the same order as the given files.
 */
const processFiles = async (items, task) => {
  /** @type {R[]} */
  const results = Array.from({ length: items.length });

  await runConcurrently(
    [...items.keys()],
    async (index) => {
      results[index] = await task(items[index]);
    },
    { concurrency: FILE_PROCESS_CONCURRENCY },
  );

  return results;
};

/**
 * Parse text file info to create a complete entry or config file object.
 * @param {BaseFileListItem} fileInfo Entry or config file info.
 * @returns {Promise<BaseFileListItem>} Entry or config file with text content. We don’t populate
 * `size` and `sha` for entries and config files, as they are not needed.
 */
export const parseTextFileInfo = async (fileInfo) => {
  const { name, handle } = fileInfo;

  // Skip `.gitkeep` file, as we don’t need to read its content
  if (name === '.gitkeep') {
    return fileInfo;
  }

  try {
    const file = await /** @type {FileSystemFileHandle} */ (handle).getFile();

    if (file.size > MAX_FILE_SIZE) {
      // eslint-disable-next-line no-console
      console.warn(`File ${name} is too large (${file.size} bytes), skipping content read`);

      return { ...fileInfo, text: '' };
    }

    const text = await readAsText(file);

    return { ...fileInfo, text };
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return { ...fileInfo, text: '' };
  }
};

/**
 * Parse asset file info to create a complete asset object.
 * @param {BaseAssetListItem} fileInfo Asset file info.
 * @param {object} [options] Options.
 * @param {Map<string, AssetHashCacheRecord>} [options.cachedHashes] Hashes from a previous load,
 * keyed by file path. A file whose size and modification time still match its record is not read
 * again; hashing means reading the whole file, which adds up with a lot of media.
 * @param {Map<string, AssetHashCacheRecord>} [options.newHashes] Map to collect the hashes computed
 * in this load in, keyed by file path, so they can be cached for the next one.
 * @returns {Promise<Asset>} Asset object.
 */
export const parseAssetFileInfo = async (fileInfo, { cachedHashes, newHashes } = {}) => {
  const { name, path, handle } = fileInfo;
  const kind = getAssetKind(name);

  try {
    const file = await /** @type {FileSystemFileHandle} */ (handle).getFile();
    const { size, lastModified } = file;
    const cached = cachedHashes?.get(path);
    /** @type {string} */
    let sha;

    if (cached && cached.size === size && cached.lastModified === lastModified) {
      ({ sha } = cached);
    } else {
      sha = await getGitHash(file);
      newHashes?.set(path, { sha, size, lastModified });
    }

    return { ...fileInfo, kind, size, sha };
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return { ...fileInfo, kind };
  }
};

/**
 * Read the asset hashes cached by a previous load.
 * @param {IndexedDB | null | undefined} hashCacheDB Cache store.
 * @returns {Promise<Map<string, AssetHashCacheRecord>>} Cached hashes keyed by file path. Empty if
 * there is no store or it can’t be read; every file is then hashed as usual.
 */
const readCachedHashes = async (hashCacheDB) => {
  try {
    return new Map((await hashCacheDB?.entries()) ?? []);
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return new Map();
  }
};

/**
 * Update the asset hash cache once the assets have been hashed: save the hashes computed in this
 * load, and drop the records of files that are gone. The records of unchanged files stay as they
 * are, so a load that reused every hash writes nothing.
 * @param {IndexedDB | null | undefined} hashCacheDB Cache store.
 * @param {object} hashes Hashes.
 * @param {Map<string, AssetHashCacheRecord>} hashes.cachedHashes Hashes read from the store.
 * @param {Map<string, AssetHashCacheRecord>} hashes.newHashes Hashes computed in this load.
 * @param {Set<string>} hashes.currentPaths Paths of the asset files found in this load.
 */
const updateCachedHashes = async (hashCacheDB, { cachedHashes, newHashes, currentPaths }) => {
  if (!hashCacheDB) {
    return;
  }

  const stalePaths = [...cachedHashes.keys()].filter((path) => !currentPaths.has(path));

  try {
    if (newHashes.size) {
      await hashCacheDB.saveEntries([...newHashes]);
    }

    if (stalePaths.length) {
      await hashCacheDB.deleteEntries(stalePaths);
    }
  } catch (ex) {
    // The cache is a nicety; the next load hashes the files again
    // eslint-disable-next-line no-console
    console.error(ex);
  }
};

/**
 * Load file list and all the entry files from the file system, then cache them in the stores.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {object} [options] Options.
 * @param {IndexedDB | null} [options.hashCacheDB] Store holding the asset hashes computed by
 * previous loads, keyed by file path, so unchanged files don’t have to be read and hashed again.
 * Without one, every asset file is read in full on every load.
 */
export const loadFiles = async (rootDirHandle, { hashCacheDB = null } = {}) => {
  const log = createDebugLogger('Loading site data');

  log(`Started: local repository ${rootDirHandle.name}`);

  // Start reading the cache right away, as it’s only needed once the directory has been scanned
  const cachedHashesPromise = readCachedHashes(hashCacheDB);
  const fileList = createFileList(await getAllFiles(rootDirHandle));
  const { entryFiles, assetFiles, configFiles } = fileList;

  log(`Scanned the directory: ${describeFileList(fileList)}`);

  const entryFileItems = /** @type {BaseEntryListItem[]} */ (
    await processFiles(entryFiles, parseTextFileInfo)
  );

  log(`Read ${entryFileItems.length} entry files`);

  const configFileItems = /** @type {BaseConfigListItem[]} */ (
    await processFiles(configFiles, parseTextFileInfo)
  );

  log(`Read ${configFileItems.length} config files`);

  const { entries, errors } = await prepareEntries(entryFileItems);

  log(`Parsed ${entries.length} entries (${errors.length} errors)`);

  const cachedHashes = await cachedHashesPromise;
  /** @type {Map<string, AssetHashCacheRecord>} */
  const newHashes = new Map();

  /** @type {Asset[]} */
  const assets = await processFiles(assetFiles, (fileInfo) =>
    parseAssetFileInfo(fileInfo, { cachedHashes, newHashes }),
  );

  // Each asset file is read in full to hash it, so this can take a while with large media, unless
  // the hash is still cached from a previous load
  log(`Hashed ${newHashes.size} of ${assets.length} asset files (${cachedHashes.size} cached)`);

  allEntries.current = entries;
  allAssets.current = assets;
  gitConfigFiles.current = configFileItems;
  entryParseErrors.current = errors;
  dataLoaded.current = true;

  log('The site data is ready');

  // The app is usable at this point, so the cache is updated afterwards
  await updateCachedHashes(hashCacheDB, {
    cachedHashes,
    newHashes,
    currentPaths: new Set(assetFiles.map(({ path }) => path)),
  });
};
