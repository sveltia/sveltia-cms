/* eslint-disable no-restricted-syntax */

import { stripSlashes } from '@sveltia/utils/string';

/**
 * Get a file or directory handle at the given path.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string | undefined} path Path to the file/directory.
 * @param {'file' | 'directory'} [type] Type of the handle to retrieve.
 * @param {object} [options] Options.
 * @param {boolean} [options.create] Whether to create the file/directory, along with any missing
 * parent directory, if it doesn’t exist. Default: `true`.
 * @returns {Promise<FileSystemFileHandle | FileSystemDirectoryHandle>} Handle.
 * @throws {Error} If the path is empty and the type is `file`, or if the file/directory doesn’t
 * exist and `create` is `false`.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getFileHandle
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle
 */
export const getHandleByPath = async (
  rootDirHandle,
  path,
  type = 'file',
  { create = true } = {},
) => {
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
 * Read a file at the given path.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string} path Path to the file.
 * @returns {Promise<File>} File.
 * @throws {Error} If the file doesn’t exist.
 */
export const readFile = async (rootDirHandle, path) => {
  const handle = /** @type {FileSystemFileHandle} */ (
    await getHandleByPath(rootDirHandle, path, 'file', { create: false })
  );

  return handle.getFile();
};
