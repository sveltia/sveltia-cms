/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */

import { unique } from '@sveltia/utils/array';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';

import { allAssetFolders } from '$lib/services/assets/folders';
import { TEMP_FILE_PREFIX } from '$lib/services/backends/fs/shared/constants';
import { GIT_CONFIG_FILE_REGEX } from '$lib/services/backends/git/shared/config';
import { ESCAPED_PLACEHOLDER_REGEX } from '$lib/services/common/template/constants';
import { allEntryFolders } from '$lib/services/contents';
import { createPathRegEx } from '$lib/services/utils/file';

/**
 * @import { BaseFileListItemProps } from '$lib/types/private';
 */

/**
 * File handle item containing metadata and handle reference.
 * @typedef {object} FileHandleItem
 * @property {FileSystemFileHandle} handle File system handle.
 * @property {string} path Path to the file.
 */

/**
 * How old a temporary file has to be, in milliseconds, before it’s considered left behind by a save
 * that never finished, e.g. because a dev server reloaded the page in the middle of it. A younger
 * one may belong to a save in progress in another tab.
 */
const STALE_TEMP_FILE_AGE = 60 * 1000;

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
 * Delete a temporary file left behind by a save that never finished. When the page is reloaded in
 * the middle of a save, e.g. by a dev server that watches the content files, the temporary file
 * isn’t renamed to its final name, and nothing else would ever remove it. The content isn’t lost,
 * because the draft backup is only deleted once the save is complete.
 * @param {FileSystemDirectoryHandle} dirHandle Directory containing the file.
 * @param {FileSystemFileHandle} fileHandle Temporary file handle.
 */
const deleteStaleTempFile = async (dirHandle, fileHandle) => {
  try {
    const { lastModified } = await fileHandle.getFile();

    if (Date.now() - lastModified >= STALE_TEMP_FILE_AGE) {
      await dirHandle.removeEntry(fileHandle.name);
    }
  } catch {
    // The file may have been renamed or removed in the meantime, e.g. by a save in another tab
  }
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
      if (handle.kind === 'file' && name.startsWith(TEMP_FILE_PREFIX)) {
        await deleteStaleTempFile(dirHandle, /** @type {FileSystemFileHandle} */ (handle));
      }

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
