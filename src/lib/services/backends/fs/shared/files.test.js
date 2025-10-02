import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  deleteEmptyParentDirs,
  deleteFile,
  getDirectoryHandle,
  getFileHandle,
  getHandleByPath,
  getPathRegex,
  moveFile,
  normalizeFileListItem,
  readTextFile,
  saveChange,
  saveChanges,
  writeFile,
} from './files';

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
});

describe('normalizeFileListItem', () => {
  test('should normalize file list item with hash', async () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const result = await normalizeFileListItem({ file, path: 'folder/test.txt' });

    expect(result).toHaveProperty('file', file);
    expect(result).toHaveProperty('path', 'folder/test.txt');
    expect(result).toHaveProperty('name', 'test.txt');
    expect(result).toHaveProperty('size', file.size);
    expect(result).toHaveProperty('sha');
    expect(typeof result.sha).toBe('string');
  });

  test('should normalize Unicode characters in path and name', async () => {
    const file = new File(['内容'], 'テスト.txt');
    const result = await normalizeFileListItem({ file, path: 'フォルダー/テスト.txt' });

    expect(result.path).toBe('フォルダー/テスト.txt');
    expect(result.name).toBe('テスト.txt');
  });

  test('should handle empty file', async () => {
    const file = new File([], 'empty.txt');
    const result = await normalizeFileListItem({ file, path: 'empty.txt' });

    expect(result.size).toBe(0);
    expect(result.sha).toBeDefined();
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
});

describe('writeFile', () => {
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

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    const result = await writeFile({
      rootDirHandle,
      path: 'test.txt',
      data: 'test content',
    });

    expect(mockWritableStream.write).toHaveBeenCalledWith('test content');
    expect(mockWritableStream.close).toHaveBeenCalled();
    expect(result).toBeInstanceOf(File);
  });

  test('should write File object to file', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn(),
      close: vi.fn(),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    const fileData = new File(['content'], 'test.txt');

    const result = await writeFile({
      rootDirHandle,
      fileHandle: mockFileHandle,
      path: 'test.txt',
      data: fileData,
    });

    expect(mockWritableStream.write).toHaveBeenCalledWith(fileData);
    expect(result).toBeInstanceOf(File);
  });

  test('should handle write errors gracefully', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn().mockRejectedValue(new Error('Write failed')),
      close: vi.fn(),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    // Should not throw
    const result = await writeFile({
      rootDirHandle,
      path: 'test.txt',
      data: 'test content',
    });

    expect(result).toBeInstanceOf(File);
  });

  test('should handle close errors gracefully', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    const mockWritableStream = {
      write: vi.fn(),
      close: vi.fn().mockRejectedValue(new Error('Close failed')),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritableStream);

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    // Should not throw
    await expect(
      writeFile({
        rootDirHandle,
        path: 'test.txt',
        data: 'test content',
      }),
    ).resolves.toBeInstanceOf(File);
  });

  test('should handle Safari without createWritable support', async () => {
    const mockFileHandle = createMockFileHandle('test.txt');

    mockFileHandle.createWritable = undefined;

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getFileHandle
    ).mockResolvedValueOnce(mockFileHandle);

    const result = await writeFile({
      rootDirHandle,
      path: 'test.txt',
      data: 'test content',
    });

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
});

describe('deleteEmptyParentDirs', () => {
  /** @type {FileSystemDirectoryHandle} */
  let rootDirHandle;

  beforeEach(() => {
    rootDirHandle = createMockDirectoryHandle();
  });

  test('should stop when directory is not empty', async () => {
    const dirHandle = createMockDirectoryHandle('folder');

    // Mock keys() method for async iteration
    // @ts-ignore - Mock async iterator
    // eslint-disable-next-line jsdoc/require-jsdoc
    dirHandle.keys = vi.fn(() => ({
      // eslint-disable-next-line jsdoc/require-jsdoc, func-names, object-shorthand
      [Symbol.asyncIterator]: async function* () {
        yield 'file1.txt';
        yield 'file2.txt';
      },
    }));

    /** @type {import('vitest').MockedFunction<any>} */ (
      rootDirHandle.getDirectoryHandle
    ).mockResolvedValue(dirHandle);

    await deleteEmptyParentDirs(rootDirHandle, ['folder']);

    expect(dirHandle.removeEntry).not.toHaveBeenCalled();
  });
});

describe('readTextFile', () => {
  test('should read text content from file', async () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    /** @type {any} */
    const entryFile = { name: 'test.txt', file, path: 'test.txt', size: file.size, sha: 'abc' };

    await readTextFile(entryFile);

    expect(entryFile.text).toBe('test content');
  });

  test('should skip .gitkeep files', async () => {
    const file = new File([''], '.gitkeep');
    /** @type {any} */
    const entryFile = { name: '.gitkeep', file, path: '.gitkeep', size: 0, sha: 'abc' };

    await readTextFile(entryFile);

    expect(entryFile.text).toBeUndefined();
  });

  test('should handle read errors gracefully', async () => {
    const file = new File(['content'], 'test.txt');
    /** @type {any} */
    const entryFile = { name: 'test.txt', file, path: 'test.txt', size: file.size, sha: 'abc' };

    // Mock readAsText to throw error
    vi.spyOn(file, 'text').mockRejectedValue(new Error('Read failed'));

    await readTextFile(entryFile);

    expect(entryFile.text).toBe('');
  });

  test('should handle binary files', async () => {
    const file = new File([new Uint8Array([0, 1, 2])], 'binary.dat');
    /** @type {any} */
    const entryFile = { name: 'binary.dat', file, path: 'binary.dat', size: 3, sha: 'abc' };

    await readTextFile(entryFile);

    expect(typeof entryFile.text).toBe('string');
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
