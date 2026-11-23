/* eslint-disable jsdoc/require-jsdoc */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';

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
 * Create a `FileSystemFileHandle` for a file on the disk, for testing code that uses the File
 * System Access API against real files. Like Chrome, a writable stream only replaces the file once
 * it’s closed.
 * @param {string} path Absolute path of the file.
 * @returns {FileSystemFileHandle} Handle.
 */
export const createNodeFileHandle = (path) =>
  /** @type {any} */ ({
    kind: 'file',
    name: basename(path),
    getFile: async () => {
      if (!existsSync(path)) {
        throw new DOMException(`Not found: ${path}`, 'NotFoundError');
      }

      return new File([readFileSync(path)], basename(path), {
        lastModified: statSync(path).mtimeMs,
      });
    },
    createWritable: async ({ keepExistingData = false } = {}) => {
      let buffer = keepExistingData ? readFileSync(path) : Buffer.alloc(0);
      let cursor = 0;

      return {
        write: async (/** @type {any} */ chunk) => {
          const isParams = chunk?.type === 'write';
          const position = isParams ? (chunk.position ?? cursor) : cursor;
          const data = isParams ? chunk.data : chunk;

          const bytes =
            typeof data === 'string'
              ? Buffer.from(data)
              : Buffer.from(data instanceof Blob ? await data.arrayBuffer() : data);

          if (buffer.length < position + bytes.length) {
            buffer = Buffer.concat([buffer, Buffer.alloc(position + bytes.length - buffer.length)]);
          }

          bytes.copy(buffer, position);
          cursor = position + bytes.length;
        },
        close: async () => {
          writeFileSync(path, buffer);
        },
        abort: async () => {},
      };
    },
  });

/**
 * Create a `FileSystemDirectoryHandle` for a directory on the disk, for testing code that uses the
 * File System Access API against real files, e.g. a Git repository created with the `git` command.
 * @param {string} path Absolute path of the directory.
 * @returns {FileSystemDirectoryHandle} Handle.
 */
export const createNodeDirectoryHandle = (path) => {
  /**
   * Get the handle of an entry in the directory.
   * @param {string} name Entry name.
   * @returns {FileSystemFileHandle | FileSystemDirectoryHandle} Handle.
   */
  const getChild = (name) => {
    const childPath = join(path, name);

    return statSync(childPath).isDirectory()
      ? createNodeDirectoryHandle(childPath)
      : createNodeFileHandle(childPath);
  };

  return /** @type {any} */ ({
    kind: 'directory',
    name: basename(path),
    getDirectoryHandle: async (/** @type {string} */ name, { create = false } = {}) => {
      validateName(name);

      const childPath = join(path, name);

      if (existsSync(childPath)) {
        if (!statSync(childPath).isDirectory()) {
          throw new DOMException(`Not a directory: ${childPath}`, 'TypeMismatchError');
        }
      } else if (create) {
        mkdirSync(childPath);
      } else {
        throw new DOMException(`Not found: ${childPath}`, 'NotFoundError');
      }

      return createNodeDirectoryHandle(childPath);
    },
    getFileHandle: async (/** @type {string} */ name, { create = false } = {}) => {
      validateName(name);

      const childPath = join(path, name);

      if (existsSync(childPath)) {
        if (statSync(childPath).isDirectory()) {
          throw new DOMException(`Not a file: ${childPath}`, 'TypeMismatchError');
        }
      } else if (create) {
        writeFileSync(childPath, '');
      } else {
        throw new DOMException(`Not found: ${childPath}`, 'NotFoundError');
      }

      return createNodeFileHandle(childPath);
    },
    removeEntry: async (/** @type {string} */ name, { recursive = false } = {}) => {
      validateName(name);

      const childPath = join(path, name);

      if (!existsSync(childPath)) {
        throw new DOMException(`Not found: ${childPath}`, 'NotFoundError');
      }

      if (statSync(childPath).isDirectory() && !recursive && readdirSync(childPath).length) {
        throw new DOMException(`Not empty: ${childPath}`, 'InvalidModificationError');
      }

      rmSync(childPath, { recursive: true });
    },
    keys: async function* keys() {
      yield* readdirSync(path);
    },
    values: async function* values() {
      yield* readdirSync(path).map(getChild);
    },
    entries: async function* entries() {
      yield* readdirSync(path).map((name) => [name, getChild(name)]);
    },
  });
};
