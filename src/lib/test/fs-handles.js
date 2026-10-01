/* eslint-disable jsdoc/require-jsdoc */

import { vi } from 'vitest';

/**
 * Mock FileSystemFileHandle implementation for testing.
 * @param {string} name Handle name.
 * @returns {FileSystemFileHandle} Mock file handle.
 */
export const createMockFileHandle = (name) => ({
  name,
  kind: 'file',
  getFile: vi.fn(async () => new File(['mock content'], name)),
  move: vi.fn(),
  isSameEntry: vi.fn(async () => false),
});

/**
 * Create an `entries()` implementation for a mock directory handle holding one entry, which
 * represents a directory that is not empty.
 * @param {string} name Name of the entry.
 * @returns {any} `entries()` implementation.
 */
export const createDirEntries = (name) => () => ({
  async *[Symbol.asyncIterator]() {
    yield [name, {}];
  },
});

/**
 * Mock FileSystemDirectoryHandle implementation for testing.
 * @param {string} name Handle name.
 * @param {Map<string, any>} children Child handles.
 * @returns {FileSystemDirectoryHandle} Mock directory handle.
 */
export const createMockDirectoryHandle = (name = 'root', children = new Map()) => ({
  name,
  kind: 'directory',
  getFileHandle: vi.fn(async (fileName, options = {}) => {
    const child = children.get(fileName);

    if (child && child.kind === 'file') {
      return child;
    }

    if (options.create) {
      const newFileHandle = createMockFileHandle(fileName);

      children.set(fileName, newFileHandle);

      return newFileHandle;
    }

    throw new Error(`File not found: ${fileName}`);
  }),
  getDirectoryHandle: vi.fn(async (dirName, options = {}) => {
    const child = children.get(dirName);

    if (child && child.kind === 'directory') {
      return child;
    }

    if (options.create) {
      const newDirHandle = createMockDirectoryHandle(dirName, new Map());

      children.set(dirName, newDirHandle);

      return newDirHandle;
    }

    throw new Error(`Directory not found: ${dirName}`);
  }),
  removeEntry: vi.fn(),
  resolve: vi.fn(async () => ['mocked', 'path', 'segments']),
  entries: vi.fn(),
  keys: vi.fn(),
  values: vi.fn(),
  requestPermission: vi.fn(),
  isSameEntry: vi.fn(async () => false),
  [Symbol.asyncIterator]: vi.fn(),
});

/**
 * Mock directory handle whose `entries()` and `removeEntry()` reflect its children, so a directory
 * tree can be changed by the code under test and checked afterwards. A file handle in it moves
 * between the directories of the tree.
 * @param {string} name Handle name.
 * @param {Map<string, any>} [children] Child handles.
 * @returns {FileSystemDirectoryHandle} Mock directory handle.
 */
export const createLiveDirectoryHandle = (name, children = new Map()) => {
  const handle = createMockDirectoryHandle(name, children);

  // @ts-ignore - Mock async iterator
  handle.entries = vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      yield* children.entries();
    },
  }));

  // @ts-ignore - Mock removal
  handle.removeEntry = vi.fn(async (/** @type {string} */ entryName) => {
    if (!children.has(entryName)) {
      throw new DOMException('Not found', 'NotFoundError');
    }

    children.delete(entryName);
  });

  // A subdirectory created along the way is live as well, and a missing one is reported the way
  // the File System API does
  // @ts-ignore - Mock retrieval
  handle.getDirectoryHandle = vi.fn(
    async (/** @type {string} */ dirName, /** @type {any} */ options = {}) => {
      const child = children.get(dirName);

      if (child?.kind === 'directory') {
        return child;
      }

      if (options.create) {
        const newDirHandle = createLiveDirectoryHandle(dirName);

        children.set(dirName, newDirHandle);

        return newDirHandle;
      }

      throw new DOMException(`Directory not found: ${dirName}`, 'NotFoundError');
    },
  );

  children.forEach((child, childName) => {
    if (child.kind === 'file') {
      child.move = vi.fn(async (/** @type {any} */ dirHandle, /** @type {string} */ newName) => {
        children.delete(childName);
        dirHandle.children.set(newName, child);
      });
    }
  });

  // @ts-ignore - Exposed for `move`
  handle.children = children;

  return handle;
};

/**
 * Build a mock directory tree of `static/images/<folder>` holding the given files.
 * @param {string} folder Folder name.
 * @param {string[]} fileNames File names.
 * @returns {{ rootDirHandle: FileSystemDirectoryHandle, imagesDir: FileSystemDirectoryHandle }}
 * Root and `static/images` directory handles.
 */
export const createImageTree = (folder, fileNames) => {
  const folderDir = createLiveDirectoryHandle(
    folder,
    new Map(fileNames.map((fileName) => [fileName, createMockFileHandle(fileName)])),
  );

  const imagesDir = createLiveDirectoryHandle('images', new Map([[folder, folderDir]]));
  const staticDir = createLiveDirectoryHandle('static', new Map([['images', imagesDir]]));
  const rootDirHandle = createLiveDirectoryHandle('root', new Map([['static', staticDir]]));

  return { rootDirHandle, imagesDir };
};
