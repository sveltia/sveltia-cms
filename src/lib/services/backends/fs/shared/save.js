/* eslint-disable no-await-in-loop */

/* eslint-disable no-restricted-syntax */

import { getPathInfo } from '@sveltia/utils/file';
import { sleep } from '@sveltia/utils/misc';
import { stripSlashes } from '@sveltia/utils/string';

import { TEMP_FILE_PREFIX } from '$lib/services/backends/fs/shared/constants';
import {
  getDirectoryHandle,
  getFileHandle,
  getHandleByPath,
} from '$lib/services/backends/fs/shared/handles';
import { env } from '$lib/services/user/env.svelte';
import { getBlob, getGitHash } from '$lib/services/utils/file';

/**
 * @import {
 * CommitResults,
 * FileChange,
 * } from '$lib/types/private';
 */

/**
 * How many times renaming a temporary file to its final name is attempted, and how long to wait
 * between attempts, in milliseconds. A rename can fail for a moment while another program has the
 * file open, e.g. an antivirus scanner or a dev server’s file watcher reading the new file.
 */
const RENAME_ATTEMPTS = 3;
const RENAME_RETRY_DELAY = 150;

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
 * Rename a file, trying again a few times if the file system won’t let it go right away.
 * @param {FileSystemFileHandle} fileHandle File handle.
 * @param {FileSystemDirectoryHandle} dirHandle Directory to move the file to.
 * @param {string} name New file name.
 * @throws {Error} The last error, if every attempt fails.
 */
const renameFile = async (fileHandle, dirHandle, name) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      // @ts-ignore
      await fileHandle.move(dirHandle, name);

      return;
    } catch (ex) {
      if (attempt === RENAME_ATTEMPTS) {
        throw ex;
      }

      await sleep(RENAME_RETRY_DELAY * attempt);
    }
  }
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
      const tempPath = `${dirname ? `${dirname}/` : ''}${TEMP_FILE_PREFIX}${crypto.randomUUID()}`;

      fileHandle = await getFileHandle(rootDirHandle, tempPath);
      pendingRename = { dirname, basename };
    } else {
      fileHandle = await getFileHandle(rootDirHandle, path);
    }
  }

  if (!pendingRename) {
    await writeFile(fileHandle, data);

    return fileHandle.getFile();
  }

  const { dirname, basename } = pendingRename;
  const dirHandle = await getDirectoryHandle(rootDirHandle, dirname);

  try {
    await writeFile(fileHandle, data);
    await renameFile(fileHandle, dirHandle, basename);
  } catch (ex) {
    // Don’t leave the temporary file behind; the error is reported to the user, who can retry
    try {
      await dirHandle.removeEntry(fileHandle.name);
    } catch {
      //
    }

    throw ex;
  }

  return fileHandle.getFile();
};

/**
 * Check if the given error says a file or directory doesn’t exist.
 * @param {unknown} ex Error.
 * @returns {boolean} `true` for a `NotFoundError`.
 */
const isNotFoundError = (ex) => /** @type {DOMException} */ (ex)?.name === 'NotFoundError';

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

    try {
      // Don’t bring back a parent directory that has been removed already
      const parentHandle = /** @type {FileSystemDirectoryHandle} */ (
        await getHandleByPath(rootDirHandle, parentPath, 'directory', { create: false })
      );

      const dirHandle = await parentHandle.getDirectoryHandle(dirName);

      // Use for...of to check if directory is empty with early exit on first entry found
      // eslint-disable-next-line no-unreachable-loop
      for await (const _entry of dirHandle.entries()) {
        // Directory is not empty, stop cleanup
        return;
      }

      // Directory is empty, remove it
      await parentHandle.removeEntry(dirName);
    } catch (ex) {
      // A directory that is already gone, e.g. removed outside the CMS, is as good as removed
      if (!isNotFoundError(ex)) {
        throw ex;
      }
    }
  }
};

/**
 * Delete a file at the specified path within the file system. The directory the file was in is left
 * alone even if it’s now empty; {@link deleteEmptyDirs} cleans up once a whole batch of changes has
 * been saved, because the files in a batch are removed all at once, and a directory can’t be
 * removed while another file is being removed from it.
 * @param {object} args Arguments.
 * @param {FileSystemDirectoryHandle} args.rootDirHandle Root directory handle.
 * @param {string} args.path The path to the file to be deleted.
 */
export const deleteFile = async ({ rootDirHandle, path }) => {
  const { dirname: dirPath = '', basename: fileName } = getPathInfo(stripSlashes(path));
  const dirHandle = await getDirectoryHandle(rootDirHandle, dirPath);

  try {
    await dirHandle.removeEntry(fileName);
  } catch (ex) {
    // The file may have been removed outside the CMS, e.g. in a file manager or by a Git branch
    // switch; the point is that it’s gone, so that’s not a failure
    if (!isNotFoundError(ex)) {
      throw ex;
    }
  }
};

/**
 * Delete the given directories, and their parents, if they’re empty. The directories are handled
 * one at a time, because the file system won’t let a directory be removed while it’s being
 * modified.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {Iterable<string>} dirPaths Paths to the directories.
 */
export const deleteEmptyDirs = async (rootDirHandle, dirPaths) => {
  for (const dirPath of new Set(dirPaths)) {
    if (dirPath) {
      await deleteEmptyParentDirs(rootDirHandle, dirPath.split('/'));
    }
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

  // An empty string is still written, as an emptied file mustn’t keep its old content
  if (['create', 'update', 'move'].includes(action) && data !== undefined) {
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
 * Check if a change is to an entry file rather than an asset.
 * @param {FileChange} change File change.
 * @returns {boolean} `true` for an entry file.
 */
const isEntryChange = ({ slug, data }) => slug !== undefined || typeof data === 'string';

/**
 * Save a batch of changes in the file system at the same time.
 * @param {FileSystemDirectoryHandle | undefined} rootDirHandle Root directory handle. If it’s not
 * available, nothing is written, and the in-memory data stands in for the files.
 * @param {FileChange[]} changes File changes to be saved.
 * @returns {Promise<([string, { file: Blob, sha: string }] | null)[]>} Saved files, each with its
 * path and blob SHA, or `null` for a deleted file.
 * @throws {Error} If a file could not be written. The other files in the batch are still written,
 * because they’re already on their way.
 */
const saveChangeBatch = async (rootDirHandle, changes) =>
  Promise.all(
    changes.map(async (change) => {
      const { path, data } = change;
      /** @type {Blob | null} */
      let file = rootDirHandle ? await saveChange(rootDirHandle, change) : null;

      if (!file) {
        if (data === undefined) {
          return null;
        }

        file = getBlob(data);
      }

      return [path, { file, sha: await getGitHash(file) }];
    }),
  );

/**
 * Save entries or assets in the file system.
 *
 * The assets are written first, and the entry files last. The site’s dev server typically watches
 * the content files, and one that reloads the page on a content change — Astro does for content
 * collections — would reload the CMS while the assets are still being written if the entry file
 * went first. That left the images as `.sveltia-tmp-*` files and the draft backup in place.
 *
 * A file that can’t be written fails the whole save, so the user is told rather than left with an
 * entry that refers to files that don’t exist; the CMS keeps the draft, so the save can be retried.
 * @param {FileSystemDirectoryHandle | undefined} rootDirHandle Root directory handle. This can be
 * `undefined` if the directory handle could not be acquired earlier for security reasons. If the
 * handle is not available, the changes will not be saved, but the user can still continue using the
 * app without an error thanks to the in-memory cache.
 * @param {FileChange[]} changes File changes to be saved.
 * @returns {Promise<CommitResults>} Commit results, including a pseudo commit SHA, saved files, and
 * their blob SHAs.
 * @throws {Error} If a file could not be written.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWritableFileStream/write
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/removeEntry
 */
export const saveChanges = async (rootDirHandle, changes) => {
  const assetChanges = changes.filter((change) => !isEntryChange(change));
  const entryChanges = changes.filter(isEntryChange);

  const entries = [
    ...(await saveChangeBatch(rootDirHandle, assetChanges)),
    ...(await saveChangeBatch(rootDirHandle, entryChanges)),
  ];

  if (rootDirHandle) {
    // A directory left empty by the deleted and moved files is removed, as Git doesn’t track empty
    // directories, so the local checkout matches what a Git backend would end up with
    await deleteEmptyDirs(
      rootDirHandle,
      changes
        .map(({ action, path, previousPath }) => {
          if (action === 'delete') {
            return path;
          }

          if (action === 'move' && previousPath) {
            return previousPath;
          }

          return undefined;
        })
        .filter((path) => path !== undefined)
        .map((path) => getPathInfo(stripSlashes(path)).dirname ?? ''),
    );
  }

  return {
    // Use a hash of the current date as a pseudo SHA
    sha: await getGitHash(new Date().toJSON()),
    files: Object.fromEntries(entries.filter((entry) => !!entry)),
  };
};
