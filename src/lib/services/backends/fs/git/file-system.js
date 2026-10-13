/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

/**
 * @import { GitFileSystem, GitFileStats } from '$lib/types/private';
 */

/**
 * Node error codes for the `DOMException` names the File System API throws. Isomorphic-git tells
 * the errors apart by the code, e.g. to create a missing directory or to treat a missing file as
 * nonexistent.
 * @type {Record<string, string>}
 */
const ERROR_CODES = {
  NotFoundError: 'ENOENT',
  TypeMismatchError: 'ENOTDIR',
  InvalidModificationError: 'ENOTEMPTY',
};

/**
 * Create an error that looks like one thrown by Node’s `fs` module.
 * @param {string} code Error code, e.g. `ENOENT`.
 * @param {string} path Path the operation failed on.
 * @returns {Error & { code: string, path: string }} Error.
 */
export const createFileSystemError = (code, path) =>
  Object.assign(new Error(`${code}: ${path}`), { code, path });

/**
 * Convert an error thrown by the File System API to one that looks like Node’s.
 * @param {unknown} ex Error.
 * @param {string} path Path the operation failed on.
 * @returns {unknown} Converted error, or the given error if it has no Node equivalent.
 */
const toFileSystemError = (ex, path) => {
  const code = ERROR_CODES[/** @type {DOMException} */ (ex)?.name];

  return code ? createFileSystemError(code, path) : ex;
};

/**
 * Split a path into its segments, dropping the empty and `.` ones, so `/a//b/./c` becomes
 * `['a', 'b', 'c']`.
 * @param {string} path Path, relative to the root directory, with or without a leading slash.
 * @returns {string[]} Segments.
 */
export const splitPath = (path) => path.split('/').filter((segment) => segment && segment !== '.');

/**
 * Get the handle of a directory.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string[]} segments Path segments of the directory.
 * @returns {Promise<FileSystemDirectoryHandle>} Handle.
 */
const getDirectory = async (rootDirHandle, segments) => {
  let handle = rootDirHandle;

  for (const name of segments) {
    handle = await handle.getDirectoryHandle(name);
  }

  return handle;
};

/**
 * Get the handle of a file or directory, whichever exists at the given path.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string[]} segments Path segments of the file or directory.
 * @returns {Promise<FileSystemFileHandle | FileSystemDirectoryHandle>} Handle.
 */
const getEntry = async (rootDirHandle, segments) => {
  if (!segments.length) {
    return rootDirHandle;
  }

  const parentHandle = await getDirectory(rootDirHandle, segments.slice(0, -1));
  const name = /** @type {string} */ (segments.at(-1));

  try {
    return await parentHandle.getFileHandle(name);
  } catch (ex) {
    if (/** @type {DOMException} */ (ex)?.name !== 'TypeMismatchError') {
      throw ex;
    }

    return parentHandle.getDirectoryHandle(name);
  }
};

/**
 * Open a writable stream to a file.
 * @param {FileSystemFileHandle} handle File handle.
 * @param {string} path File path, for the error.
 * @param {FileSystemCreateWritableOptions} [options] Options.
 * @returns {Promise<FileSystemWritableFileStream>} Stream.
 * @throws {Error} If the browser can’t write files, which an older version of Safari can’t.
 */
const openWritable = async (handle, path, options) => {
  const writable = await handle.createWritable?.(options);

  if (!writable) {
    throw createFileSystemError('ENOTSUP', path);
  }

  return writable;
};

/**
 * Create the stats of a file or directory. The File System API only knows the size and the last
 * modified time, so the other values are zero. Git compares them to the actual ones the next time
 * it checks the working tree, finds the files that were staged here changed, and hashes them again
 * to be sure, which takes a moment but gives the right answer.
 * @param {FileSystemFileHandle | FileSystemDirectoryHandle} handle Handle.
 * @returns {Promise<GitFileStats>} Stats.
 */
const getStats = async (handle) => {
  const isDirectory = handle.kind === 'directory';

  const { size, lastModified } = isDirectory
    ? { size: 0, lastModified: 0 }
    : await /** @type {FileSystemFileHandle} */ (handle).getFile();

  return {
    mode: isDirectory ? 0o40000 : 0o100644,
    size,
    mtimeMs: lastModified,
    ctimeMs: lastModified,
    ino: 0,
    uid: 0,
    gid: 0,
    dev: 0,
    /**
     * Check if it’s a file.
     * @returns {boolean} Result.
     */
    isFile: () => !isDirectory,
    /**
     * Check if it’s a directory.
     * @returns {boolean} Result.
     */
    isDirectory: () => isDirectory,
    /**
     * Check if it’s a symbolic link, which it never is.
     * @returns {boolean} `false`.
     */
    isSymbolicLink: () => false,
  };
};

/**
 * Create a file system that isomorphic-git can work with, on top of a directory the user has picked
 * with the File System Access API. It has the subset of the promise-based API of Node’s `fs` module
 * that isomorphic-git uses. The paths are relative to the directory, which is `/`.
 * @param {FileSystemDirectoryHandle} rootDirHandle Handle of the repository’s root directory.
 * @param {object} context Context.
 * @param {typeof import('buffer').Buffer} context.Buffer `Buffer` class to return the binary file
 * content as, which isomorphic-git requires.
 * @returns {GitFileSystem} File system.
 * @see https://isomorphic-git.org/docs/en/fs
 */
export const createGitFileSystem = (rootDirHandle, { Buffer }) => {
  /**
   * Run a file system operation, converting the error it throws to one that looks like Node’s.
   * @template T
   * @param {string} path Path the operation is for.
   * @param {(segments: string[]) => Promise<T>} operation Operation.
   * @returns {Promise<T>} Result.
   */
  const run = async (path, operation) => {
    try {
      return await operation(splitPath(path));
    } catch (ex) {
      throw toFileSystemError(ex, path);
    }
  };

  /**
   * Get the handle of the parent directory of a file or directory, along with its name.
   * @param {string[]} segments Path segments.
   * @returns {Promise<{ parentHandle: FileSystemDirectoryHandle, name: string }>} Parent handle
   * and name.
   */
  const getParent = async (segments) => ({
    parentHandle: await getDirectory(rootDirHandle, segments.slice(0, -1)),
    name: /** @type {string} */ (segments.at(-1)),
  });

  return {
    /**
     * Read a file.
     * @param {string} path Path.
     * @param {string | { encoding?: string }} [options] Encoding, or options containing it.
     * @returns {Promise<any>} Content: a `Buffer`, or a string if the `utf8` encoding is given.
     */
    readFile: (path, options) =>
      run(path, async (segments) => {
        const handle = await getEntry(rootDirHandle, segments);

        if (handle.kind !== 'file') {
          throw createFileSystemError('EISDIR', path);
        }

        const file = await /** @type {FileSystemFileHandle} */ (handle).getFile();
        const encoding = typeof options === 'string' ? options : options?.encoding;

        return encoding === 'utf8' ? file.text() : Buffer.from(await file.arrayBuffer());
      }),
    /**
     * Write a file, replacing its content. The parent directory must exist.
     * @param {string} path Path.
     * @param {string | Uint8Array} data Content.
     * @returns {Promise<void>} Nothing.
     */
    writeFile: (path, data) =>
      run(path, async (segments) => {
        const { parentHandle, name } = await getParent(segments);
        const handle = await parentHandle.getFileHandle(name, { create: true });
        // The new content replaces the file only once the stream is closed, so a failed write
        // leaves the file as it was
        const writable = await openWritable(handle, path);

        try {
          await writable.write(/** @type {FileSystemWriteChunkType} */ (data));
          await writable.close();
        } catch (ex) {
          // The stream may be unusable already, which mustn’t hide the actual error
          await writable.abort().catch(() => undefined);
          throw ex;
        }
      }),
    /**
     * Add to the end of a file, creating it if needed. The parent directory must exist.
     * @param {string} path Path.
     * @param {string} data Content to add.
     * @returns {Promise<void>} Nothing.
     */
    appendFile: (path, data) =>
      run(path, async (segments) => {
        const { parentHandle, name } = await getParent(segments);
        const handle = await parentHandle.getFileHandle(name, { create: true });
        const { size } = await handle.getFile();
        const writable = await openWritable(handle, path, { keepExistingData: true });

        try {
          await writable.write({ type: 'write', position: size, data });
          await writable.close();
        } catch (ex) {
          // The stream may be unusable already, which mustn’t hide the actual error
          await writable.abort().catch(() => undefined);
          throw ex;
        }
      }),
    /**
     * Create a directory, unless it exists. The parent directory must exist.
     * @param {string} path Path.
     * @returns {Promise<void>} Nothing.
     */
    mkdir: (path) =>
      run(path, async (segments) => {
        const { parentHandle, name } = await getParent(segments);

        await parentHandle.getDirectoryHandle(name, { create: true });
      }),
    /**
     * Remove an empty directory.
     * @param {string} path Path.
     * @returns {Promise<void>} Nothing.
     */
    rmdir: (path) =>
      run(path, async (segments) => {
        const { parentHandle, name } = await getParent(segments);

        // Make sure it’s a directory, as `removeEntry()` would remove a file just as well
        await parentHandle.getDirectoryHandle(name);
        await parentHandle.removeEntry(name);
      }),
    /**
     * Remove a file.
     * @param {string} path Path.
     * @returns {Promise<void>} Nothing.
     */
    unlink: (path) =>
      run(path, async (segments) => {
        const { parentHandle, name } = await getParent(segments);

        // Make sure it’s a file, as `removeEntry()` would remove an empty directory just as well
        await parentHandle.getFileHandle(name);
        await parentHandle.removeEntry(name);
      }),
    /**
     * List the names in a directory.
     * @param {string} path Path.
     * @returns {Promise<string[]>} Names.
     */
    readdir: (path) =>
      run(path, async (segments) => {
        const handle = await getEntry(rootDirHandle, segments);

        if (handle.kind !== 'directory') {
          throw createFileSystemError('ENOTDIR', path);
        }

        /** @type {string[]} */
        const names = [];

        for await (const name of /** @type {FileSystemDirectoryHandle} */ (handle).keys()) {
          names.push(name);
        }

        return names;
      }),
    /**
     * Get the stats of a file or directory.
     * @param {string} path Path.
     * @returns {Promise<GitFileStats>} Stats.
     */
    stat: (path) =>
      run(path, async (segments) => getStats(await getEntry(rootDirHandle, segments))),
    /**
     * Get the stats of a file or directory, the same as `stat`, as there are no symbolic links.
     * @param {string} path Path.
     * @returns {Promise<GitFileStats>} Stats.
     */
    lstat: (path) =>
      run(path, async (segments) => getStats(await getEntry(rootDirHandle, segments))),
    /**
     * Read a symbolic link, which isn’t supported.
     * @param {string} path Path.
     * @returns {Promise<never>} Never.
     */
    readlink: async (path) => {
      throw createFileSystemError('ENOTSUP', path);
    },
    /**
     * Create a symbolic link, which isn’t supported.
     * @param {string} _target Target.
     * @param {string} path Path.
     * @returns {Promise<never>} Never.
     */
    symlink: async (_target, path) => {
      throw createFileSystemError('ENOTSUP', path);
    },
  };
};

/**
 * Check if an error thrown by the file system says a file or directory doesn’t exist.
 * @param {unknown} ex Error.
 * @returns {boolean} Result.
 */
export const isMissingError = (ex) => ['ENOENT', 'ENOTDIR'].includes(/** @type {any} */ (ex)?.code);

/**
 * Check if a file or directory exists.
 * @param {GitFileSystem} fs File system.
 * @param {string} path Path.
 * @returns {Promise<boolean>} Result.
 * @throws {Error} If it can’t be told, e.g. the parent directory can’t be read.
 */
export const exists = async (fs, path) => {
  try {
    await fs.stat(path);

    return true;
  } catch (ex) {
    if (isMissingError(ex)) {
      return false;
    }

    throw ex;
  }
};
