/* eslint-disable no-restricted-syntax */

import { stripSlashes } from '@sveltia/utils/string';

import { getRootDir } from '$lib/services/backends/root-dir';

/**
 * Check if the given error says a file or directory doesn’t exist.
 * @param {unknown} ex Error.
 * @returns {boolean} `true` for a `NotFoundError`.
 */
export const isNotFoundError = (ex) => /** @type {DOMException} */ (ex)?.name === 'NotFoundError';

/**
 * Check if the given error says a file was expected where there’s a directory, or the other way
 * round.
 * @param {unknown} ex Error.
 * @returns {boolean} `true` for a `TypeMismatchError`.
 */
export const isTypeMismatchError = (ex) =>
  /** @type {DOMException} */ (ex)?.name === 'TypeMismatchError';

/**
 * Check if a file or folder name can be spelled in more than one Unicode normalization form, like
 * `café`, whose `é` is one character in form C and two in form D.
 * @param {string} name Name or path.
 * @returns {boolean} Result.
 */
export const hasOtherSpellings = (name) => name.normalize('NFC') !== name.normalize('NFD');

/**
 * Pick the name a file or folder has among the names of the entries in a directory, which can be
 * spelled in another Unicode normalization form than the given one. The exact spelling wins.
 * @param {string[]} names Names of the entries in the directory.
 * @param {string} name Name to look for.
 * @returns {string | undefined} Name of the file or folder in the directory, or `undefined` if
 * there’s none.
 */
export const pickEntryName = (names, name) => {
  if (names.includes(name)) {
    return name;
  }

  const normalizedName = name.normalize();

  return names.find((entryName) => entryName.normalize() === normalizedName);
};

/**
 * Find the name a file or folder has in a directory, which can be spelled in another Unicode
 * normalization form than the given one. The CMS works with names in form C, while a file added on
 * Linux, or by a program on macOS, can have a name in form D, and a file system that compares names
 * byte for byte, like ext4, NTFS or the origin private file system, wouldn’t find the file by the
 * other spelling. On macOS, which ignores the normalization, the name is found as it is.
 * @param {FileSystemDirectoryHandle} dirHandle Directory handle.
 * @param {string} name Name.
 * @returns {Promise<string>} Name of the file or folder in the directory, or the given name if
 * there’s none.
 */
export const findEntryName = async (dirHandle, name) => {
  if (!hasOtherSpellings(name)) {
    return name;
  }

  try {
    await dirHandle.getFileHandle(name);

    return name;
  } catch (ex) {
    if (isTypeMismatchError(ex)) {
      // It’s a folder
      return name;
    }

    if (!isNotFoundError(ex)) {
      throw ex;
    }
  }

  return pickEntryName(await Array.fromAsync(dirHandle.keys()), name) ?? name;
};

/**
 * Get a file or directory handle at the given path. A file or folder whose name is spelled in
 * another Unicode normalization form is found too, and a missing one is created with the given
 * spelling.
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

  for await (const [index, part] of pathParts.entries()) {
    const name = await findEntryName(/** @type {FileSystemDirectoryHandle} */ (handle), part);

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

/**
 * Read a file at the given path, if it exists.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string} path Path to the file.
 * @returns {Promise<File | undefined>} File, or `undefined` if it doesn’t exist.
 * @throws {Error} If the file can’t be read for any other reason.
 */
export const readFileIfExists = async (rootDirHandle, path) => {
  try {
    return await readFile(rootDirHandle, path);
  } catch (ex) {
    if (isNotFoundError(ex)) {
      return undefined;
    }

    throw ex;
  }
};

/**
 * Get the handle of the directory the CMS treats as the root of the repository, configured with the
 * `root_dir` backend option, so every path read or written through it is relative to that
 * directory.
 * @param {FileSystemDirectoryHandle} repoRootDirHandle Handle of the repository’s root directory.
 * @param {object} [options] Options.
 * @param {boolean} [options.create] Whether to create the directory if it doesn’t exist. Default:
 * `false`.
 * @returns {Promise<FileSystemDirectoryHandle>} Handle of the configured root directory, or the
 * given handle itself when the option isn’t set.
 * @throws {Error} If the directory doesn’t exist and `create` is `false`.
 */
export const getScopedRootDirHandle = async (repoRootDirHandle, { create = false } = {}) =>
  /** @type {Promise<FileSystemDirectoryHandle>} */ (
    getHandleByPath(repoRootDirHandle, getRootDir(), 'directory', { create })
  );
