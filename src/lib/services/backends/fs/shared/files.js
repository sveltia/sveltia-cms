/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */

import { unique } from '@sveltia/utils/array';
import { getPathInfo, readAsText } from '@sveltia/utils/file';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';

import { allAssets } from '$lib/services/assets';
import { allAssetFolders } from '$lib/services/assets/folders';
import { getAssetKind } from '$lib/services/assets/kinds';
import { GIT_CONFIG_FILE_REGEX, gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { createFileList, describeFileList } from '$lib/services/backends/process';
import { ESCAPED_PLACEHOLDER_REGEX } from '$lib/services/common/template/constants';
import { allEntries, allEntryFolders, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';
import { env } from '$lib/services/user/env.svelte';
import { createPathRegEx, getBlob, getGitHash } from '$lib/services/utils/file';
import { createDebugLogger } from '$lib/services/utils/logging';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import {
 * Asset,
 * BaseAssetListItem,
 * BaseConfigListItem,
 * BaseEntryListItem,
 * BaseFileListItem,
 * BaseFileListItemProps,
 * CommitResults,
 * FileChange,
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
 * File handle item containing metadata and handle reference.
 * @typedef {object} FileHandleItem
 * @property {FileSystemFileHandle} handle File system handle.
 * @property {string} path Path to the file.
 */

/**
 * Maximum file size in bytes to read content from. (10 MB).
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
/**
 * Batch size for processing files to balance performance with memory safety.
 * @see https://github.com/sveltia/sveltia-cms/issues/224
 */
const FILE_PROCESS_BATCH_SIZE = 10;

/**
 * Get a file or directory handle at the given path.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string | undefined} path Path to the file/directory.
 * @param {'file' | 'directory'} [type] Type of the handle to retrieve.
 * @returns {Promise<FileSystemFileHandle | FileSystemDirectoryHandle>} Handle.
 * @throws {Error} If the path is empty and the type is `file`.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getFileHandle
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle
 */
export const getHandleByPath = async (rootDirHandle, path, type = 'file') => {
  const normalizedPath = stripSlashes(path ?? '');
  /** @type {FileSystemFileHandle | FileSystemDirectoryHandle} */
  let handle = rootDirHandle;

  if (!normalizedPath) {
    if (type === 'directory') {
      return handle;
    }

    throw new Error('Path is required for file handle retrieval');
  }

  const pathParts = normalizedPath.split('/');
  const lastIndex = pathParts.length - 1;
  const create = true;

  for await (const [index, name] of pathParts.entries()) {
    // If the part is the last one and the type is `file`, we need to ensure that we get a file
    // handle. Otherwise, we can get a directory handle.
    handle = await (index === lastIndex && type === 'file'
      ? /** @type {FileSystemDirectoryHandle} */ (handle).getFileHandle(name, { create })
      : /** @type {FileSystemDirectoryHandle} */ (handle).getDirectoryHandle(name, { create }));
  }

  return handle;
};

/**
 * Get a file handle at the given path. This function is used to retrieve a file handle for reading
 * or writing a file. If the file does not exist, it will be created.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string} path Path to the file.
 * @returns {Promise<FileSystemFileHandle>} Handle.
 * @throws {Error} If the path is empty.
 */
export const getFileHandle = (rootDirHandle, path) =>
  /** @type {Promise<FileSystemFileHandle>} */ (getHandleByPath(rootDirHandle, path, 'file'));

/**
 * Get a directory handle at the given path. This function is used to retrieve a directory handle
 * for reading or writing files within a directory. If the directory does not exist, it will be
 * created.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string | undefined} path Path to the directory.
 * @returns {Promise<FileSystemDirectoryHandle>} Handle.
 */
export const getDirectoryHandle = (rootDirHandle, path) =>
  /** @type {Promise<FileSystemDirectoryHandle>} */ (
    getHandleByPath(rootDirHandle, path, 'directory')
  );

/**
 * Create a regular expression that matches the given path, taking template tags into account.
 * @param {string} path Path.
 * @returns {RegExp} RegEx.
 */
export const getPathRegex = (path) => {
  // Handle empty path (root folder) - match any file
  if (!path) {
    return /^.+$/;
  }

  return createPathRegEx(path, (segment) =>
    escapeRegExp(segment).replace(ESCAPED_PLACEHOLDER_REGEX, '.+?'),
  );
};

/**
 * Retrieve all the files under the given directory recursively.
 * @param {FileSystemDirectoryHandle} dirHandle Directory handle.
 * @param {object} context Context object.
 * @param {FileSystemDirectoryHandle} context.rootDirHandle Root directory handle.
 * @param {string[]} context.scanningPaths Scanning paths.
 * @param {RegExp[]} context.scanningPathsRegEx Regular expressions for scanning paths.
 * @param {FileHandleItem[]} context.fileHandles List of available file handles.
 * @param {Map<string, RegExp>} context.pathRegexCache Cache for path regexes.
 * @param {string} [currentPath] Current directory path (for recursion).
 */
export const scanDir = async (dirHandle, context, currentPath = '') => {
  const { scanningPaths, scanningPathsRegEx, fileHandles, pathRegexCache } = context;

  for await (const [name, handle] of dirHandle.entries()) {
    // Skip hidden files and directories, except for Git configuration files
    if (name.startsWith('.') && !GIT_CONFIG_FILE_REGEX.test(name)) {
      continue;
    }

    const path = currentPath ? `${currentPath}/${name}` : name;
    const hasMatchingPath = scanningPathsRegEx.some((regex) => regex.test(path));

    if (handle.kind === 'file' && hasMatchingPath) {
      // Store only the handle and path. Metadata will be extracted later when needed, avoiding
      // memory leaks from holding multiple file references during directory scanning.
      fileHandles.push({
        handle: /** @type {FileSystemFileHandle} */ (handle),
        path,
      });
    }

    if (handle.kind === 'directory') {
      // Cache regex creation to avoid recreating for the same path
      let regex = pathRegexCache.get(path);

      if (!regex) {
        regex = getPathRegex(path);
        pathRegexCache.set(path, regex);
      }

      if (hasMatchingPath || scanningPaths.some((p) => regex.test(p))) {
        await scanDir(/** @type {FileSystemDirectoryHandle} */ (handle), context, path);
      }
    }
  }
};

/**
 * Collect all scanning paths from entry and asset folders.
 * @returns {string[]} Unique list of normalized scanning paths.
 */
export const collectScanningPaths = () => {
  const entryPaths = allEntryFolders.current.flatMap(({ filePathMap, folderPathMap }) =>
    filePathMap ? Object.values(filePathMap) : Object.values(folderPathMap ?? {}),
  );

  const assetPaths = allAssetFolders.current
    .filter(({ internalPath }) => internalPath !== undefined)
    .map(({ internalPath }) => internalPath);

  return unique(
    /* v8 ignore next */
    [...entryPaths, ...assetPaths].map((path) => stripSlashes(path ?? '')),
  );
};

/**
 * Retrieve all files under the static directory.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @returns {Promise<BaseFileListItemProps[]>} File list.
 */
export const getAllFiles = async (rootDirHandle) => {
  /** @type {FileHandleItem[]} */
  const fileHandles = [];
  const scanningPaths = collectScanningPaths();

  await scanDir(rootDirHandle, {
    rootDirHandle,
    scanningPaths,
    scanningPathsRegEx: scanningPaths.map(getPathRegex),
    fileHandles,
    pathRegexCache: new Map(),
  });

  return fileHandles.map(({ handle, path }) => ({
    handle,
    path: path.normalize(),
    name: handle.name.normalize(),
    size: 0, // Will be populated later
    sha: '', // Will be populated later
  }));
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

  /** @type {BaseEntryListItem[]} */
  const entryFileItems = [];
  /** @type {BaseConfigListItem[]} */
  const configFileItems = [];

  // Process files in batches to balance performance with memory safety
  for (let i = 0; i < entryFiles.length; i += FILE_PROCESS_BATCH_SIZE) {
    const batch = entryFiles.slice(i, i + FILE_PROCESS_BATCH_SIZE);
    const results = await Promise.all(batch.map((fileInfo) => parseTextFileInfo(fileInfo)));

    entryFileItems.push(.../** @type {BaseEntryListItem[]} */ (results));
  }

  log(`Read ${entryFileItems.length} entry files`);

  for (let i = 0; i < configFiles.length; i += FILE_PROCESS_BATCH_SIZE) {
    const batch = configFiles.slice(i, i + FILE_PROCESS_BATCH_SIZE);
    const results = await Promise.all(batch.map((fileInfo) => parseTextFileInfo(fileInfo)));

    configFileItems.push(.../** @type {BaseConfigListItem[]} */ (results));
  }

  log(`Read ${configFileItems.length} config files`);

  const { entries, errors } = await prepareEntries(entryFileItems);

  log(`Parsed ${entries.length} entries (${errors.length} errors)`);

  /** @type {Asset[]} */
  const assets = [];
  const cachedHashes = await cachedHashesPromise;
  /** @type {Map<string, AssetHashCacheRecord>} */
  const newHashes = new Map();

  for (let i = 0; i < assetFiles.length; i += FILE_PROCESS_BATCH_SIZE) {
    const batch = assetFiles.slice(i, i + FILE_PROCESS_BATCH_SIZE);

    const results = await Promise.all(
      batch.map((fileInfo) => parseAssetFileInfo(fileInfo, { cachedHashes, newHashes })),
    );

    assets.push(...results);
  }

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

/**
 * Check if the `move` method is supported by the current browser. The `move` method is not
 * implemented in older browsers, and Brave supports the `move` method but throws an error for some
 * reason, so we need to check it by actually trying to use it.
 * @returns {boolean} `true` if the `move` method is supported, `false` otherwise.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/File_System_API#browser_compatibility
 * @see https://github.com/sveltia/sveltia-cms/discussions/676
 */
export const canMoveFile = () => 'move' in FileSystemFileHandle.prototype && !env.isBrave;

/**
 * Write data to a file using the provided file handle. This function is used to write data to a
 * file when we already have a file handle reference, such as when moving a file without changes. It
 * handles the case where the `createWritable` method is not supported by older versions of Safari.
 * @param {FileSystemFileHandle} fileHandle File handle to write to.
 * @param {FileSystemWriteChunkType} data Data to write to the file.
 */
export const writeFile = async (fileHandle, data) => {
  // The `createWritable` method is not supported by older versions of Safari
  const writer = await fileHandle.createWritable?.();

  try {
    // Can throw if the file has just been moved/renamed without any change, and then the `data` is
    // no longer available
    await writer?.write(data);
  } finally {
    try {
      await writer?.close();
    } catch {
      //
    }
  }
};

/**
 * Move a file from a previous path to a new path within the file system.
 * @param {object} args Arguments.
 * @param {FileSystemDirectoryHandle} args.rootDirHandle Root directory handle.
 * @param {string} args.previousPath The current path of the file to move.
 * @param {string} args.path The new path where the file should be moved.
 * @returns {Promise<FileSystemFileHandle>} Moved file handle.
 */
export const moveFile = async ({ rootDirHandle, previousPath, path }) => {
  const { dirname: newDirname, basename: newBasename } = getPathInfo(path);
  const { dirname: oldDirname, basename: oldBasename } = getPathInfo(previousPath);
  const fileHandle = await getFileHandle(rootDirHandle, previousPath);

  // Use the native `move` method if supported, as it’s more efficient and preserves file metadata.
  // If not, fall back to copying the file to the new location and deleting the old file.
  if (canMoveFile()) {
    // @ts-ignore
    await fileHandle.move(await getDirectoryHandle(rootDirHandle, newDirname), newBasename);

    return fileHandle;
  }

  const newFileHandle = await getFileHandle(rootDirHandle, path);
  const oldDirHandle = await getDirectoryHandle(rootDirHandle, oldDirname);

  await writeFile(newFileHandle, await fileHandle.getFile());
  await oldDirHandle.removeEntry(oldBasename);

  return newFileHandle;
};

/**
 * Save data to a file at the specified path.
 * @param {object} args Arguments.
 * @param {FileSystemDirectoryHandle} args.rootDirHandle Root directory handle.
 * @param {FileSystemFileHandle} [args.fileHandle] File handle to write to. Provided if the file has
 * been moved.
 * @param {string} args.path The relative path to the file within the root directory.
 * @param {string | File} args.data The data to write to the file.
 * @returns {Promise<File>} Written file.
 */
export const saveFile = async ({ rootDirHandle, fileHandle, path, data }) => {
  // When no handle is provided (create/update), write to a temp file first, then rename it to the
  // final path. This avoids race conditions with file watchers (e.g., Astro dev server) that may
  // read the new file before its content is fully written.
  // @see https://github.com/sveltia/sveltia-cms/issues/675
  /** @type {{ dirname: string | undefined, basename: string } | undefined} */
  let pendingRename;

  if (!fileHandle) {
    // Check if the `move` method is supported before deciding whether to write to a temp file, as
    // writing to a temp file and then renaming it is only necessary if the `move` method is not
    // supported. If the `move` method is supported, we have to write directly to the final path.
    if (canMoveFile()) {
      const { dirname, basename } = getPathInfo(stripSlashes(path));
      const tempPath = `${dirname ? `${dirname}/` : ''}.sveltia-tmp-${crypto.randomUUID()}`;

      fileHandle = await getFileHandle(rootDirHandle, tempPath);
      pendingRename = { dirname, basename };
    } else {
      fileHandle = await getFileHandle(rootDirHandle, path);
    }
  }

  await writeFile(fileHandle, data);

  if (pendingRename) {
    const { dirname, basename } = pendingRename;

    // @ts-ignore
    await fileHandle.move(await getDirectoryHandle(rootDirHandle, dirname), basename);
  }

  return fileHandle.getFile();
};

/**
 * Recursively delete empty parent directories.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string[]} pathSegments Array of directory path segments.
 */
export const deleteEmptyParentDirs = async (rootDirHandle, pathSegments) => {
  // Start from the deepest directory
  for (let i = pathSegments.length; i > 0; i -= 1) {
    const dirName = pathSegments[i - 1];
    const parentPath = pathSegments.slice(0, i - 1).join('/');
    const parentHandle = await getDirectoryHandle(rootDirHandle, parentPath);
    const dirHandle = await parentHandle.getDirectoryHandle(dirName);

    // Use for...of to check if directory is empty with early exit on first entry found
    // eslint-disable-next-line no-unreachable-loop
    for await (const _entry of dirHandle.entries()) {
      // Directory is not empty, stop cleanup
      return;
    }

    // Directory is empty, remove it
    await parentHandle.removeEntry(dirName);
  }
};

/**
 * Delete a file at the specified path within the file system.
 * @param {object} args Arguments.
 * @param {FileSystemDirectoryHandle} args.rootDirHandle Root directory handle.
 * @param {string} args.path The path to the file to be deleted.
 */
export const deleteFile = async ({ rootDirHandle, path }) => {
  const { dirname: dirPath = '', basename: fileName } = getPathInfo(stripSlashes(path));
  const dirHandle = await getDirectoryHandle(rootDirHandle, dirPath);

  await dirHandle.removeEntry(fileName);

  if (dirPath) {
    await deleteEmptyParentDirs(rootDirHandle, dirPath.split('/'));
  }
};

/**
 * Save a file to the file system based on the provided change options.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {FileChange} change File change options.
 * @returns {Promise<?File>} Created or updated file, if available.
 * @throws {Error} If an error occurs while saving the file.
 */
export const saveChange = async (rootDirHandle, { action, path, previousPath, data }) => {
  /** @type {FileSystemFileHandle | undefined} */
  let fileHandle;

  if (action === 'move' && previousPath) {
    fileHandle = await moveFile({ rootDirHandle, previousPath, path });
  }

  if (['create', 'update', 'move'].includes(action) && data) {
    // We don’t need to write the file is it’s just been renamed with no change, but the `data` is
    // always provided for the compatibility with Git backends, so we cannot distinguish between the
    // two cases
    return saveFile({ rootDirHandle, fileHandle, path, data });
  }

  if (action === 'delete') {
    await deleteFile({ rootDirHandle, path });
  }

  return null;
};

/**
 * Save entries or assets in the file system.
 * @param {FileSystemDirectoryHandle | undefined} rootDirHandle Root directory handle. This can be
 * `undefined` if the directory handle could not be acquired earlier for security reasons. If the
 * handle is not available, the changes will not be saved, but the user can still continue using the
 * app without an error thanks to the in-memory cache.
 * @param {FileChange[]} changes File changes to be saved.
 * @returns {Promise<CommitResults>} Commit results, including a pseudo commit SHA, saved files, and
 * their blob SHAs.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWritableFileStream/write
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/removeEntry
 */
export const saveChanges = async (rootDirHandle, changes) => {
  const entries = await Promise.all(
    changes.map(async (change) => {
      const { path, data } = change;
      /** @type {Blob | null} */
      let file = null;

      if (rootDirHandle) {
        try {
          file = await saveChange(rootDirHandle, change);
        } catch (ex) {
          // eslint-disable-next-line no-console
          console.error(ex);
        }
      }

      if (!file) {
        if (data === undefined) {
          return null;
        }

        file = getBlob(data);
      }

      return [path, { file, sha: await getGitHash(file) }];
    }),
  );

  return {
    // Use a hash of the current date as a pseudo SHA
    sha: await getGitHash(new Date().toJSON()),
    files: Object.fromEntries(entries.filter((entry) => !!entry)),
  };
};
