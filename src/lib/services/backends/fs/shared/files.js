/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */

import { unique } from '@sveltia/utils/array';
import { getPathInfo, readAsText } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { allAssets } from '$lib/services/assets';
import { allAssetFolders } from '$lib/services/assets/folders';
import { getAssetKind } from '$lib/services/assets/kinds';
import { GIT_CONFIG_FILE_REGEX, gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { createFileList } from '$lib/services/backends/process';
import { allEntries, allEntryFolders, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';
import { createPathRegEx, getBlob, getGitHash } from '$lib/services/utils/file';

/**
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
 * File handle item containing metadata and handle reference.
 * @typedef {object} FileHandleItem
 * @property {FileSystemFileHandle} handle File system handle.
 * @property {string} path Path to the file.
 */

/**
 * Get a file or directory handle at the given path.
 * @internal
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string} path Path to the file/directory.
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
 * @param {string} path Path to the directory.
 * @returns {Promise<FileSystemDirectoryHandle>} Handle.
 */
export const getDirectoryHandle = (rootDirHandle, path) =>
  /** @type {Promise<FileSystemDirectoryHandle>} */ (
    getHandleByPath(rootDirHandle, path, 'directory')
  );

/**
 * Create a regular expression that matches the given path, taking template tags into account.
 * @internal
 * @param {string} path Path.
 * @returns {RegExp} RegEx.
 */
export const getPathRegex = (path) =>
  createPathRegEx(path, (segment) => segment.replace(/{{.+?}}/, '.+?'));

/**
 * Retrieve all the files under the given directory recursively.
 * @internal
 * @param {FileSystemDirectoryHandle} dirHandle Directory handle.
 * @param {object} context Context object.
 * @param {FileSystemDirectoryHandle} context.rootDirHandle Root directory handle.
 * @param {string[]} context.scanningPaths Scanning paths.
 * @param {RegExp[]} context.scanningPathsRegEx Regular expressions for scanning paths.
 * @param {FileHandleItem[]} context.fileHandles List of available file handles.
 * @param {string} [currentPath] Current directory path (for recursion).
 */
export const scanDir = async (dirHandle, context, currentPath = '') => {
  const { scanningPaths, scanningPathsRegEx, fileHandles } = context;

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
        // eslint-disable-next-line object-shorthand
        handle: /** @type {FileSystemFileHandle} */ (handle),
        path,
      });
    }

    if (handle.kind === 'directory') {
      const regex = getPathRegex(path);

      if (hasMatchingPath || scanningPaths.some((p) => regex.test(p))) {
        await scanDir(/** @type {FileSystemDirectoryHandle} */ (handle), context, path);
      }
    }
  }
};

/**
 * Collect all scanning paths from entry and asset folders.
 * @internal
 * @returns {string[]} Unique list of normalized scanning paths.
 */
export const collectScanningPaths = () => {
  const entryPaths = get(allEntryFolders)
    .map(({ filePathMap, folderPathMap }) =>
      filePathMap ? Object.values(filePathMap) : Object.values(folderPathMap ?? {}),
    )
    .flat(1);

  const assetPaths = get(allAssetFolders)
    .filter(({ internalPath }) => internalPath !== undefined)
    .map(({ internalPath }) => internalPath);

  return unique([...entryPaths, ...assetPaths].map((path) => stripSlashes(path ?? '')));
};

/**
 * Retrieve all files under the static directory.
 * @internal
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
 * @internal
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
 * @internal
 * @param {BaseAssetListItem} fileInfo Asset file info.
 * @returns {Promise<Asset>} Asset object.
 */
export const parseAssetFileInfo = async (fileInfo) => {
  const { name, handle } = fileInfo;
  const kind = getAssetKind(name);

  try {
    const file = await /** @type {FileSystemFileHandle} */ (handle).getFile();
    const { size } = file;
    const sha = await getGitHash(file);

    return { ...fileInfo, kind, size, sha };
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return { ...fileInfo, kind };
  }
};

/**
 * Load file list and all the entry files from the file system, then cache them in the stores.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 */
export const loadFiles = async (rootDirHandle) => {
  const { entryFiles, assetFiles, configFiles } = createFileList(await getAllFiles(rootDirHandle));
  /** @type {BaseEntryListItem[]} */
  const entryFileItems = [];
  /** @type {BaseConfigListItem[]} */
  const configFileItems = [];

  // Avoid using `Promise.all` to prevent concurrent file reads that can lead to memory leaks,
  // especially on Linux systems with a large number of files.
  // @see https://github.com/sveltia/sveltia-cms/issues/224
  for (const fileInfo of entryFiles) {
    entryFileItems.push(/** @type {BaseEntryListItem} */ (await parseTextFileInfo(fileInfo)));
  }

  for (const fileInfo of configFiles) {
    configFileItems.push(/** @type {BaseConfigListItem} */ (await parseTextFileInfo(fileInfo)));
  }

  const { entries, errors } = await prepareEntries(entryFileItems);
  /** @type {Asset[]} */
  const assets = [];

  for (const fileInfo of assetFiles) {
    assets.push(await parseAssetFileInfo(fileInfo));
  }

  allEntries.set(entries);
  allAssets.set(assets);
  gitConfigFiles.set(configFileItems);
  entryParseErrors.set(errors);
  dataLoaded.set(true);
};

/**
 * Move a file from a previous path to a new path within the file system.
 * @internal
 * @param {object} args Arguments.
 * @param {FileSystemDirectoryHandle} args.rootDirHandle Root directory handle.
 * @param {string} args.previousPath The current path of the file to move.
 * @param {string} args.path The new path where the file should be moved.
 * @returns {Promise<FileSystemFileHandle>} Moved file handle.
 */
export const moveFile = async ({ rootDirHandle, previousPath, path }) => {
  const { dirname, basename } = getPathInfo(path);
  const previousDirname = getPathInfo(previousPath).dirname;
  const fileHandle = await getFileHandle(rootDirHandle, previousPath);

  if (dirname && dirname !== previousDirname) {
    await fileHandle.move(await getDirectoryHandle(rootDirHandle, dirname), basename);
  } else {
    await fileHandle.move(basename);
  }

  return fileHandle;
};

/**
 * Write data to a file at the specified path.
 * @internal
 * @param {object} args Arguments.
 * @param {FileSystemDirectoryHandle} args.rootDirHandle Root directory handle.
 * @param {FileSystemFileHandle} [args.fileHandle] File handle to write to. Provided if the file has
 * been moved.
 * @param {string} args.path The relative path to the file within the root directory.
 * @param {string | File} args.data The data to write to the file.
 * @returns {Promise<File>} Written file.
 */
export const writeFile = async ({ rootDirHandle, fileHandle, path, data }) => {
  fileHandle ??= await getFileHandle(rootDirHandle, path);

  // The `createWritable` method is not yet supported by Safari
  // @see https://bugs.webkit.org/show_bug.cgi?id=254726
  const writer = await fileHandle.createWritable?.();

  try {
    await writer?.write(data);
  } catch {
    // Can throw if the file has just been moved/renamed without any change, and then the `data` is
    // no longer available
  } finally {
    try {
      await writer?.close();
    } catch {
      //
    }
  }

  return fileHandle.getFile();
};

/**
 * Recursively delete empty parent directories.
 * @internal
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string[]} pathSegments Array of directory path segments.
 */
export const deleteEmptyParentDirs = async (rootDirHandle, pathSegments) => {
  // Start from the deepest directory
  for (let i = pathSegments.length; i > 0; i -= 1) {
    const currentPath = pathSegments.slice(0, i).join('/');
    const dirHandle = await getDirectoryHandle(rootDirHandle, currentPath);
    const keys = await Array.fromAsync(dirHandle.keys());

    // If directory is not empty, stop
    if (keys.length > 0) {
      break;
    }

    // Get parent directory and remove the empty directory
    const dirName = pathSegments[i - 1];
    const parentPath = pathSegments.slice(0, i - 1).join('/');
    const parentHandle = await getDirectoryHandle(rootDirHandle, parentPath);

    await parentHandle.removeEntry(dirName);
  }
};

/**
 * Delete a file at the specified path within the file system.
 * @internal
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
 * @internal
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
    return writeFile({ rootDirHandle, fileHandle, path, data });
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
