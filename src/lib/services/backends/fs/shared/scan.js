/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */

import { unique } from '@sveltia/utils/array';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';

import { TEMP_FILE_PREFIX } from '$lib/services/backends/fs/shared/constants';
import { GIT_CONFIG_FILE_REGEX } from '$lib/services/backends/git/shared/config';
import { collectConfiguredPaths } from '$lib/services/backends/git/shared/managed-paths';
import { ESCAPED_PLACEHOLDER_REGEX } from '$lib/services/common/template/constants';
import { createPathRegEx } from '$lib/services/utils/file';
import { createConcurrencyLimiter } from '$lib/services/utils/scheduling';

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
 * Limit the directories being listed at the same time. A site with a directory per entry, such as
 * Hugo page bundles, has thousands of them, which would otherwise all be listed at once.
 */
const limitDirListing = createConcurrencyLimiter(8);

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
 * Retrieve all the files under the given directory recursively. The subdirectories are scanned at
 * the same time rather than one after another, while the files are still listed in the order they
 * are found in, with the files of a subdirectory where the subdirectory is.
 * @param {FileSystemDirectoryHandle} dirHandle Directory handle.
 * @param {object} context Context object.
 * @param {FileSystemDirectoryHandle} context.rootDirHandle Root directory handle.
 * @param {string[]} context.scanningPaths Scanning paths.
 * @param {RegExp[]} context.scanningPathsRegEx Regular expressions for scanning paths.
 * @param {FileHandleItem[]} context.fileHandles List of available file handles, appended to once
 * the directory has been scanned.
 * @param {Map<string, RegExp>} context.pathRegexCache Cache for path regexes.
 * @param {string} [currentPath] Current directory path (for recursion).
 */
export const scanDir = async (dirHandle, context, currentPath = '') => {
  const { scanningPaths, scanningPathsRegEx, fileHandles, pathRegexCache } = context;
  /**
   * The files found, in order, with the files of each subdirectory in a list of their own, which
   * is filled in as the subdirectory is scanned.
   * @type {(FileHandleItem | FileHandleItem[])[]}
   */
  const items = [];
  /**
   * Subdirectories to scan, each with the list its files go to.
   * @type {{ handle: FileSystemDirectoryHandle, path: string, fileHandles: FileHandleItem[] }[]}
   */
  const subdirectories = [];

  // The subdirectories are only scanned once the directory has been listed, so a directory doesn’t
  // hold a listing slot while waiting for its subdirectories, which could use up every slot
  await limitDirListing(async () => {
    for await (const [name, handle] of dirHandle.entries()) {
      // Skip hidden files and directories, except for Git configuration files
      if (name.startsWith('.') && !GIT_CONFIG_FILE_REGEX.test(name)) {
        if (handle.kind === 'file' && name.startsWith(TEMP_FILE_PREFIX)) {
          await deleteStaleTempFile(dirHandle, /** @type {FileSystemFileHandle} */ (handle));
        }

        continue;
      }

      const path = currentPath ? `${currentPath}/${name}` : name;
      // The configured paths are matched in Unicode normalization form C, so a file or folder whose
      // name is in form D on the disk is found as well
      const normalizedPath = path.normalize();
      const hasMatchingPath = scanningPathsRegEx.some((regex) => regex.test(normalizedPath));

      if (handle.kind === 'file' && hasMatchingPath) {
        // Store only the handle and path. Metadata will be extracted later when needed, avoiding
        // memory leaks from holding multiple file references during directory scanning.
        items.push({
          handle: /** @type {FileSystemFileHandle} */ (handle),
          path,
        });
      }

      if (handle.kind === 'directory') {
        // Cache regex creation to avoid recreating for the same path
        let regex = pathRegexCache.get(normalizedPath);

        if (!regex) {
          regex = getPathRegex(normalizedPath);
          pathRegexCache.set(normalizedPath, regex);
        }

        if (hasMatchingPath || scanningPaths.some((p) => regex.test(p))) {
          /** @type {FileHandleItem[]} */
          const subdirFileHandles = [];

          items.push(subdirFileHandles);
          subdirectories.push({
            handle: /** @type {FileSystemDirectoryHandle} */ (handle),
            path,
            fileHandles: subdirFileHandles,
          });
        }
      }
    }
  });

  await Promise.all(
    subdirectories.map(({ handle, path, fileHandles: subdirFileHandles }) =>
      scanDir(handle, { ...context, fileHandles: subdirFileHandles }, path),
    ),
  );

  items.forEach((item) => {
    // Appended one by one, as spreading a long list into `push()` can overflow the call stack
    (Array.isArray(item) ? item : [item]).forEach((fileHandle) => {
      fileHandles.push(fileHandle);
    });
  });
};

/**
 * Collect all scanning paths from entry and asset folders.
 * @returns {string[]} Unique list of scanning paths, without leading and trailing slashes, in
 * Unicode normalization form C.
 */
export const collectScanningPaths = () => {
  const { filePaths, folderPaths } = collectConfiguredPaths();

  return unique([...filePaths, ...folderPaths].map((path) => stripSlashes(path).normalize()));
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
