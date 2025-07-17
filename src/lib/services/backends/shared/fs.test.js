import { describe, expect, test, vi, beforeEach } from 'vitest';
import { getFileHandle, getDirectoryHandle } from './fs';

/**
 * @import { MockedFunction } from 'vitest';
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
});
