/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */

import { unique } from '@sveltia/utils/array';
import { getPathInfo, readAsText } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { allAssetFolders, allAssets } from '$lib/services/assets';
import { parseAssetFiles } from '$lib/services/assets/parser';
import { GIT_CONFIG_FILE_REGEX, gitConfigFiles } from '$lib/services/backends';
import { createFileList } from '$lib/services/backends/shared/fetch';
import { allEntries, allEntryFolders, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';
import { createPathRegEx, getGitHash } from '$lib/services/utils/file';

/**
 * @import { BaseFileListItem, BaseFileListItemProps, FileChange } from '$lib/types/private';
 */

/**
 * @typedef {{ file: File, path: string }} FileListItem
 */

/**
 * Get a file or directory handle at the given path.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string} path Path to the file/directory.
 * @param {'file' | 'directory'} [type] Type of the handle to retrieve.
 * @returns {Promise<FileSystemFileHandle | FileSystemDirectoryHandle>} Handle.
 * @throws {Error} If the path is empty and the type is `file`.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getFileHandle
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle
 */
const getHandleByPath = async (rootDirHandle, path, type = 'file') => {
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
 * @param {string} path Path.
 * @returns {RegExp} RegEx.
 */
const getPathRegex = (path) =>
  createPathRegEx(path, (segment) => segment.replace(/{{.+?}}/, '.+?'));

/**
 * Retrieve all the files under the given directory recursively.
 * @param {FileSystemDirectoryHandle | any} dirHandle Directory handle.
 * @param {object} context Context object.
 * @param {FileSystemDirectoryHandle} context.rootDirHandle Root directory handle.
 * @param {string[]} context.scanningPaths Scanning paths.
 * @param {RegExp[]} context.scanningPathsRegEx Regular expressions for scanning paths.
 * @param {FileListItem[]} context.fileList List of available files.
 */
const scanDir = async (dirHandle, context) => {
  const { rootDirHandle, scanningPaths, scanningPathsRegEx, fileList } = context;

  for await (const [name, handle] of dirHandle.entries()) {
    // Skip hidden files and directories, except for Git configuration files
    if (name.startsWith('.') && !GIT_CONFIG_FILE_REGEX.test(name)) {
      continue;
    }

    const path = (await rootDirHandle.resolve(handle))?.join('/') ?? '';
    const hasMatchingPath = scanningPathsRegEx.some((regex) => regex.test(path));

    if (handle.kind === 'file') {
      if (!hasMatchingPath) {
        continue;
      }

      try {
        /** @type {File} */
        let file = await handle.getFile();
        const { type, lastModified } = file;

        // Clone the file immediately to avoid potential permission problems
        file = new File([file], file.name, { type, lastModified });

        fileList.push({ file, path });
      } catch (/** @type {any} */ ex) {
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }

    if (handle.kind === 'directory') {
      const regex = getPathRegex(path);

      if (!hasMatchingPath && !scanningPaths.some((p) => regex.test(p))) {
        continue;
      }

      await scanDir(handle, context);
    }
  }
};

/**
 * Normalize a file list item to ensure it has the required properties. This function also computes
 * the SHA-1 hash of the file. The file path and name must be normalized, as certain non-ASCII
 * characters (e.g. Japanese) can be problematic particularly on macOS.
 * @param {FileListItem} fileListItem File list item.
 * @returns {Promise<BaseFileListItemProps>} Normalized file list item.
 */
const normalizeFileListItem = async ({ file, path }) => ({
  file,
  path: path.normalize(),
  name: file.name.normalize(),
  size: file.size,
  sha: await getGitHash(file),
});

/**
 * Retrieve all files under the static directory.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @returns {Promise<BaseFileListItemProps[]>} File list.
 */
const getAllFiles = async (rootDirHandle) => {
  /** @type {FileListItem[]} */
  const fileList = [];

  /** @type {string[]} */
  const scanningPaths = unique(
    [
      ...get(allEntryFolders)
        .map(({ filePathMap, folderPathMap }) =>
          filePathMap ? Object.values(filePathMap) : Object.values(folderPathMap ?? {}),
        )
        .flat(1),
      ...get(allAssetFolders)
        .filter(({ internalPath }) => internalPath !== undefined)
        .map(({ internalPath }) => internalPath),
    ].map((path) => stripSlashes(path ?? '')),
  );

  await scanDir(rootDirHandle, {
    rootDirHandle,
    scanningPaths,
    scanningPathsRegEx: scanningPaths.map(getPathRegex),
    fileList,
  });

  return Promise.all(fileList.map(normalizeFileListItem));
};

/**
 * Read text content from a file and store it in the entry file object.
 * @param {BaseFileListItem} entryFile Entry file object to read text from.
 */
const readTextFile = async (entryFile) => {
  const { name, file } = entryFile;

  // Skip `.gitkeep` file, as we don’t need to read its content
  if (name === '.gitkeep') {
    return;
  }

  try {
    entryFile.text = await readAsText(/** @type {File} */ (file));
  } catch (/** @type {any} */ ex) {
    entryFile.text = '';
    // eslint-disable-next-line no-console
    console.error(ex);
  }
};

/**
 * Load file list and all the entry files from the file system, then cache them in the
 * {@link allEntries} and {@link allAssets} stores.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 */
export const loadFiles = async (rootDirHandle) => {
  const { entryFiles, assetFiles, configFiles } = createFileList(await getAllFiles(rootDirHandle));

  await Promise.all([...entryFiles, ...configFiles].map(readTextFile));

  const { entries, errors } = await prepareEntries(entryFiles);

  allEntries.set(entries);
  allAssets.set(parseAssetFiles(assetFiles));
  gitConfigFiles.set(configFiles);
  entryParseErrors.set(errors);
  dataLoaded.set(true);
};

/**
 * Move a file from a previous path to a new path within the file system.
 * @param {object} args Arguments.
 * @param {FileSystemDirectoryHandle} args.rootDirHandle Root directory handle.
 * @param {string} args.previousPath The current path of the file to move.
 * @param {string} args.path The new path where the file should be moved.
 * @returns {Promise<FileSystemFileHandle>} Moved file handle.
 */
const moveFile = async ({ rootDirHandle, previousPath, path }) => {
  const { dirname, basename } = getPathInfo(path);
  const fileHandle = await getFileHandle(rootDirHandle, previousPath);

  if (dirname && dirname !== getPathInfo(previousPath).dirname) {
    await fileHandle.move(await getDirectoryHandle(rootDirHandle, dirname), basename);
  } else {
    await fileHandle.move(basename);
  }

  return fileHandle;
};

/**
 * Write data to a file at the specified path.
 * @param {object} args Arguments.
 * @param {FileSystemDirectoryHandle} args.rootDirHandle Root directory handle.
 * @param {FileSystemFileHandle} [args.fileHandle] File handle to write to. Provided if the file has
 * been moved.
 * @param {string} args.path The relative path to the file within the root directory.
 * @param {string | File} args.data The data to write to the file.
 * @returns {Promise<File>} Written file.
 */
const writeFile = async ({ rootDirHandle, fileHandle, path, data }) => {
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
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string[]} pathSegments Array of directory path segments.
 */
const deleteEmptyParentDirs = async (rootDirHandle, pathSegments) => {
  let dirHandle = await getDirectoryHandle(rootDirHandle, pathSegments.join('/'));

  for (;;) {
    /** @type {string[]} */
    const keys = [];

    for await (const key of dirHandle.keys()) {
      keys.push(key);
    }

    if (keys.length > 1 || !pathSegments.length) {
      break;
    }

    const dirName = /** @type {string} */ (pathSegments.pop());

    // Get the parent directory handle
    dirHandle = await getDirectoryHandle(rootDirHandle, pathSegments.join('/'));

    await dirHandle.removeEntry(dirName);
  }
};

/**
 * Delete a file at the specified path within the file system.
 * @param {object} args Arguments.
 * @param {FileSystemDirectoryHandle} args.rootDirHandle Root directory handle.
 * @param {string} args.path The path to the file to be deleted.
 */
const deleteFile = async ({ rootDirHandle, path }) => {
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
const saveChange = async (rootDirHandle, { action, path, previousPath, data }) => {
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
 * Save entries or assets locally.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {FileChange[]} changes File changes to be saved.
 * @returns {Promise<(?File)[]>} Created or updated files, if available.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWritableFileStream/write
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/removeEntry
 */
export const saveChanges = async (rootDirHandle, changes) =>
  Promise.all(
    changes.map(async (change) => {
      try {
        // Need `await` here to catch any exception
        return await saveChange(rootDirHandle, change);
      } catch (/** @type {any} */ ex) {
        // eslint-disable-next-line no-console
        console.error(ex);
      }

      return null;
    }),
  );
