/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getDirectoryHandle,
  getFileHandle,
  getHandleByPath,
  readFile,
} from '$lib/services/backends/fs/shared/handles';
import { createMockDirectoryHandle } from '$lib/test/fs-handles';

vi.mock('@sveltia/utils/misc', () => ({
  sleep: vi.fn(async () => {}),
}));

// Provide a minimal FileSystemFileHandle global so canMoveFile() can inspect the prototype.
// Tests that require canMoveFile() === false can set env.isBrave to true directly.
// @ts-ignore - We only need the prototype.move property for testing
globalThis.FileSystemFileHandle ??= { prototype: { move: () => {} } };

/**
 * @import { MockedFunction } from 'vitest';
 */

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

describe('readFile', () => {
  test('should read an existing file', async () => {
    const rootDirHandle = createMockDirectoryHandle();
    const fileHandle = await getFileHandle(rootDirHandle, 'static/a.png');
    const file = await readFile(rootDirHandle, 'static/a.png');

    expect(file.name).toBe('a.png');
    expect(fileHandle.getFile).toHaveBeenCalled();
  });

  test('should not create a missing file', async () => {
    const rootDirHandle = createMockDirectoryHandle();

    await getDirectoryHandle(rootDirHandle, 'static');

    await expect(readFile(rootDirHandle, 'static/a.png')).rejects.toThrow('File not found: a.png');
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

  test('should not create a missing file or directory when told not to', async () => {
    await expect(
      getHandleByPath(rootDirHandle, 'folder/test.txt', 'file', { create: false }),
    ).rejects.toThrow('Directory not found: folder');
    expect(rootDirHandle.getDirectoryHandle).toHaveBeenCalledWith('folder', { create: false });

    // An existing file is returned as is
    await getHandleByPath(rootDirHandle, 'folder/test.txt');
    /** @type {MockedFunction<any>} */ (rootDirHandle.getDirectoryHandle).mockClear();

    const handle = await getHandleByPath(rootDirHandle, 'folder/test.txt', 'file', {
      create: false,
    });

    expect(handle.name).toBe('test.txt');
    expect(rootDirHandle.getDirectoryHandle).toHaveBeenCalledWith('folder', { create: false });
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
