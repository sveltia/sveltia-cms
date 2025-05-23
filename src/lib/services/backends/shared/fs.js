/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */

import { unique } from '@sveltia/utils/array';
import { getHash } from '@sveltia/utils/crypto';
import { getPathInfo, readAsText } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { allAssetFolders, allAssets } from '$lib/services/assets';
import { parseAssetFiles } from '$lib/services/assets/parser';
import { createFileList } from '$lib/services/backends/shared/data';
import { allEntries, allEntryFolders, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';
import { createPathRegEx } from '$lib/services/utils/file';

/**
 * @import { BaseFileListItem, FileChange } from '$lib/types/private';
 */

/**
 * Get a file or directory handle at the given path.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string} path Path to the file/directory.
 * @returns {Promise<FileSystemFileHandle | FileSystemDirectoryHandle>} Handle.
 */
export const getHandleByPath = async (rootDirHandle, path) => {
  /** @type {FileSystemFileHandle | FileSystemDirectoryHandle} */
  let handle = rootDirHandle;

  if (!path) {
    return handle;
  }

  const pathParts = stripSlashes(path).split('/');
  const create = true;

  for (const name of pathParts) {
    handle = await (name.includes('.')
      ? /** @type {FileSystemDirectoryHandle} */ (handle).getFileHandle(name, { create })
      : /** @type {FileSystemDirectoryHandle} */ (handle).getDirectoryHandle(name, { create }));
  }

  return handle;
};

/**
 * Retrieve all files under the static directory.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @returns {Promise<BaseFileListItem[]>} File list.
 */
const getAllFiles = async (rootDirHandle) => {
  /** @type {{ file: File, path: string }[]} */
  const availableFileList = [];

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

  /**
   * Get a regular expression that matches the given path, taking template tags into account.
   * @param {string} path Path.
   * @returns {RegExp} RegEx.
   */
  const getRegEx = (path) => createPathRegEx(path, (segment) => segment.replace(/{{.+?}}/, '.+?'));
  const scanningPathsRegEx = scanningPaths.map(getRegEx);

  /**
   * Retrieve all the files under the given directory recursively.
   * @param {FileSystemDirectoryHandle | any} dirHandle Directory handle.
   */
  const iterate = async (dirHandle) => {
    for await (const [name, handle] of dirHandle.entries()) {
      if (name.startsWith('.')) {
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

          // Clone the file immediately to avoid potential permission problems
          file = new File([file], file.name, { type: file.type, lastModified: file.lastModified });

          availableFileList.push({ file, path });
        } catch (/** @type {any} */ ex) {
          // eslint-disable-next-line no-console
          console.error(ex);
        }
      }

      if (handle.kind === 'directory') {
        const regex = getRegEx(path);

        if (!hasMatchingPath && !scanningPaths.some((p) => regex.test(p))) {
          continue;
        }

        await iterate(handle);
      }
    }
  };

  await iterate(rootDirHandle);

  return Promise.all(
    availableFileList.map(async ({ file, path }) => ({
      file,
      // The file path must be normalized, as certain non-ASCII characters (e.g. Japanese) can be
      // problematic particularly on macOS
      path: path.normalize(),
      size: file.size,
      sha: await (async () => {
        try {
          // Need `await` here to catch any exception
          return await getHash(file);
        } catch (/** @type {any} */ ex) {
          // eslint-disable-next-line no-console
          console.error(ex);
        }

        return '';
      })(),
    })),
  );
};

/**
 * Load file list and all the entry files from the file system, then cache them in the
 * {@link allEntries} and {@link allAssets} stores.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 */
export const loadFiles = async (rootDirHandle) => {
  const { entryFiles, assetFiles } = createFileList(await getAllFiles(rootDirHandle));

  // Load all entry text content
  await Promise.all(
    entryFiles.map(async (entryFile) => {
      try {
        entryFile.text = await readAsText(/** @type {File} */ (entryFile.file));
      } catch (/** @type {any} */ ex) {
        entryFile.text = '';
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }),
  );

  const { entries, errors } = await prepareEntries(entryFiles);

  allEntries.set(entries);
  entryParseErrors.set(errors);
  allAssets.set(parseAssetFiles(assetFiles));
  dataLoaded.set(true);
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
    changes.map(async ({ action, path, previousPath, data }) => {
      try {
        /** @type {FileSystemFileHandle | undefined} */
        let fileHandle;

        if (action === 'move' && previousPath) {
          const { dirname, basename } = getPathInfo(path);

          fileHandle = /** @type {FileSystemFileHandle} */ (
            await getHandleByPath(rootDirHandle, previousPath)
          );

          if (dirname && dirname !== getPathInfo(previousPath).dirname) {
            await fileHandle.move(await getHandleByPath(rootDirHandle, dirname), basename);
          } else {
            await fileHandle.move(basename);
          }
        }

        if (['create', 'update', 'move'].includes(action) && data) {
          fileHandle ??= /** @type {FileSystemFileHandle} */ (
            await getHandleByPath(rootDirHandle, path)
          );

          // The `createWritable` method is not yet supported by Safari
          // @see https://bugs.webkit.org/show_bug.cgi?id=254726
          const writer = await fileHandle.createWritable?.();

          try {
            await writer?.write(data);
          } catch {
            // Can throw if the file has just been moved/renamed without any change, and then the
            // `data` is no longer available
          } finally {
            await writer?.close();
          }

          return fileHandle.getFile();
        }

        if (action === 'delete') {
          const { dirname: dirPath = '', basename: fileName } = getPathInfo(stripSlashes(path));

          let dirHandle = /** @type {FileSystemDirectoryHandle} */ (
            await getHandleByPath(rootDirHandle, dirPath)
          );

          await dirHandle.removeEntry(fileName);

          if (!dirPath) {
            return null;
          }

          const dirPathArray = dirPath.split('/');

          // Delete an empty enclosing folder recursively
          for (;;) {
            /** @type {string[]} */
            const keys = [];

            for await (const key of dirHandle.keys()) {
              keys.push(key);
            }

            if (keys.length > 1 || !dirPathArray.length) {
              break;
            }

            const dirName = /** @type {string} */ (dirPathArray.pop());

            // Get the parent directory handle
            dirHandle = /** @type {FileSystemDirectoryHandle} */ (
              await getHandleByPath(rootDirHandle, dirPathArray.join('/'))
            );
            dirHandle.removeEntry(dirName);
          }
        }
      } catch (/** @type {any} */ ex) {
        // eslint-disable-next-line no-console
        console.error(ex);
      }

      return null;
    }),
  );
