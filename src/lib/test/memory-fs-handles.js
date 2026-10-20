/* eslint-disable jsdoc/require-jsdoc */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Check a file or directory name the way the File System API does.
 * @param {string} name Name.
 * @throws {TypeError} If the name is invalid.
 */
const validateName = (name) => {
  if (!name || name === '.' || name === '..' || name.includes('/')) {
    throw new TypeError(`Invalid name: ${name}`);
  }
};

/**
 * Convert the data written to a file to bytes.
 * @param {any} data String, `Blob`, `ArrayBuffer` or typed array.
 * @returns {Promise<Uint8Array>} Bytes.
 */
const toBytes = async (data) => {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }

  if (data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }

  // A copy, so the file doesn’t change with the given buffer, e.g. a pooled Node `Buffer`
  return ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice()
    : new Uint8Array(data).slice();
};

/**
 * Create a `FileSystemDirectoryHandle` that keeps its files in memory and compares names byte for
 * byte, like Linux ext4 and the origin private file system do, unlike macOS, which ignores the
 * Unicode normalization. A file named in normalization form D isn’t found by its name in form C,
 * and the two can be in the same directory.
 * @param {string} [name] Directory name.
 * @returns {FileSystemDirectoryHandle & { children: Map<string, any> }} Handle, with its entries
 * keyed by name.
 */
export const createMemoryDirectoryHandle = (name = 'root') => {
  /** @type {Map<string, any>} */
  const children = new Map();

  /**
   * Create a file handle in this directory.
   * @param {string} fileName File name.
   * @returns {any} Handle.
   */
  const createFile = (fileName) => {
    const file = {
      kind: 'file',
      name: fileName,
      bytes: new Uint8Array(),
      lastModified: Date.now(),
      parent: children,
      getFile: async () =>
        new File([/** @type {any} */ (file.bytes)], file.name, {
          lastModified: file.lastModified,
        }),
      createWritable: async ({ keepExistingData = false } = {}) => {
        let buffer = keepExistingData ? file.bytes : new Uint8Array();

        return {
          write: async (/** @type {any} */ chunk) => {
            const isParams = chunk?.type === 'write';
            const bytes = await toBytes(isParams ? chunk.data : chunk);
            const position = isParams ? (chunk.position ?? buffer.length) : buffer.length;
            const next = new Uint8Array(Math.max(buffer.length, position + bytes.length));

            next.set(buffer);
            next.set(bytes, position);
            buffer = next;
          },
          // Like Chrome, the file is only replaced once the stream is closed
          close: async () => {
            file.bytes = buffer;
            file.lastModified = Date.now();
          },
          abort: async () => {},
        };
      },
      move: async (/** @type {any} */ dirHandle, /** @type {string} */ newName) => {
        validateName(newName);
        file.parent.delete(file.name);
        file.name = newName;
        file.parent = dirHandle.children;
        dirHandle.children.set(newName, file);
      },
      isSameEntry: async (/** @type {any} */ other) => other === file,
    };

    return file;
  };

  const handle = {
    kind: 'directory',
    name,
    children,
    getFileHandle: async (/** @type {string} */ fileName, { create = false } = {}) => {
      validateName(fileName);

      const child = children.get(fileName);

      if (child) {
        if (child.kind !== 'file') {
          throw new DOMException(`Not a file: ${fileName}`, 'TypeMismatchError');
        }

        return child;
      }

      if (!create) {
        throw new DOMException(`Not found: ${fileName}`, 'NotFoundError');
      }

      const file = createFile(fileName);

      children.set(fileName, file);

      return file;
    },
    getDirectoryHandle: async (/** @type {string} */ dirName, { create = false } = {}) => {
      validateName(dirName);

      const child = children.get(dirName);

      if (child) {
        if (child.kind !== 'directory') {
          throw new DOMException(`Not a directory: ${dirName}`, 'TypeMismatchError');
        }

        return child;
      }

      if (!create) {
        throw new DOMException(`Not found: ${dirName}`, 'NotFoundError');
      }

      const dir = createMemoryDirectoryHandle(dirName);

      children.set(dirName, dir);

      return dir;
    },
    removeEntry: async (/** @type {string} */ entryName, { recursive = false } = {}) => {
      validateName(entryName);

      const child = children.get(entryName);

      if (!child) {
        throw new DOMException(`Not found: ${entryName}`, 'NotFoundError');
      }

      if (child.kind === 'directory' && child.children.size && !recursive) {
        throw new DOMException(`Not empty: ${entryName}`, 'InvalidModificationError');
      }

      children.delete(entryName);
    },
    keys: async function* keys() {
      yield* [...children.keys()];
    },
    values: async function* values() {
      yield* [...children.values()];
    },
    entries: async function* entries() {
      yield* [...children.entries()];
    },
    isSameEntry: async (/** @type {any} */ other) => other === handle,
  };

  return /** @type {any} */ (handle);
};

/**
 * Write a file in a memory directory, creating the directories on its path. Each segment of the
 * path is used as it’s spelled, so a name in Unicode normalization form D stays in form D.
 * @param {FileSystemDirectoryHandle} rootDirHandle Root directory handle.
 * @param {string} path File path.
 * @param {string | Uint8Array} content Content.
 */
export const writeMemoryFile = async (rootDirHandle, path, content) => {
  const segments = path.split('/');
  const fileName = /** @type {string} */ (segments.pop());
  let dirHandle = rootDirHandle;

  // eslint-disable-next-line no-restricted-syntax
  for (const segment of segments) {
    // eslint-disable-next-line no-await-in-loop
    dirHandle = await dirHandle.getDirectoryHandle(segment, { create: true });
  }

  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await /** @type {any} */ (fileHandle).createWritable();

  await writable.write(/** @type {any} */ (content));
  await writable.close();
};

/**
 * List the files in a memory directory with their content, to check what has been written.
 * @param {FileSystemDirectoryHandle} dirHandle Directory handle.
 * @param {object} [options] Options.
 * @param {string} [options.prefix] Path of the directory, with a trailing slash.
 * @param {(path: string) => boolean} [options.filter] Function to pick the paths to list.
 * @returns {Promise<Record<string, string>>} Text content keyed by path, as spelled in the
 * directory.
 */
export const readMemoryFiles = async (dirHandle, { prefix = '', filter = () => true } = {}) => {
  /** @type {Record<string, string>} */
  const files = {};

  // eslint-disable-next-line no-restricted-syntax
  for (const [name, child] of /** @type {any} */ (dirHandle).children) {
    const path = `${prefix}${name}`;

    if (child.kind === 'directory') {
      // eslint-disable-next-line no-await-in-loop
      Object.assign(files, await readMemoryFiles(child, { prefix: `${path}/`, filter }));
    } else if (filter(path)) {
      // eslint-disable-next-line no-await-in-loop
      files[path] = await (await child.getFile()).text();
    }
  }

  return files;
};

/**
 * Copy a directory on the disk into a memory directory, e.g. a Git repository created with the
 * `git` command, so the code under test can work with it on a file system that compares names byte
 * for byte.
 * @param {string} path Absolute path of the directory on the disk.
 * @param {FileSystemDirectoryHandle} [dirHandle] Memory directory to copy to.
 * @returns {Promise<FileSystemDirectoryHandle & { children: Map<string, any> }>} Memory directory.
 */
export const copyToMemory = async (path, dirHandle = createMemoryDirectoryHandle()) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const name of readdirSync(path)) {
    const childPath = join(path, name);

    if (statSync(childPath).isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      await copyToMemory(childPath, await dirHandle.getDirectoryHandle(name, { create: true }));
    } else {
      // eslint-disable-next-line no-await-in-loop
      await writeMemoryFile(dirHandle, name, readFileSync(childPath));
    }
  }

  return /** @type {any} */ (dirHandle);
};

/**
 * Copy a memory directory to a directory on the disk, e.g. to check a Git repository with the `git`
 * command once the code under test has changed it. The names are written as they’re spelled, so
 * the memory directory mustn’t have two that macOS takes for the same.
 * @param {FileSystemDirectoryHandle} dirHandle Memory directory.
 * @param {string} path Absolute path of the directory on the disk, which is created if needed.
 */
export const copyFromMemory = async (dirHandle, path) => {
  mkdirSync(path, { recursive: true });

  // eslint-disable-next-line no-restricted-syntax
  for (const [name, child] of /** @type {any} */ (dirHandle).children) {
    const childPath = join(path, name);

    if (child.kind === 'directory') {
      // eslint-disable-next-line no-await-in-loop
      await copyFromMemory(child, childPath);
    } else {
      // eslint-disable-next-line no-await-in-loop
      writeFileSync(childPath, new Uint8Array(await (await child.getFile()).arrayBuffer()));
    }
  }
};
