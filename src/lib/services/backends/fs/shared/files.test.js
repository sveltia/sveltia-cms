import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDirectoryHandle, getFileHandle, saveChanges } from './files';

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

  test('should continue processing even if one change fails', async () => {
    // Mock a failure for one operation
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

    const result = await saveChanges(rootDirHandle, changes);

    expect(result).toBeDefined();
    // The failing file should have a fallback blob
    expect(result.files['failing.txt']).toBeDefined();
    expect(result.files['success.txt']).toBeDefined();
  });

  test('should handle delete action with nested paths', async () => {
    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'delete',
        path: 'folder/subfolder/file.txt',
      },
    ];

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
