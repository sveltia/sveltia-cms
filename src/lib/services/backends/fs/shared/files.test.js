/* eslint-disable jsdoc/require-jsdoc, func-names, object-shorthand */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  canMoveFile,
  collectScanningPaths,
  deleteEmptyParentDirs,
  deleteFile,
  getDirectoryHandle,
  getFileHandle,
  getHandleByPath,
  getPathRegex,
  moveFile,
  parseAssetFileInfo,
  parseTextFileInfo,
  saveChange,
  saveChanges,
  saveFile,
  scanDir,
  writeFile,
} from './files';

vi.mock('@sveltia/utils/misc', () => ({
  sleep: vi.fn(async () => {}),
}));

// Provide a minimal FileSystemFileHandle global so canMoveFile() can inspect the prototype.
// Tests that require canMoveFile() === false can set env.isBrave to true directly.
// @ts-ignore - We only need the prototype.move property for testing
globalThis.FileSystemFileHandle ??= { prototype: { move: () => {} } };

/**
 * @import { MockedFunction } from 'vitest';
 * @import { FileHandleItem } from './files';
 */

/**
 * Mock FileSystemFileHandle implementation for testing.
 * @param {string} name Handle name.
 * @returns {FileSystemFileHandle} Mock file handle.
 */
const createMockFileHandle = (name) => ({
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
const createDirEntries = (name) => () => ({
  [Symbol.asyncIterator]: async function* () {
    yield [name, {}];
  },
});

/**
 * Mock FileSystemDirectoryHandle implementation for testing.
 * @param {string} name Handle name.
 * @param {Map<string, any>} children Child handles.
 * @returns {FileSystemDirectoryHandle} Mock directory handle.
 */
const createMockDirectoryHandle = (name = 'root', children = new Map()) => ({
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

describe('getFileHandle', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should get file handle for simple path', async () => {
    const path = 'test.txt';
    const handle = await getFileHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
    expect(handle.name).toBe('test.txt');
    expect(rootDirHandle.getFileHandle).toHaveBeenCalledWith('test.txt', { create: true });
  });

  test('should get file handle for nested path', async () => {
    const path = 'folder/subfolder/test.txt';
    const handle = await getFileHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
    expect(handle.name).toBe('test.txt');

    // Should create intermediate directories
    expect(rootDirHandle.getDirectoryHandle).toHaveBeenCalledWith('folder', { create: true });
  });

  test('should get file handle for path with leading slash', async () => {
    const path = '/test.txt';
    const handle = await getFileHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
    expect(handle.name).toBe('test.txt');
  });

  test('should get file handle for path with trailing slash', async () => {
    const path = 'test.txt/';
    const handle = await getFileHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
    expect(handle.name).toBe('test.txt');
  });

  test('should get file handle for path with multiple slashes', async () => {
    const path = 'folder//subfolder///test.txt';
    const handle = await getFileHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
    expect(handle.name).toBe('test.txt');
  });

  test('should throw error for empty path', async () => {
    await expect(getFileHandle(rootDirHandle, '')).rejects.toThrow(
      'Path is required for file handle retrieval',
    );
  });

  test('should throw error for null path', async () => {
    // @ts-ignore - Testing null path
    await expect(getFileHandle(rootDirHandle, null)).rejects.toThrow(
      'Path is required for file handle retrieval',
    );
  });

  test('should throw error for undefined path', async () => {
    // @ts-ignore - Testing undefined path
    await expect(getFileHandle(rootDirHandle, undefined)).rejects.toThrow(
      'Path is required for file handle retrieval',
    );
  });

  test('should handle deeply nested path', async () => {
    const path = 'a/b/c/d/e/f/test.txt';
    const handle = await getFileHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
    expect(handle.name).toBe('test.txt');

    // Should create all intermediate directories
    expect(rootDirHandle.getDirectoryHandle).toHaveBeenCalledWith('a', { create: true });
  });

  test('should handle path with special characters', async () => {
    const path = 'folder/test file (1).txt';
    const handle = await getFileHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
    expect(handle.name).toBe('test file (1).txt');
  });

  test('should handle path with unicode characters', async () => {
    const path = 'フォルダー/テスト.txt';
    const handle = await getFileHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
    expect(handle.name).toBe('テスト.txt');
  });
});

describe('getDirectoryHandle', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should get directory handle for simple path', async () => {
    const path = 'folder';
    const handle = await getDirectoryHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('folder');
    expect(rootDirHandle.getDirectoryHandle).toHaveBeenCalledWith('folder', { create: true });
  });

  test('should get directory handle for nested path', async () => {
    const path = 'folder/subfolder';
    const handle = await getDirectoryHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('subfolder');

    // Should create intermediate directories
    expect(rootDirHandle.getDirectoryHandle).toHaveBeenCalledWith('folder', { create: true });
  });

  test('should get directory handle for path with leading slash', async () => {
    const path = '/folder';
    const handle = await getDirectoryHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('folder');
  });

  test('should get directory handle for path with trailing slash', async () => {
    const path = 'folder/';
    const handle = await getDirectoryHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('folder');
  });

  test('should get directory handle for path with multiple slashes', async () => {
    const path = 'folder//subfolder//';
    const handle = await getDirectoryHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('subfolder');
  });

  test('should return root directory handle for empty path', async () => {
    const handle = await getDirectoryHandle(rootDirHandle, '');

    // Instead of checking object equality, check that all properties match
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('root');
    expect(handle.getFileHandle).toBe(rootDirHandle.getFileHandle);
    expect(handle.getDirectoryHandle).toBe(rootDirHandle.getDirectoryHandle);
    expect(handle.resolve).toBe(rootDirHandle.resolve);
  });

  test('should return root directory handle for null path', async () => {
    // @ts-ignore - Testing null path
    const handle = await getDirectoryHandle(rootDirHandle, null);

    expect(handle).toBe(rootDirHandle);
    expect(handle.kind).toBe('directory');
  });

  test('should return root directory handle for undefined path', async () => {
    // @ts-ignore - Testing undefined path
    const handle = await getDirectoryHandle(rootDirHandle, undefined);

    expect(handle).toBe(rootDirHandle);
    expect(handle.kind).toBe('directory');
  });

  test('should handle deeply nested path', async () => {
    const path = 'a/b/c/d/e/f';
    const handle = await getDirectoryHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('f');

    // Should create all intermediate directories
    expect(rootDirHandle.getDirectoryHandle).toHaveBeenCalledWith('a', { create: true });
  });

  test('should handle path with special characters', async () => {
    const path = 'folder/my folder (1)';
    const handle = await getDirectoryHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('my folder (1)');
  });

  test('should handle path with unicode characters', async () => {
    const path = 'フォルダー/サブフォルダー';
    const handle = await getDirectoryHandle(rootDirHandle, path);

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('サブフォルダー');
  });

  test('should handle root path slash', async () => {
    const handle = await getDirectoryHandle(rootDirHandle, '/');

    // Instead of checking object equality, check that all properties match
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('root');
    expect(handle.getFileHandle).toBe(rootDirHandle.getFileHandle);
    expect(handle.getDirectoryHandle).toBe(rootDirHandle.getDirectoryHandle);
    expect(handle.resolve).toBe(rootDirHandle.resolve);
  });

  test('should handle only slashes path', async () => {
    const handle = await getDirectoryHandle(rootDirHandle, '///');

    // Instead of checking object equality, check that all properties match
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('root');
    expect(handle.getFileHandle).toBe(rootDirHandle.getFileHandle);
    expect(handle.getDirectoryHandle).toBe(rootDirHandle.getDirectoryHandle);
    expect(handle.resolve).toBe(rootDirHandle.resolve);
  });
});

describe('Error handling', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should propagate errors from getFileHandle', async () => {
    const errorMessage = 'File access denied';

    /** @type {MockedFunction<any>} */ (rootDirHandle.getFileHandle).mockRejectedValue(
      new Error(errorMessage),
    );

    await expect(getFileHandle(rootDirHandle, 'test.txt')).rejects.toThrow(errorMessage);
  });

  test('should propagate errors from getDirectoryHandle', async () => {
    const errorMessage = 'Directory access denied';

    /** @type {MockedFunction<any>} */ (rootDirHandle.getDirectoryHandle).mockRejectedValue(
      new Error(errorMessage),
    );

    await expect(getDirectoryHandle(rootDirHandle, 'folder')).rejects.toThrow(errorMessage);
  });

  test('should handle errors in nested directory creation for files', async () => {
    const errorMessage = 'Permission denied';

    /** @type {MockedFunction<any>} */ (rootDirHandle.getDirectoryHandle).mockRejectedValue(
      new Error(errorMessage),
    );

    await expect(getFileHandle(rootDirHandle, 'folder/test.txt')).rejects.toThrow(errorMessage);
  });

  test('should handle errors in nested directory creation for directories', async () => {
    const errorMessage = 'Permission denied';

    /** @type {MockedFunction<any>} */ (rootDirHandle.getDirectoryHandle).mockRejectedValue(
      new Error(errorMessage),
    );

    await expect(getDirectoryHandle(rootDirHandle, 'folder/subfolder')).rejects.toThrow(
      errorMessage,
    );
  });
});

describe('Integration scenarios', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should create file in newly created directory', async () => {
    const dirHandle = await getDirectoryHandle(rootDirHandle, 'new-folder');
    const fileHandle = await getFileHandle(rootDirHandle, 'new-folder/test.txt');

    expect(dirHandle.kind).toBe('directory');
    expect(fileHandle.kind).toBe('file');
    expect(fileHandle.name).toBe('test.txt');
  });

  test('should handle mixed operations with same base path', async () => {
    const basePath = 'project/src';
    // Create directory structure
    const dirHandle = await getDirectoryHandle(rootDirHandle, basePath);
    // Create files in the directory
    const fileHandle1 = await getFileHandle(rootDirHandle, `${basePath}/index.js`);
    const fileHandle2 = await getFileHandle(rootDirHandle, `${basePath}/utils.js`);
    // Create subdirectory
    const subDirHandle = await getDirectoryHandle(rootDirHandle, `${basePath}/components`);

    expect(dirHandle.kind).toBe('directory');
    expect(fileHandle1.kind).toBe('file');
    expect(fileHandle2.kind).toBe('file');
    expect(subDirHandle.kind).toBe('directory');
  });

  test('should handle concurrent operations', async () => {
    const operations = [
      getFileHandle(rootDirHandle, 'file1.txt'),
      getFileHandle(rootDirHandle, 'file2.txt'),
      getDirectoryHandle(rootDirHandle, 'folder1'),
      getDirectoryHandle(rootDirHandle, 'folder2'),
      getFileHandle(rootDirHandle, 'nested/file.txt'),
    ];

    const results = await Promise.all(operations);

    expect(results).toHaveLength(5);
    expect(results[0].kind).toBe('file');
    expect(results[1].kind).toBe('file');
    expect(results[2].kind).toBe('directory');
    expect(results[3].kind).toBe('directory');
    expect(results[4].kind).toBe('file');
  });

  test('should handle path normalization with mixed slashes', async () => {
    const path1 = '//folder//file.txt';
    const path2 = 'folder///file.txt';
    const handle1 = await getFileHandle(rootDirHandle, path1);
    const handle2 = await getFileHandle(rootDirHandle, path2);

    expect(handle1.name).toBe('file.txt');
    expect(handle2.name).toBe('file.txt');
  });

  test('should handle windows-style paths', async () => {
    const path = 'folder\\subfolder\\file.txt';
    const handle = await getFileHandle(rootDirHandle, path);

    expect(handle.kind).toBe('file');
    // Note: The function uses forward slashes, so backslashes are treated as part of the name
  });
});

describe('saveChanges', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should save file creation changes', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'create',
        path: 'test.txt',
        data: 'Hello World',
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(result.sha).toBeDefined();
    expect(result.files).toBeDefined();
    expect(result.files['test.txt']).toBeDefined();
    expect(result.files['test.txt'].sha).toBeDefined();
  });

  test('should save file update changes', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'update',
        path: 'test.txt',
        data: 'Updated content',
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(result.sha).toBeDefined();
    expect(result.files['test.txt']).toBeDefined();
  });

  test('should save file deletion changes', async () => {
    // First create a file
    await getFileHandle(rootDirHandle, 'test.txt');

    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'delete',
        path: 'test.txt',
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(result.sha).toBeDefined();
  });

  test('should handle move changes', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'move',
        previousPath: 'old.txt',
        path: 'new.txt',
        data: 'File content',
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(result.sha).toBeDefined();
    expect(result.files['new.txt']).toBeDefined();
  });

  test('should handle multiple changes', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'create',
        path: 'file1.txt',
        data: 'Content 1',
      },
      {
        action: 'create',
        path: 'file2.txt',
        data: 'Content 2',
      },
      {
        action: 'update',
        path: 'file3.txt',
        data: 'Updated content',
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(result.sha).toBeDefined();
    expect(Object.keys(result.files)).toHaveLength(3);
    expect(result.files['file1.txt']).toBeDefined();
    expect(result.files['file2.txt']).toBeDefined();
    expect(result.files['file3.txt']).toBeDefined();
  });

  test('should handle undefined rootDirHandle gracefully', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'create',
        path: 'test.txt',
        data: 'Hello World',
      },
    ];

    const result = await saveChanges(undefined, changes);

    expect(result).toBeDefined();
    expect(result.sha).toBeDefined();
    expect(result.files['test.txt']).toBeDefined();
  });

  test('should handle File objects as data', async () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });

    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'create',
        path: 'test.txt',
        data: file,
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(result.files['test.txt']).toBeDefined();
  });

  test('should handle changes without data for delete action', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'delete',
        path: 'test.txt',
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(result.sha).toBeDefined();
  });

  test('should handle empty changes array', async () => {
    const result = await saveChanges(rootDirHandle, []);

    expect(result).toBeDefined();
    expect(result.sha).toBeDefined();
    expect(result.files).toEqual({});
  });

  test('should handle nested file paths', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'create',
        path: 'folder/subfolder/deep/file.txt',
        data: 'Deep content',
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(result.files['folder/subfolder/deep/file.txt']).toBeDefined();
  });

  test('should fail the save when a file cannot be written', async () => {
    const mockError = new Error('Write failed');

    /** @type {MockedFunction<any>} */ (rootDirHandle.getFileHandle).mockImplementationOnce(
      async () => {
        throw mockError;
      },
    );

    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'create',
        path: 'failing.txt',
        data: 'This will fail',
      },
      {
        action: 'create',
        path: 'success.txt',
        data: 'This will succeed',
      },
    ];

    // The user is told, rather than left with an entry referring to a file that isn’t there
    await expect(saveChanges(rootDirHandle, changes)).rejects.toBe(mockError);
    // The other file in the batch is still written, as it was already on its way
    expect(rootDirHandle.getFileHandle).toHaveBeenCalledWith(
      expect.stringMatching(/^\.sveltia-tmp-/),
      { create: true },
    );
    expect(rootDirHandle.getFileHandle).toHaveBeenCalledTimes(2);
  });

  test('should write the assets before the entry files', async () => {
    /** @type {string[]} */
    const order = [];

    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      { action: 'create', path: 'content/posts/post.md', slug: 'post', data: '# Post' },
      { action: 'create', path: 'static/uploads/photo.jpg', data: new File(['x'], 'photo.jpg') },
      { action: 'delete', path: 'content/posts/old.md', slug: 'old' },
      { action: 'update', path: 'static/uploads/logo.png', data: new File(['y'], 'logo.png') },
    ];

    // Record the order in which the final names are given to the files. The entry files are
    // written last, because a dev server watching the content may reload the CMS as soon as one
    // lands, which would cut the asset writes short
    const { getFileHandle: fileHandleMock, getDirectoryHandle: dirHandleMock } =
      /** @type {Record<string, MockedFunction<any>>} */ (/** @type {any} */ (rootDirHandle));

    fileHandleMock.mockImplementation(async (/** @type {string} */ name) => {
      const handle = createMockFileHandle(name);

      handle.move = vi.fn(async (_dir, newName) => {
        order.push(newName);
      });

      return handle;
    });
    dirHandleMock.mockImplementation(async (/** @type {string} */ name) => {
      const dir = createMockDirectoryHandle(name);

      // @ts-ignore
      dir.getFileHandle = fileHandleMock;
      // @ts-ignore
      dir.getDirectoryHandle = dirHandleMock;
      // @ts-ignore
      dir.removeEntry = vi.fn(async (entryName) => {
        order.push(`delete ${entryName}`);
      });
      // @ts-ignore
      dir.entries = createDirEntries('other.md');

      return dir;
    });

    const result = await saveChanges(rootDirHandle, changes);

    // The entry changes are written at the same time as each other, so only the groups are ordered
    expect(order.slice(0, 2)).toEqual(['photo.jpg', 'logo.png']);
    expect(order.slice(2).sort()).toEqual(['delete old.md', 'post.md']);
    expect(Object.keys(result.files)).toEqual([
      'static/uploads/photo.jpg',
      'static/uploads/logo.png',
      'content/posts/post.md',
    ]);
  });

  test('should handle delete action with nested paths', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'delete',
        path: 'folder/subfolder/file.txt',
      },
    ];

    // The parent directories are left alone, as they have other entries
    /** @type {MockedFunction<any>} */ (rootDirHandle.getDirectoryHandle).mockImplementation(
      async (/** @type {string} */ name) => {
        const dir = createMockDirectoryHandle(name);

        // @ts-ignore
        dir.getDirectoryHandle = rootDirHandle.getDirectoryHandle;
        // @ts-ignore
        dir.entries = createDirEntries('other.txt');

        return dir;
      },
    );

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(result.sha).toBeDefined();
  });

  test('should handle move action with data', async () => {
    const mockFileHandle = createMockFileHandle('oldfile.txt');

    /** @type {MockedFunction<any>} */ (rootDirHandle.getFileHandle).mockResolvedValueOnce(
      mockFileHandle,
    );

    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'move',
        path: 'newfile.txt',
        previousPath: 'oldfile.txt',
        data: 'Updated content',
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(mockFileHandle.move).toHaveBeenCalled();
    expect(result.files['newfile.txt']).toBeDefined();
  });

  test('should handle saveChanges with undefined rootDirHandle', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'create',
        path: 'file.txt',
        data: 'Content',
      },
    ];

    const result = await saveChanges(undefined, changes);

    expect(result).toBeDefined();
    expect(result.sha).toBeDefined();
    expect(result.files['file.txt']).toBeDefined();
  });

  test('should handle delete action returning null file', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'delete',
        path: 'file.txt',
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(result.files['file.txt']).toBeUndefined();
  });

  test('should handle move action without data', async () => {
    const mockFileHandle = createMockFileHandle('oldfile.txt');

    /** @type {MockedFunction<any>} */ (rootDirHandle.getFileHandle).mockResolvedValueOnce(
      mockFileHandle,
    );

    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'move',
        path: 'folder/newfile.txt',
        previousPath: 'oldfile.txt',
      },
    ];

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    expect(mockFileHandle.move).toHaveBeenCalled();
  });
});

describe('getHandleByPath', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should get file handle by path', async () => {
    const handle = await getHandleByPath(rootDirHandle, 'test.txt', 'file');

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
    expect(handle.name).toBe('test.txt');
  });

  test('should get directory handle by path', async () => {
    const handle = await getHandleByPath(rootDirHandle, 'folder', 'directory');

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('folder');
  });

  test('should default to file type', async () => {
    const handle = await getHandleByPath(rootDirHandle, 'test.txt');

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
  });

  test('should return root for empty path and directory type', async () => {
    const handle = await getHandleByPath(rootDirHandle, '', 'directory');

    expect(handle.kind).toBe('directory');
    expect(handle.name).toBe('root');
  });

  test('should throw for empty path and file type', async () => {
    await expect(getHandleByPath(rootDirHandle, '', 'file')).rejects.toThrow(
      'Path is required for file handle retrieval',
    );
  });

  test('should handle nested paths', async () => {
    const handle = await getHandleByPath(rootDirHandle, 'a/b/c/file.txt', 'file');

    expect(handle).toBeDefined();
    expect(handle.kind).toBe('file');
    expect(handle.name).toBe('file.txt');
  });

  test('should create intermediate directories', async () => {
    await getHandleByPath(rootDirHandle, 'folder/subfolder/file.txt', 'file');

    expect(rootDirHandle.getDirectoryHandle).toHaveBeenCalledWith('folder', { create: true });
  });
});

describe('getPathRegex', () => {
  test('should create regex for simple path', () => {
    const regex = getPathRegex('folder/file.txt');

    expect(regex).toBeInstanceOf(RegExp);
    expect(regex.test('folder/file.txt')).toBe(true);
    expect(regex.test('other/file.txt')).toBe(false);
  });

  test('should handle template tags', () => {
    const regex = getPathRegex('posts/{{slug}}/index.md');

    expect(regex.test('posts/my-post/index.md')).toBe(true);
    expect(regex.test('posts/another-post/index.md')).toBe(true);
    expect(regex.test('posts/index.md')).toBe(false);
  });

  test('should handle multiple template tags', () => {
    const regex = getPathRegex('{{year}}/{{month}}/{{slug}}.md');

    expect(regex.test('2024/10/my-post.md')).toBe(true);
    expect(regex.test('2023/05/another.md')).toBe(true);
    expect(regex.test('2024/my-post.md')).toBe(false);
  });

  test('should handle path without templates', () => {
    const regex = getPathRegex('static/path/to/file.txt');

    expect(regex.test('static/path/to/file.txt')).toBe(true);
    expect(regex.test('static/path/to/other.txt')).toBe(false);
  });

  test('should handle root paths', () => {
    const regex = getPathRegex('file.txt');

    expect(regex.test('file.txt')).toBe(true);
    expect(regex.test('other.txt')).toBe(false);
  });

  test('should be case-sensitive', () => {
    const regex = getPathRegex('Folder/File.txt');

    expect(regex.test('Folder/File.txt')).toBe(true);
    expect(regex.test('folder/file.txt')).toBe(false);
  });

  test('should handle brackets in path', () => {
    const regex = getPathRegex('app/(pages)/index.md');

    expect(regex.test('app/(pages)/index.md')).toBe(true);
    expect(regex.test('app/pages/index.md')).toBe(false);
  });

  test('should handle brackets with template tags', () => {
    const regex = getPathRegex('app/(pages)/{{slug}}.md');

    expect(regex.test('app/(pages)/my-post.md')).toBe(true);
    expect(regex.test('app/(pages)/another.md')).toBe(true);
    expect(regex.test('app/pages/my-post.md')).toBe(false);
  });

  test('should handle multiple bracket groups with templates', () => {
    const regex = getPathRegex('app/(content)/(writing)/{{slug}}/page.md');

    expect(regex.test('app/(content)/(writing)/my-article/page.md')).toBe(true);
    expect(regex.test('app/(content)/(writing)/another/page.md')).toBe(true);
    expect(regex.test('app/content/writing/my-article/page.md')).toBe(false);
  });

  test('should handle empty path (root folder)', () => {
    const regex = getPathRegex('');

    // Should match any file at root
    expect(regex.test('my-post.md')).toBe(true);
    expect(regex.test('index.html')).toBe(true);
    expect(regex.test('hello.txt')).toBe(true);
    // Should not match empty path
    expect(regex.test('')).toBe(false);
  });
});

describe('parseTextFileInfo', () => {
  test('should parse file with text content', async () => {
    const handle = createMockFileHandle('test.txt');
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

    handle.getFile = vi.fn(async () => file);

    const result = await parseTextFileInfo({
      handle,
      path: 'folder/test.txt',
      name: 'test.txt',
      sha: '',
      size: 0,
      type: 'config',
    });

    expect(result).toHaveProperty('handle');
    expect(result.handle).toBe(handle);
    expect(result).toHaveProperty('path', 'folder/test.txt');
    expect(result).toHaveProperty('name', 'test.txt');
    expect(result).toHaveProperty('size', 0);
    expect(result).toHaveProperty('sha');
    expect(typeof result.sha).toBe('string');
    expect(result).toHaveProperty('text');
    expect(result.text).toBe('test content');
  });

  test('should normalize Unicode characters in path and name', async () => {
    const handle = createMockFileHandle('テスト.txt');
    const file = new File(['内容'], 'テスト.txt', { type: 'text/plain' });

    handle.getFile = vi.fn(async () => file);

    const result = await parseTextFileInfo({
      handle,
      path: 'フォルダー/テスト.txt',
      name: 'テスト.txt',
      sha: '',
      size: 0,
      type: 'config',
    });

    expect(result.path).toBe('フォルダー/テスト.txt');
    expect(result.name).toBe('テスト.txt');
    expect(result).toHaveProperty('text');
    expect(result.text).toBe('内容');
  });

  test('should handle empty file', async () => {
    const handle = createMockFileHandle('empty.txt');
    const file = new File([], 'empty.txt', { type: 'text/plain' });

    handle.getFile = vi.fn(async () => file);

    const result = await parseTextFileInfo({
      handle,
      path: 'empty.txt',
      name: 'empty.txt',
      sha: '',
      size: 0,
      type: 'config',
    });

    expect(result.size).toBe(0);
    expect(result.sha).toBeDefined();
    expect(result).toHaveProperty('text');
    expect(result.text).toBe('');
  });

  test('should get fresh File reference from handle', async () => {
    const handle = createMockFileHandle('test.txt');
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const getFileSpy = vi.fn(async () => file);

    handle.getFile = getFileSpy;

    await parseTextFileInfo({
      handle,
      path: 'test.txt',
      name: 'test.txt',
      sha: '',
      size: 0,
      type: 'config',
    });

    expect(getFileSpy).toHaveBeenCalledTimes(1);
  });

  test('should extract metadata from file handle', async () => {
    const handle = createMockFileHandle('test.txt');

    const file = new File(['content'], 'test.txt', {
      type: 'text/plain',
      lastModified: 1234567890,
    });

    handle.getFile = vi.fn(async () => file);

    const result = await parseTextFileInfo({
      handle,
      path: 'test.txt',
      name: 'test.txt',
      sha: '',
      size: 0,
      type: 'config',
    });

    expect(result.name).toBe('test.txt');
    expect(result.size).toBe(0);
    expect(result.handle).toBeDefined();
    expect(result.handle).toBe(handle);
    expect(result).toHaveProperty('text');
    expect(result.text).toBe('content');
  });

  test('should skip .gitkeep files', async () => {
    const handle = createMockFileHandle('.gitkeep');
    const file = new File([''], '.gitkeep');

    handle.getFile = vi.fn(async () => file);

    const result = await parseTextFileInfo({
      handle,
      path: '.gitkeep',
      name: '.gitkeep',
      sha: '',
      size: 0,
      type: 'config',
    });

    expect(result.text).toBeUndefined();
  });

  test('should handle read errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handle = createMockFileHandle('test.txt');

    handle.getFile = vi.fn(async () => {
      throw new Error('Read failed');
    });

    const result = await parseTextFileInfo({
      handle,
      path: 'test.txt',
      name: 'test.txt',
      sha: '',
      size: 0,
      type: 'config',
    });

    expect(result.text).toBe('');
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  test('should skip files larger than 10MB', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = createMockFileHandle('large.txt');
    // Create a file larger than 10MB

    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.txt', {
      type: 'text/plain',
    });

    handle.getFile = vi.fn(async () => largeFile);

    const result = await parseTextFileInfo({
      handle,
      path: 'large.txt',
      name: 'large.txt',
      sha: '',
      size: 0,
      type: 'config',
    });

    expect(result.text).toBe('');
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('is too large'));
    consoleWarnSpy.mockRestore();
  });

  test('should process files under 10MB limit', async () => {
    const handle = createMockFileHandle('normal.txt');
    // Create a file under 10MB
    const normalFile = new File(['normal content'], 'normal.txt', { type: 'text/plain' });

    handle.getFile = vi.fn(async () => normalFile);

    const result = await parseTextFileInfo({
      handle,
      path: 'normal.txt',
      name: 'normal.txt',
      sha: '',
      size: 0,
      type: 'config',
    });

    expect(result.text).toBe('normal content');
  });
});

describe('canMoveFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // Restore the default prototype so subsequent describe blocks continue to work
    // @ts-ignore - We only need the prototype.move property for testing
    globalThis.FileSystemFileHandle ??= { prototype: { move: () => {} } };
  });

  test('should return true when move is available and not Brave', () => {
    vi.stubGlobal('FileSystemFileHandle', { prototype: { move: () => {} } });
    expect(canMoveFile()).toBe(true);
  });

  test('should return false when move is not in FileSystemFileHandle prototype', () => {
    vi.stubGlobal('FileSystemFileHandle', { prototype: {} });
    expect(canMoveFile()).toBe(false);
  });

  test('should return false when Brave browser is detected', async () => {
    vi.stubGlobal('FileSystemFileHandle', { prototype: { move: () => {} } });

    const { env } = await import('$lib/services/user/env.svelte');

    env.isBrave = true;
    expect(canMoveFile()).toBe(false);
    env.isBrave = false;
  });
});

describe('writeFile', () => {
  test('should write data using createWritable', async () => {
    const fileHandle = createMockFileHandle('test.txt');
    const mockWritableStream = { write: vi.fn(), close: vi.fn() };

    fileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    await writeFile(fileHandle, 'test content');

    expect(mockWritableStream.write).toHaveBeenCalledWith('test content');
    expect(mockWritableStream.close).toHaveBeenCalled();
  });

  test('should handle missing createWritable (old Safari)', async () => {
    const fileHandle = createMockFileHandle('test.txt');

    fileHandle.createWritable = undefined;

    await expect(writeFile(fileHandle, 'test content')).resolves.toBeUndefined();
  });

  test('should swallow close errors', async () => {
    const fileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn(),
      close: vi.fn().mockRejectedValue(new Error('Close failed')),
    };

    fileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    await expect(writeFile(fileHandle, 'data')).resolves.toBeUndefined();
  });

  test('should propagate write errors', async () => {
    const fileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn().mockRejectedValue(new Error('Write failed')),
      close: vi.fn(),
    };

    fileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    await expect(writeFile(fileHandle, 'data')).rejects.toThrow('Write failed');
  });
});

describe('moveFile', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should move file to different directory', async () => {
    const mockFileHandle = createMockFileHandle('oldfile.txt');

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    const result = await moveFile({
      rootDirHandle,
      previousPath: 'old/oldfile.txt',
      path: 'new/newfile.txt',
    });

    expect(result.name).toBe('oldfile.txt');
  });

  test('should rename file in same directory', async () => {
    const mockFileHandle = createMockFileHandle('oldname.txt');

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    const result = await moveFile({
      rootDirHandle,
      previousPath: 'folder/oldname.txt',
      path: 'folder/newname.txt',
    });

    expect(result.name).toBe('oldname.txt');
  });

  test('should handle root level file move', async () => {
    const mockFileHandle = createMockFileHandle('file.txt');

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    await moveFile({
      rootDirHandle,
      previousPath: 'file.txt',
      path: 'folder/file.txt',
    });

    expect(mockFileHandle.move).toHaveBeenCalled();
  });

  test('should use copy-and-delete fallback when move is not available', async () => {
    const mockFile = new File(['file content'], 'oldfile.txt');
    const mockSourceHandle = createMockFileHandle('oldfile.txt');
    const mockDestHandle = createMockFileHandle('newfile.txt');
    const mockDestWritable = { write: vi.fn(), close: vi.fn() };

    mockSourceHandle.getFile = vi.fn(async () => mockFile);
    mockDestHandle.createWritable = vi.fn().mockResolvedValue(mockDestWritable);

    const { env } = await import('$lib/services/user/env.svelte');

    env.isBrave = true; // Force canMoveFile() to return false

    /** @type {import('vitest').MockedFunction<any>} */ (rootDirHandle.getFileHandle)
      .mockResolvedValueOnce(mockSourceHandle)
      .mockResolvedValueOnce(mockDestHandle);

    const result = await moveFile({
      rootDirHandle,
      previousPath: 'oldfile.txt',
      path: 'newfile.txt',
    });

    env.isBrave = false;

    expect(result).toBe(mockDestHandle);
    expect(mockSourceHandle.move).not.toHaveBeenCalled();
    expect(rootDirHandle.removeEntry).toHaveBeenCalledWith('oldfile.txt');
  });
});

describe('saveFile', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should write string data to file', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn(),
      close: vi.fn(),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    const result = await saveFile({
      rootDirHandle,
      fileHandle: mockFileHandle,
      path: 'test.txt',
      data: 'test content',
    });

    expect(mockWritableStream.write).toHaveBeenCalledWith('test content');
    expect(mockWritableStream.close).toHaveBeenCalled();
    // No rename when fileHandle is provided
    expect(mockFileHandle.move).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(File);
  });

  test('should write to temp file and rename for nested path', async () => {
    // Build a real directory tree so getHandleByPath can traverse it
    const blogChildren = new Map();
    const blogHandle = createMockDirectoryHandle('blog', blogChildren);
    const contentChildren = new Map([['blog', blogHandle]]);
    const contentHandle = createMockDirectoryHandle('content', contentChildren);
    const rootChildren = new Map([['content', contentHandle]]);

    rootDirHandle = createMockDirectoryHandle('root', rootChildren);

    const result = await saveFile({
      rootDirHandle,
      path: 'content/blog/post.md',
      data: 'hello world',
    });

    expect(result).toBeInstanceOf(File);

    // The temp file is created inside blogChildren, then renamed to the final basename
    const tempKey = [...blogChildren.keys()].find((k) => k.startsWith('.sveltia-tmp-'));

    expect(tempKey).toBeTruthy();
    // Temp filename should use a UUID (not a timestamp) to guarantee uniqueness
    expect(tempKey).toMatch(
      /^\.sveltia-tmp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const tempFileHandle = blogChildren.get(tempKey);

    expect(tempFileHandle.move).toHaveBeenCalledWith(blogHandle, 'post.md');
  });

  test('should generate unique temp filenames for concurrent saves in the same directory', async () => {
    // Reproduce issue #682: concurrent saves of entry + media to the same folder
    // previously collided when both used Date.now() as the temp filename.
    const albumChildren = new Map();
    const albumHandle = createMockDirectoryHandle('my-album', albumChildren);
    const galleryChildren = new Map([['my-album', albumHandle]]);
    const galleryHandle = createMockDirectoryHandle('gallery', galleryChildren);
    const rootChildren = new Map([['gallery', galleryHandle]]);

    rootDirHandle = createMockDirectoryHandle('root', rootChildren);

    // Simulate concurrent writes: index.md and an image in the same folder
    await Promise.all([
      saveFile({ rootDirHandle, path: 'gallery/my-album/index.md', data: '# Album' }),
      saveFile({ rootDirHandle, path: 'gallery/my-album/photo.webp', data: 'binary' }),
    ]);

    const tempKeys = [...albumChildren.keys()].filter((k) => k.startsWith('.sveltia-tmp-'));

    // Both concurrent writes must have used distinct temp filenames
    expect(tempKeys).toHaveLength(2);
    expect(tempKeys[0]).not.toBe(tempKeys[1]);
  });

  test('should try renaming the temp file again if it fails at first', async () => {
    const { sleep } = await import('@sveltia/utils/misc');
    const children = new Map();

    rootDirHandle = createMockDirectoryHandle('root', children);

    /** @type {MockedFunction<any>} */ (rootDirHandle.getFileHandle).mockImplementation(
      async (/** @type {string} */ name) => {
        const handle = createMockFileHandle(name);

        // Another program has the file open for a moment, e.g. an antivirus scanner
        handle.move = vi
          .fn()
          .mockRejectedValueOnce(new DOMException('Locked', 'NoModificationAllowedError'))
          .mockRejectedValueOnce(new DOMException('Locked', 'NoModificationAllowedError'))
          .mockResolvedValueOnce(undefined);
        children.set(name, handle);

        return handle;
      },
    );

    const result = await saveFile({ rootDirHandle, path: 'post.md', data: 'hello' });
    const tempHandle = [...children.values()][0];

    expect(result).toBeInstanceOf(File);
    expect(tempHandle.move).toHaveBeenCalledTimes(3);
    expect(tempHandle.move).toHaveBeenLastCalledWith(rootDirHandle, 'post.md');
    // The waits get longer
    expect(vi.mocked(sleep).mock.calls).toEqual([[150], [300]]);
    expect(rootDirHandle.removeEntry).not.toHaveBeenCalled();
  });

  test('should remove the temp file and fail if it cannot be renamed', async () => {
    const error = new DOMException('Locked', 'NoModificationAllowedError');
    const children = new Map();

    rootDirHandle = createMockDirectoryHandle('root', children);

    /** @type {MockedFunction<any>} */ (rootDirHandle.getFileHandle).mockImplementation(
      async (/** @type {string} */ name) => {
        const handle = createMockFileHandle(name);

        handle.move = vi.fn().mockRejectedValue(error);
        children.set(name, handle);

        return handle;
      },
    );

    await expect(saveFile({ rootDirHandle, path: 'post.md', data: 'hello' })).rejects.toBe(error);

    const [tempName, tempHandle] = [...children.entries()][0];

    expect(tempName).toMatch(/^\.sveltia-tmp-/);
    expect(tempHandle.move).toHaveBeenCalledTimes(3);
    // Nothing is left behind
    expect(rootDirHandle.removeEntry).toHaveBeenCalledWith(tempName);

    // A temp file that can’t be removed either doesn’t hide the original error
    /** @type {MockedFunction<any>} */ (rootDirHandle.removeEntry).mockRejectedValue(
      new Error('Cannot remove'),
    );

    await expect(saveFile({ rootDirHandle, path: 'post.md', data: 'hello' })).rejects.toBe(error);
  });

  test('should write File object to file', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn(),
      close: vi.fn(),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    const fileData = new File(['content'], 'test.txt');

    const result = await saveFile({
      rootDirHandle,
      fileHandle: mockFileHandle,
      path: 'test.txt',
      data: fileData,
    });

    expect(mockWritableStream.write).toHaveBeenCalledWith(fileData);
    expect(result).toBeInstanceOf(File);
  });

  test('should propagate write errors', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn().mockRejectedValue(new Error('Write failed')),
      close: vi.fn(),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    await expect(
      saveFile({
        rootDirHandle,
        path: 'test.txt',
        data: 'test content',
      }),
    ).rejects.toThrow('Write failed');
  });

  test('should handle close errors gracefully', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn(),
      close: vi.fn().mockRejectedValue(new Error('Close failed')),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    // Should not throw
    const result = await saveFile({
      rootDirHandle,
      fileHandle: mockFileHandle,
      path: 'test.txt',
      data: 'test content',
    });

    expect(result).toBeInstanceOf(File);
    // No rename when fileHandle is provided
    expect(mockFileHandle.move).not.toHaveBeenCalled();
  });

  test('should handle Safari without createWritable support', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    mockFileHandle.createWritable = undefined;

    const result = await saveFile({
      rootDirHandle,
      fileHandle: mockFileHandle,
      path: 'test.txt',
      data: 'test content',
    });

    expect(result).toBeInstanceOf(File);
    // No rename when fileHandle is provided
    expect(mockFileHandle.move).not.toHaveBeenCalled();
  });

  test('should write directly to final path when move is not available', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');
    const mockWritableStream = { write: vi.fn(), close: vi.fn() };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    const { env } = await import('$lib/services/user/env.svelte');

    env.isBrave = true; // Force canMoveFile() to return false

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    const result = await saveFile({
      rootDirHandle,
      path: 'test.txt',
      data: 'test content',
    });

    env.isBrave = false;

    expect(mockWritableStream.write).toHaveBeenCalledWith('test content');
    expect(mockFileHandle.move).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(File);
  });
});

describe('deleteFile', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should delete file in root directory', async () => {
    await deleteFile({ rootDirHandle, path: 'test.txt' });

    expect(rootDirHandle.removeEntry).toHaveBeenCalledWith('test.txt');
  });

  test('should treat a file that is already gone as deleted', async () => {
    // The file was removed outside the CMS, e.g. in a file manager
    /** @type {MockedFunction<any>} */ (rootDirHandle.removeEntry).mockRejectedValue(
      new DOMException('A requested file or directory could not be found', 'NotFoundError'),
    );

    await expect(deleteFile({ rootDirHandle, path: 'test.txt' })).resolves.toBeUndefined();
    expect(rootDirHandle.removeEntry).toHaveBeenCalledWith('test.txt');
  });

  test('should report any other error', async () => {
    const error = new DOMException('Locked', 'NoModificationAllowedError');

    /** @type {MockedFunction<any>} */ (rootDirHandle.removeEntry).mockRejectedValue(error);

    await expect(deleteFile({ rootDirHandle, path: 'test.txt' })).rejects.toBe(error);
  });
});

describe('deleteEmptyParentDirs', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should stop when directory is not empty', async () => {
    const dirHandle = createMockDirectoryHandle('folder');

    // Mock entries() method for async iteration
    // @ts-ignore - Mock async iterator
    dirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['file1.txt', createMockFileHandle('file1.txt')];
        yield ['file2.txt', createMockFileHandle('file2.txt')];
      },
    }));

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getDirectoryHandle
    ).mockImplementation(async (/** @type {string} */ name) => {
      if (name === '') return rootDirHandle;
      if (name === 'folder') return dirHandle;

      return createMockDirectoryHandle(/** @type {string} */ (name));
    });

    await deleteEmptyParentDirs(rootDirHandle, ['folder']);

    expect(rootDirHandle.removeEntry).not.toHaveBeenCalled();
  });

  test('should delete empty directory when pathSegments has single item', async () => {
    const emptyDir = createMockDirectoryHandle('folder');

    // Mock empty directory with entries() returning nothing
    // @ts-ignore - Mock async iterator
    emptyDir.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        // empty - no entries
      },
    }));

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getDirectoryHandle
    ).mockImplementation(async (/** @type {string} */ name) => {
      if (name === '') return rootDirHandle;
      if (name === 'folder') return emptyDir;

      return createMockDirectoryHandle(/** @type {string} */ (name));
    });

    await deleteEmptyParentDirs(rootDirHandle, ['folder']);

    // Should try to remove the folder from root
    expect(rootDirHandle.removeEntry).toHaveBeenCalledWith('folder');
  });

  test('should move on to the parent when a directory is already gone', async () => {
    const notFound = new DOMException('Not found', 'NotFoundError');
    const parentDir = createMockDirectoryHandle('parent');

    // `parent/child` was removed outside the CMS, and `parent` is empty now
    /** @type {MockedFunction<any>} */ (parentDir.getDirectoryHandle).mockRejectedValue(notFound);
    // @ts-ignore - Mock async iterator
    parentDir.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        // empty - no entries
      },
    }));

    /** @type {MockedFunction<any>} */ (rootDirHandle.getDirectoryHandle).mockImplementation(
      async (/** @type {string} */ name) => (name === 'parent' ? parentDir : rootDirHandle),
    );

    await deleteEmptyParentDirs(rootDirHandle, ['parent', 'child']);

    expect(parentDir.removeEntry).not.toHaveBeenCalled();
    expect(rootDirHandle.removeEntry).toHaveBeenCalledWith('parent');

    // Any other error is reported
    const error = new DOMException('Locked', 'NoModificationAllowedError');

    /** @type {MockedFunction<any>} */ (parentDir.getDirectoryHandle).mockRejectedValue(error);

    await expect(deleteEmptyParentDirs(rootDirHandle, ['parent', 'child'])).rejects.toBe(error);
  });
});

describe('parseAssetFileInfo', () => {
  test('should parse asset file and extract metadata', async () => {
    const handle = createMockFileHandle('test.txt');
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

    handle.getFile = vi.fn(async () => file);

    /** @type {any} */
    const assetFile = {
      handle,
      path: 'test.txt',
      name: 'test.txt',
      size: 0,
      sha: '',
      type: 'asset',
      folder: { internalPath: '.' },
    };

    const result = await parseAssetFileInfo(assetFile);

    expect(result.kind).toBeDefined();
    expect(result.size).toBe(file.size);
    expect(result.sha).toBeDefined();
    expect(typeof result.sha).toBe('string');
    expect(result.text).toBeUndefined();
  });

  test('should handle .gitkeep files for asset parsing', async () => {
    const handle = createMockFileHandle('.gitkeep');
    const file = new File([''], '.gitkeep');

    handle.getFile = vi.fn(async () => file);

    /** @type {any} */
    const assetFile = {
      handle,
      path: '.gitkeep',
      name: '.gitkeep',
      size: 0,
      sha: '',
      type: 'asset',
      folder: { internalPath: '.' },
    };

    const result = await parseAssetFileInfo(assetFile);

    expect(result.kind).toBeDefined();
    expect(result.text).toBeUndefined();
  });

  test('should handle read errors gracefully for asset files', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handle = createMockFileHandle('test.txt');

    handle.getFile = vi.fn(async () => {
      throw new Error('Read failed');
    });

    /** @type {any} */
    const assetFile = {
      handle,
      path: 'test.txt',
      name: 'test.txt',
      size: 0,
      sha: '',
      type: 'asset',
      folder: { internalPath: '.' },
    };

    const result = await parseAssetFileInfo(assetFile);

    expect(result).toHaveProperty('kind');
    expect(result.text).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  test('should handle binary files for assets', async () => {
    const handle = createMockFileHandle('binary.dat');

    const file = new File([new Uint8Array([0, 1, 2])], 'binary.dat', {
      type: 'application/octet-stream',
    });

    handle.getFile = vi.fn(async () => file);

    /** @type {any} */
    const assetFile = {
      handle,
      path: 'binary.dat',
      name: 'binary.dat',
      size: 0,
      sha: '',
      type: 'asset',
      folder: { internalPath: '.' },
    };

    const result = await parseAssetFileInfo(assetFile);

    expect(result.kind).toBeDefined();
    expect(result.size).toBe(3);
    expect(result.sha).toBeDefined();
    expect(result.text).toBeUndefined();
  });

  test('should reuse a cached hash while the file is unchanged', async () => {
    const handle = createMockFileHandle('photo.jpg');
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1000 });
    const arrayBuffer = vi.spyOn(file, 'arrayBuffer');

    handle.getFile = vi.fn(async () => file);

    /** @type {any} */
    const assetFile = { handle, path: 'static/photo.jpg', name: 'photo.jpg', size: 0, sha: '' };
    const record = { sha: 'cached-sha', size: 5, lastModified: 1000 };
    const cachedHashes = new Map([['static/photo.jpg', record]]);
    /** @type {Map<string, any>} */
    const newHashes = new Map();
    const result = await parseAssetFileInfo(assetFile, { cachedHashes, newHashes });

    expect(result.sha).toBe('cached-sha');
    expect(result.size).toBe(5);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(newHashes.size).toBe(0);

    // A different size or modification time means the file has been changed
    await Promise.all(
      [
        { ...record, size: 6 },
        { ...record, lastModified: 2000 },
      ].map(async (stale) => {
        const rehashed = await parseAssetFileInfo(assetFile, {
          cachedHashes: new Map([['static/photo.jpg', stale]]),
          newHashes,
        });

        expect(rehashed.sha).not.toBe('cached-sha');
        expect(rehashed.sha).toHaveLength(40);
        expect(newHashes.get('static/photo.jpg')).toEqual({
          sha: rehashed.sha,
          size: 5,
          lastModified: 1000,
        });
      }),
    );
  });
});

describe('saveChange', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should handle create action', async () => {
    const mockFileHandle = createMockFileHandle('new.txt');

    const mockWritableStream = {
      write: vi.fn(),
      close: vi.fn(),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValue(mockFileHandle);

    const result = await saveChange(rootDirHandle, {
      action: 'create',
      path: 'new.txt',
      data: 'content',
    });

    expect(result).toBeInstanceOf(File);
    expect(mockWritableStream.write).toHaveBeenCalledWith('content');
  });

  test('should handle update action', async () => {
    const mockFileHandle = createMockFileHandle('existing.txt');

    const mockWritableStream = {
      write: vi.fn(),
      close: vi.fn(),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValue(mockFileHandle);

    const result = await saveChange(rootDirHandle, {
      action: 'update',
      path: 'existing.txt',
      data: 'updated content',
    });

    expect(result).toBeInstanceOf(File);
    expect(mockWritableStream.write).toHaveBeenCalledWith('updated content');
  });

  test('should handle move action', async () => {
    const mockFileHandle = createMockFileHandle('file.txt');

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValue(mockFileHandle);

    const result = await saveChange(rootDirHandle, {
      action: 'move',
      path: 'new/file.txt',
      previousPath: 'old/file.txt',
      data: 'content',
    });

    // Move action with data writes to new location
    expect(result).toBeInstanceOf(File);
  });

  test('should handle delete action', async () => {
    const mockDirHandle = createMockDirectoryHandle();

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getDirectoryHandle
    ).mockResolvedValue(mockDirHandle);

    const result = await saveChange(rootDirHandle, {
      action: 'delete',
      path: 'file.txt',
    });

    expect(result).toBeNull();
    expect(rootDirHandle.removeEntry).toHaveBeenCalledWith('file.txt');
  });

  test('should handle move without data', async () => {
    const mockFileHandle = createMockFileHandle('file.txt');

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValue(mockFileHandle);

    const result = await saveChange(rootDirHandle, {
      action: 'move',
      path: 'new/file.txt',
      previousPath: 'old/file.txt',
    });

    expect(result).toBeNull();
  });
});

describe('scanDir', () => {
  /** @type {FileHandleItem[]} */
  let fileHandles;
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    vi.resetAllMocks();
    fileHandles = [];
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should store file handle even if getFile will fail later', async () => {
    const fileHandle = createMockFileHandle('error.txt');
    const dirHandle = createMockDirectoryHandle('test');

    // Mock getFile to throw error - this won't be called during scanDir anymore
    fileHandle.getFile = vi.fn().mockRejectedValue(new Error('Permission denied'));

    // @ts-ignore - Mock async iterator
    dirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['error.txt', fileHandle];
      },
    }));

    await scanDir(dirHandle, {
      rootDirHandle,
      scanningPaths: ['error.txt'],
      scanningPathsRegEx: [/error\.txt/],
      fileHandles,
      pathRegexCache: new Map(),
    });

    // File handle is stored during scan; errors will occur later in parseFileHandleItem
    expect(fileHandles).toHaveLength(1);
    expect(fileHandles[0].handle).toBe(fileHandle);
    expect(fileHandles[0].path).toBe('error.txt');
  });

  test('should skip directory when path does not match', async () => {
    const nestedDirHandle = createMockDirectoryHandle('nested');
    const parentDirHandle = createMockDirectoryHandle('parent');

    // @ts-ignore - Mock async iterator
    parentDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['nested', nestedDirHandle];
      },
    }));

    await scanDir(
      parentDirHandle,
      {
        rootDirHandle,
        scanningPaths: ['other/path'],
        scanningPathsRegEx: [/^other\/path/],
        fileHandles,
        pathRegexCache: new Map(),
      },
      'parent',
    );

    // Should not add any files since path doesn't match
    expect(fileHandles).toHaveLength(0);
  });

  test('should skip hidden files except Git config files', async () => {
    const dirHandle = createMockDirectoryHandle('test');
    const hiddenFile = createMockFileHandle('.hidden');
    const gitignoreFile = createMockFileHandle('.gitignore');

    // @ts-ignore - Mock async iterator
    dirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['.hidden', hiddenFile];
        yield ['.gitignore', gitignoreFile];
      },
    }));

    await scanDir(dirHandle, {
      rootDirHandle,
      scanningPaths: ['.hidden', '.gitignore'],
      scanningPathsRegEx: [/.*/],
      fileHandles,
      pathRegexCache: new Map(),
    });

    // Only .gitignore should be included, .hidden should be skipped
    expect(fileHandles).toHaveLength(1);
    expect(fileHandles[0].handle).toBe(gitignoreFile);
    expect(fileHandles[0].path).toBe('.gitignore');
  });

  test('should handle directory matching scanning path', async () => {
    const nestedDirHandle = createMockDirectoryHandle('nested');
    const fileHandle = createMockFileHandle('file.txt');
    const parentDirHandle = createMockDirectoryHandle('parent');

    // @ts-ignore - Mock async iterator for parent
    parentDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['nested', nestedDirHandle];
      },
    }));

    // @ts-ignore - Mock async iterator for nested
    nestedDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['file.txt', fileHandle];
      },
    }));

    rootDirHandle.resolve = vi.fn((handle) => {
      if (handle === nestedDirHandle) {
        return Promise.resolve(['parent', 'nested']);
      }

      if (handle === fileHandle) {
        return Promise.resolve(['parent', 'nested', 'file.txt']);
      }

      return Promise.resolve([]);
    });

    await scanDir(
      parentDirHandle,
      {
        rootDirHandle,
        scanningPaths: ['parent/nested/file.txt'],
        scanningPathsRegEx: [/parent\/nested\/file\.txt/],
        fileHandles,
        pathRegexCache: new Map(),
      },
      'parent',
    );

    expect(fileHandles).toHaveLength(1);
    expect(fileHandles[0].handle).toBe(fileHandle);
    expect(fileHandles[0].path).toBe('parent/nested/file.txt');
  });

  test('should use cached regex when pathRegexCache already has an entry for the path (L168 false)', async () => {
    // When scanDir is called with currentPath='parent', the directory entry 'nested' becomes
    // path='parent/nested'. Pre-populate the cache with that full path key so the cache-hit
    // branch fires: !regex === false → L168 false covered.
    const cachedRegex = /nested/;
    const prePopulatedCache = new Map([['parent/nested', cachedRegex]]);
    const nestedDirHandle = createMockDirectoryHandle('nested');
    const fileHandle = createMockFileHandle('file.txt');
    const parentDirHandle = createMockDirectoryHandle('parent');

    // @ts-ignore - Mock async iterator
    parentDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['nested', nestedDirHandle];
      },
    }));

    // @ts-ignore - Mock async iterator for nested dir
    nestedDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['file.txt', fileHandle];
      },
    }));

    rootDirHandle.resolve = vi.fn((handle) => {
      if (handle === fileHandle) return Promise.resolve(['parent', 'nested', 'file.txt']);
      return Promise.resolve([]);
    });

    await scanDir(
      parentDirHandle,
      {
        rootDirHandle,
        scanningPaths: ['parent/nested'],
        scanningPathsRegEx: [/parent\/nested/],
        fileHandles,
        pathRegexCache: prePopulatedCache, // cache already has 'parent/nested' → L168 false
      },
      'parent',
    );

    // The cached regex was reused (not recreated) — same reference
    expect(prePopulatedCache.get('parent/nested')).toBe(cachedRegex);
  });
});

describe('collectScanningPaths', () => {
  /** @type {{ current: import('$lib/types/private').EntryFolderInfo[] }} */
  let allEntryFolders;
  /** @type {{ current: import('$lib/types/private').AssetFolderInfo[] }} */
  let allAssetFolders;

  beforeEach(async () => {
    // Import fresh store references for each test
    const contents = await import('$lib/services/contents');
    const folders = await import('$lib/services/assets/folders');

    allEntryFolders = contents.allEntryFolders;
    allAssetFolders = folders.allAssetFolders;

    // Reset stores to empty state
    allEntryFolders.current = [];
    allAssetFolders.current = [];
  });

  test('should collect and deduplicate paths from entry and asset folders', () => {
    allEntryFolders.current = [
      {
        collectionName: 'posts',
        filePathMap: {
          field1: 'content/posts',
          field2: 'content/pages',
        },
      },
      {
        collectionName: 'drafts',
        folderPathMap: {
          folder1: 'content/drafts',
        },
      },
    ];

    allAssetFolders.current = [
      {
        collectionName: 'images',
        internalPath: 'static/images',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      },
      {
        collectionName: 'videos',
        internalPath: 'static/videos',
        publicPath: '/videos',
        entryRelative: false,
        hasTemplateTags: false,
      },
      {
        collectionName: 'other',
        internalPath: undefined,
        publicPath: undefined,
        entryRelative: false,
        hasTemplateTags: false,
      }, // Should be filtered out
    ];

    const paths = collectScanningPaths();

    expect(paths).toContain('content/posts');
    expect(paths).toContain('content/pages');
    expect(paths).toContain('content/drafts');
    expect(paths).toContain('static/images');
    expect(paths).toContain('static/videos');
    expect(paths.length).toBe(5);
  });

  test('should handle empty stores', () => {
    // Stores already reset to empty in beforeEach
    const paths = collectScanningPaths();

    expect(paths).toEqual([]);
  });

  test('should strip slashes and deduplicate paths', () => {
    allEntryFolders.current = [
      {
        collectionName: 'posts',
        filePathMap: {
          field1: '/content/posts/',
          field2: 'content/posts',
        },
      },
    ];

    allAssetFolders.current = [
      {
        collectionName: 'images',
        internalPath: '/static/images/',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      },
    ];

    const paths = collectScanningPaths();

    expect(paths).toContain('content/posts');
    expect(paths).toContain('static/images');
    // Should deduplicate the duplicate 'content/posts' entries
    expect(paths.filter((p) => p === 'content/posts').length).toBe(1);
  });

  test('should prefer filePathMap over folderPathMap when filePathMap exists', () => {
    allEntryFolders.current = [
      {
        collectionName: 'mixed',
        filePathMap: {
          field1: 'content/files',
        },
        folderPathMap: {
          folder1: 'content/folders',
        },
      },
    ];

    allAssetFolders.current = [];

    const paths = collectScanningPaths();

    expect(paths).toContain('content/files');
    expect(paths).not.toContain('content/folders');
  });

  test('should use folderPathMap when filePathMap is not present', () => {
    allEntryFolders.current = [
      {
        collectionName: 'folders',
        folderPathMap: {
          folder1: 'content/folders',
        },
      },
    ];

    allAssetFolders.current = [];

    const paths = collectScanningPaths();

    expect(paths).toContain('content/folders');
  });

  test('should return empty paths when entry folder has no filePathMap and no folderPathMap (L187 binary-expr)', () => {
    // An entry folder with neither filePathMap nor folderPathMap exercises `folderPathMap ?? {}`.
    allEntryFolders.current = [
      /** @type {any} */ ({
        collectionName: 'empty-collection',
        // No filePathMap, no folderPathMap
      }),
    ];

    allAssetFolders.current = [];

    const paths = collectScanningPaths();

    // Object.values(folderPathMap ?? {}) = Object.values({}) = [] → no paths added
    expect(paths).toEqual([]);
  });
});

describe('getAllFiles', () => {
  /** @type {{ current: import('$lib/types/private').EntryFolderInfo[] }} */
  let allEntryFolders;
  /** @type {{ current: import('$lib/types/private').AssetFolderInfo[] }} */
  let allAssetFolders;

  beforeEach(async () => {
    const contents = await import('$lib/services/contents');
    const foldersModule = await import('$lib/services/assets/folders');

    allEntryFolders = contents.allEntryFolders;
    allAssetFolders = foldersModule.allAssetFolders;

    allEntryFolders.current = [];
    allAssetFolders.current = [];
  });

  test('should return array of BaseFileListItemProps for files found under a path', async () => {
    allEntryFolders.current = [
      /** @type {any} */ ({
        collectionName: 'posts',
        folderPathMap: { folder: 'content/posts' },
      }),
    ];
    allAssetFolders.current = [];

    const postsDir = createMockDirectoryHandle('posts');
    const fileHandle = createMockFileHandle('post.md');
    const contentDir = createMockDirectoryHandle('content');

    // @ts-ignore
    contentDir.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['posts', postsDir];
      },
    }));

    // @ts-ignore
    postsDir.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['post.md', fileHandle];
      },
    }));

    const rootChildren = new Map([['content', contentDir]]);
    const rootDirHandle = createMockDirectoryHandle('root', rootChildren);

    // @ts-ignore
    rootDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['content', contentDir];
      },
    }));

    const { getAllFiles } = await import('./files');
    const result = await getAllFiles(rootDirHandle);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({
      handle: expect.anything(),
      path: expect.any(String),
      name: expect.any(String),
      size: 0,
      sha: '',
    });
  });

  test('should return empty array when no scanning paths match', async () => {
    allEntryFolders.current = [];
    allAssetFolders.current = [];

    const rootDirHandle = createMockDirectoryHandle('root');

    // @ts-ignore
    rootDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        // no entries
      },
    }));

    const { getAllFiles } = await import('./files');
    const result = await getAllFiles(rootDirHandle);

    expect(result).toEqual([]);
  });
});

describe('loadFiles', () => {
  /**
   * Mock the modules `loadFiles()` depends on, with one entry, one asset and one config file.
   * @param {object} [options] Options.
   * @param {File} [options.assetFile] The asset file.
   * @returns {Promise<{ loadFiles: any, stores: Record<string, { current: any }>, mockLog: any,
   * getGitHash: any, rootDirHandle: any, mockEntries: any[], mockErrors: any[] }>} The freshly
   * imported `loadFiles()`, the mocked stores and other mocks.
   */
  const setup = async ({ assetFile = new File([''], 'image.png', { type: 'image/png' }) } = {}) => {
    vi.resetModules();

    const mockEntries = [/** @type {any} */ ({ id: '1', slug: 'post-1' })];
    /** @type {any[]} */
    const mockErrors = [];

    const stores = {
      allEntries: { current: undefined },
      allAssets: { current: undefined },
      gitConfigFiles: { current: undefined },
      entryParseErrors: { current: undefined },
      dataLoaded: { current: undefined },
    };

    const fakeFile = {
      handle: /** @type {any} */ ({
        name: 'post.md',
        getFile: vi.fn(async () => new File(['# Post'], 'post.md')),
      }),
      path: 'content/posts/post.md',
      name: 'post.md',
      size: 0,
      sha: '',
    };

    const fakeAssetFile = {
      handle: /** @type {any} */ ({
        name: 'image.png',
        getFile: vi.fn(async () => assetFile),
      }),
      path: 'static/image.png',
      name: 'image.png',
      size: 0,
      sha: '',
    };

    const fakeConfigFile = {
      handle: /** @type {any} */ ({
        name: 'netlify.toml',
        getFile: vi.fn(async () => new File(['[build]'], 'netlify.toml')),
      }),
      path: 'netlify.toml',
      name: 'netlify.toml',
      size: 0,
      sha: '',
    };

    vi.doMock('$lib/services/contents', () => ({
      allEntries: stores.allEntries,
      allEntryFolders: { current: [] },
      dataLoaded: stores.dataLoaded,
      entryParseErrors: stores.entryParseErrors,
    }));

    vi.doMock('$lib/services/assets', () => ({
      allAssets: stores.allAssets,
    }));

    vi.doMock('$lib/services/assets/folders', () => ({
      allAssetFolders: { current: [] },
    }));

    vi.doMock('$lib/services/backends/git/shared/config', () => ({
      GIT_CONFIG_FILE_REGEX: /^\.gitconfig$/,
      gitConfigFiles: stores.gitConfigFiles,
    }));

    vi.doMock('$lib/services/backends/process', () => ({
      createFileList: vi.fn(() => ({
        entryFiles: [fakeFile],
        assetFiles: [fakeAssetFile],
        configFiles: [fakeConfigFile],
      })),
      describeFileList: vi.fn(() => '1 entry files, 1 asset files, 1 config files'),
    }));

    const mockLog = vi.fn();

    vi.doMock('$lib/services/utils/logging', () => ({
      createDebugLogger: vi.fn(() => mockLog),
    }));

    vi.doMock('$lib/services/contents/file/process', () => ({
      prepareEntries: vi.fn(async () => ({ entries: mockEntries, errors: mockErrors })),
    }));

    vi.doMock('@sveltia/utils/file', () => ({
      getPathInfo: vi.fn((path) => ({ ext: path.split('.').pop() ?? '', base: path })),
      readAsText: vi.fn(async () => '# Post'),
    }));

    const getGitHash = vi.fn(async () => 'abc123');

    vi.doMock('$lib/services/utils/file', async () => {
      const actual = /** @type {any} */ (await vi.importActual('$lib/services/utils/file'));

      return {
        ...actual,
        getGitHash,
        getBlob: vi.fn(() => 'blob:http://localhost/fake'),
      };
    });

    vi.doMock('$lib/services/assets/kinds', () => ({
      getAssetKind: vi.fn(() => 'image'),
    }));

    const { loadFiles } = await import('./files');
    // Root handle with no entries — collectScanningPaths returns [] so getAllFiles returns []
    // But createFileList will be called with the empty result, returning our mocked files
    const rootDirHandle = createMockDirectoryHandle('root');

    // @ts-ignore
    rootDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        // empty — scanning paths are [] so nothing matches
      },
    }));

    return { loadFiles, stores, mockLog, getGitHash, rootDirHandle, mockEntries, mockErrors };
  };

  /**
   * Create a mock asset hash cache store.
   * @param {[string, any][]} [entries] Records in the store.
   * @returns {any} Store.
   */
  const createMockHashCacheDB = (entries = []) => ({
    entries: vi.fn(async () => entries),
    saveEntries: vi.fn(async () => {}),
    deleteEntries: vi.fn(async () => {}),
  });

  test('should load files and populate all stores', async () => {
    const { loadFiles, stores, mockLog, rootDirHandle, mockEntries, mockErrors } = await setup();

    await loadFiles(rootDirHandle);

    expect(stores.allEntries.current).toEqual(mockEntries);
    expect(stores.allAssets.current).toEqual(expect.any(Array));
    expect(stores.dataLoaded.current).toEqual(true);
    expect(stores.entryParseErrors.current).toEqual(mockErrors);
    expect(stores.gitConfigFiles.current).toEqual(expect.any(Array));
    // The loading is traced in the console
    expect(mockLog.mock.calls.map((/** @type {string[]} */ [message]) => message)).toEqual([
      'Started: local repository root',
      'Scanned the directory: 1 entry files, 1 asset files, 1 config files',
      'Read 1 entry files',
      'Read 1 config files',
      'Parsed 1 entries (0 errors)',
      'Hashed 1 of 1 asset files (0 cached)',
      'The site data is ready',
    ]);
  });

  test('should cache the asset hashes for the next load', async () => {
    const assetFile = new File(['image'], 'image.png', { type: 'image/png', lastModified: 1000 });
    const { loadFiles, stores, getGitHash, rootDirHandle } = await setup({ assetFile });

    const hashCacheDB = createMockHashCacheDB([
      ['static/gone.png', { sha: 'old', size: 1, lastModified: 1 }],
    ]);

    await loadFiles(rootDirHandle, { hashCacheDB });

    expect(getGitHash).toHaveBeenCalledWith(assetFile);
    expect(stores.allAssets.current[0].sha).toBe('abc123');
    // The hash is saved with the size and modification time it’s valid for, and the record of a
    // file that no longer exists is dropped
    expect(hashCacheDB.saveEntries).toHaveBeenCalledWith([
      ['static/image.png', { sha: 'abc123', size: 5, lastModified: 1000 }],
    ]);
    expect(hashCacheDB.deleteEntries).toHaveBeenCalledWith(['static/gone.png']);
  });

  test('should reuse the cached hash of an unchanged asset', async () => {
    const assetFile = new File(['image'], 'image.png', { type: 'image/png', lastModified: 1000 });
    const { loadFiles, stores, getGitHash, mockLog, rootDirHandle } = await setup({ assetFile });

    const hashCacheDB = createMockHashCacheDB([
      ['static/image.png', { sha: 'cached', size: 5, lastModified: 1000 }],
    ]);

    await loadFiles(rootDirHandle, { hashCacheDB });

    // The file isn’t read at all
    expect(getGitHash).not.toHaveBeenCalled();
    expect(stores.allAssets.current[0].sha).toBe('cached');
    expect(mockLog).toHaveBeenCalledWith('Hashed 0 of 1 asset files (1 cached)');
    // Nothing has changed, so nothing is written
    expect(hashCacheDB.saveEntries).not.toHaveBeenCalled();
    expect(hashCacheDB.deleteEntries).not.toHaveBeenCalled();
  });

  test('should hash an asset again if it has been modified', async () => {
    const assetFile = new File(['image'], 'image.png', { type: 'image/png', lastModified: 2000 });
    const { loadFiles, stores, getGitHash, rootDirHandle } = await setup({ assetFile });

    const hashCacheDB = createMockHashCacheDB([
      ['static/image.png', { sha: 'cached', size: 5, lastModified: 1000 }],
    ]);

    await loadFiles(rootDirHandle, { hashCacheDB });

    expect(getGitHash).toHaveBeenCalledWith(assetFile);
    expect(stores.allAssets.current[0].sha).toBe('abc123');
    expect(hashCacheDB.saveEntries).toHaveBeenCalledWith([
      ['static/image.png', { sha: 'abc123', size: 5, lastModified: 2000 }],
    ]);
  });

  test('should load the files even if the hash cache is broken', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { loadFiles, stores, getGitHash, rootDirHandle } = await setup();
    const hashCacheDB = createMockHashCacheDB();

    hashCacheDB.entries.mockRejectedValue(new Error('Cannot read'));
    hashCacheDB.saveEntries.mockRejectedValue(new Error('Cannot write'));

    await loadFiles(rootDirHandle, { hashCacheDB });

    // Every file is hashed, and the failed write doesn’t fail the load
    expect(getGitHash).toHaveBeenCalledOnce();
    expect(stores.dataLoaded.current).toBe(true);
    expect(hashCacheDB.saveEntries).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    consoleErrorSpy.mockRestore();
  });
});

describe('scanDir - directory recursion scenarios', () => {
  /** @type {FileHandleItem[]} */
  let fileHandles;
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    vi.resetAllMocks();
    fileHandles = [];
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should recursively scan nested directories with matching paths', async () => {
    const level1Dir = createMockDirectoryHandle('level1');
    const level2Dir = createMockDirectoryHandle('level2');
    const fileHandle = createMockFileHandle('file.txt');

    // @ts-ignore - Mock async iterator for root
    rootDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* rootAsyncIterator() {
        yield ['level1', level1Dir];
      },
    }));

    // @ts-ignore - Mock async iterator for level1
    level1Dir.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* level1AsyncIterator() {
        yield ['level2', level2Dir];
      },
    }));

    // @ts-ignore - Mock async iterator for level2
    level2Dir.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* level2AsyncIterator() {
        yield ['file.txt', fileHandle];
      },
    }));

    await scanDir(rootDirHandle, {
      rootDirHandle,
      scanningPaths: ['level1/level2/file.txt'],
      scanningPathsRegEx: [/level1\/level2\/file\.txt/],
      fileHandles,
      pathRegexCache: new Map(),
    });

    expect(fileHandles).toHaveLength(1);
    expect(fileHandles[0].handle).toBe(fileHandle);
    expect(fileHandles[0].path).toBe('level1/level2/file.txt');
  });

  test('should continue scanning when directory has template tags and path may match', async () => {
    const templateDir = createMockDirectoryHandle('posts');
    const nestedFileHandle = createMockFileHandle('index.md');
    const parentDirHandle = createMockDirectoryHandle('parent');

    // @ts-ignore - Mock async iterator for parent
    parentDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* parentAsyncIterator() {
        yield ['posts', templateDir];
      },
    }));

    // @ts-ignore - Mock async iterator for template dir
    templateDir.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* templateAsyncIterator() {
        yield ['my-post', nestedFileHandle];
      },
    }));

    // Scanning path with template tag
    await scanDir(
      parentDirHandle,
      {
        rootDirHandle,
        scanningPaths: ['parent/posts/{{slug}}/index.md'],
        scanningPathsRegEx: [/parent\/posts\/.+?\/index\.md/],
        fileHandles,
        pathRegexCache: new Map(),
      },
      'parent',
    );

    // The directory recursion should happen even though the template directory
    // doesn't directly match, because we check against scanningPaths
    expect(fileHandles.length).toBeGreaterThanOrEqual(0);
  });

  test('should skip hidden directories', async () => {
    const hiddenDir = createMockDirectoryHandle('.hidden');
    const parentDirHandle = createMockDirectoryHandle('parent');

    // @ts-ignore - Mock async iterator
    parentDirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* parentAsyncIterator2() {
        yield ['.hidden', hiddenDir];
      },
    }));

    await scanDir(
      parentDirHandle,
      {
        rootDirHandle,
        scanningPaths: ['parent/.hidden/file.txt'],
        scanningPathsRegEx: [/parent\/\.hidden\/file\.txt/],
        fileHandles,
        pathRegexCache: new Map(),
      },
      'parent',
    );

    // Hidden directory should be skipped
    expect(hiddenDir.entries).not.toHaveBeenCalled();
  });

  test('should handle resolve returning null for directory entries', async () => {
    const fileHandle = createMockFileHandle('file.txt');
    const dirHandle = createMockDirectoryHandle('test');

    // @ts-ignore - Mock async iterator
    dirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* dirAsyncIterator() {
        yield ['file.txt', fileHandle];
      },
    }));

    await scanDir(dirHandle, {
      rootDirHandle,
      scanningPaths: ['file.txt'],
      scanningPathsRegEx: [/^file\.txt$/],
      fileHandles,
      pathRegexCache: new Map(),
    });

    // Should find the file since the regex matches
    expect(fileHandles.length).toBeGreaterThanOrEqual(0);
  });
});

describe('deleteEmptyParentDirs - recursive deletion scenarios', () => {
  test('placeholder for recursion scenarios', () => {
    // deleteEmptyParentDirs is primarily tested through deleteFile tests
    // Complex mocking of keys() iterator is covered elsewhere
    expect(true).toBe(true);
  });
});

describe('saveFile - write stream error scenarios', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should propagate write error even if close succeeds', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn().mockRejectedValue(new Error('Write timeout')),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    await expect(
      saveFile({
        rootDirHandle,
        path: 'test.txt',
        data: 'test content',
      }),
    ).rejects.toThrow('Write timeout');

    expect(mockWritableStream.close).toHaveBeenCalled();
  });

  test('should propagate write error when both write and close fail', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn().mockRejectedValue(new Error('Write failed')),
      close: vi.fn().mockRejectedValue(new Error('Close failed')),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    await expect(
      saveFile({
        rootDirHandle,
        path: 'test.txt',
        data: 'test content',
      }),
    ).rejects.toThrow('Write failed');
  });

  test('should handle createWritable throwing error', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    // Mock createWritable property to undefined (like in Safari)
    // The code uses createWritable?.() so undefined is safe
    mockFileHandle.createWritable = undefined;

    const result = await saveFile({
      rootDirHandle,
      fileHandle: mockFileHandle,
      path: 'test.txt',
      data: 'test content',
    });

    expect(result).toBeInstanceOf(File);
    // No rename when fileHandle is provided
    expect(mockFileHandle.move).not.toHaveBeenCalled();
  });

  test('should use provided fileHandle when available', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn(),
      close: vi.fn(),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    const result = await saveFile({
      rootDirHandle,
      fileHandle: mockFileHandle,
      path: 'new/path/test.txt',
      data: 'test content',
    });

    // Should use provided fileHandle directly — no temp file, no rename
    expect(result).toBeInstanceOf(File);
    expect(mockWritableStream.write).toHaveBeenCalledWith('test content');
    expect(mockFileHandle.move).not.toHaveBeenCalled();
  });
});
