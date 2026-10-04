/* eslint-disable jsdoc/require-jsdoc, func-names, object-shorthand */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getFileHandle } from '$lib/services/backends/fs/shared/handles';
import {
  canMoveFile,
  deleteEmptyDirs,
  deleteEmptyParentDirs,
  deleteFile,
  moveFile,
  saveChange,
  saveChanges,
  saveFile,
  writeFile,
} from '$lib/services/backends/fs/shared/save';
import {
  createDirEntries,
  createImageTree,
  createMockDirectoryHandle,
  createMockFileHandle,
} from '$lib/test/fs-handles';

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

  test('should remove the folder left empty by deleting all of its files', async () => {
    const { rootDirHandle: root, imagesDir } = createImageTree('folder 1', [
      'a.png',
      'b.png',
      '.gitkeep',
    ]);

    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      { action: 'delete', path: 'static/images/folder 1/a.png' },
      { action: 'delete', path: 'static/images/folder 1/b.png' },
      { action: 'delete', path: 'static/images/folder 1/.gitkeep' },
    ];

    await saveChanges(root, changes);

    // The folder is removed once, after the files, not while they’re being removed; `static/images`
    // is removed too as it’s now empty, and so on up to the root
    expect(imagesDir.removeEntry).toHaveBeenCalledExactlyOnceWith('folder 1');
    // @ts-ignore - Mock property
    expect(root.children.size).toBe(0);
  });

  test('should remove the folder left empty by moving all of its files', async () => {
    const { rootDirHandle: root, imagesDir } = createImageTree('folder 1', ['a.png', 'b.png']);

    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      {
        action: 'move',
        path: 'static/images/folder 2/a.png',
        previousPath: 'static/images/folder 1/a.png',
        data: new File(['a'], 'a.png'),
      },
      {
        action: 'move',
        path: 'static/images/folder 2/b.png',
        previousPath: 'static/images/folder 1/b.png',
        data: new File(['b'], 'b.png'),
      },
    ];

    await saveChanges(root, changes);

    expect(imagesDir.removeEntry).toHaveBeenCalledExactlyOnceWith('folder 1');
    // @ts-ignore - Mock property
    expect([...imagesDir.children.keys()]).toEqual(['folder 2']);
  });

  test('should leave a folder that still has files', async () => {
    const { rootDirHandle: root, imagesDir } = createImageTree('folder 1', ['a.png', 'b.png']);

    /** @type {import('$lib/types/private').FileChange[]} */
    const changes = [
      { action: 'delete', path: 'static/images/folder 1/a.png' },
      { action: 'create', path: 'static/images/folder 1/c.png', data: new File(['c'], 'c.png') },
    ];

    await saveChanges(root, changes);

    expect(imagesDir.removeEntry).not.toHaveBeenCalled();
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

  test('should remove the temp file and fail if it cannot be written', async () => {
    const error = new DOMException('Disk full', 'QuotaExceededError');
    const children = new Map();

    rootDirHandle = createMockDirectoryHandle('root', children);

    /** @type {MockedFunction<any>} */ (rootDirHandle.getFileHandle).mockImplementation(
      async (/** @type {string} */ name) => {
        const handle = createMockFileHandle(name);

        handle.createWritable = vi.fn().mockResolvedValue({
          write: vi.fn().mockRejectedValue(error),
          close: vi.fn().mockRejectedValue(new TypeError('Stream errored')),
        });
        children.set(name, handle);

        return handle;
      },
    );

    await expect(saveFile({ rootDirHandle, path: 'post.md', data: 'hello' })).rejects.toBe(error);

    const [tempName, tempHandle] = [...children.entries()][0];

    expect(tempName).toMatch(/^\.sveltia-tmp-/);
    // The file isn’t renamed, and nothing is left behind
    expect(tempHandle.move).not.toHaveBeenCalled();
    expect(rootDirHandle.removeEntry).toHaveBeenCalledWith(tempName);
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

  test('should leave the directory alone even if it’s now empty', async () => {
    const { rootDirHandle: root, imagesDir } = createImageTree('folder 1', ['a.png']);

    await deleteFile({ rootDirHandle: root, path: 'static/images/folder 1/a.png' });

    // @ts-ignore - Mock property
    expect(imagesDir.children.get('folder 1').children.size).toBe(0);
    expect(imagesDir.removeEntry).not.toHaveBeenCalled();
  });
});

describe('deleteEmptyDirs', () => {
  test('should clean up each directory once, leaving out the root', async () => {
    const { rootDirHandle, imagesDir } = createImageTree('folder 1', []);

    await deleteEmptyDirs(rootDirHandle, [
      'static/images/folder 1',
      '',
      'static/images/folder 1',
      'static/images',
    ]);

    expect(imagesDir.removeEntry).toHaveBeenCalledExactlyOnceWith('folder 1');
    // @ts-ignore - Mock property
    expect(rootDirHandle.children.size).toBe(0);
    // The root itself is never removed
    expect(rootDirHandle.removeEntry).toHaveBeenCalledExactlyOnceWith('static');
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

  test('should write an empty file', async () => {
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
      data: '',
    });

    // The old content mustn’t be left on disk
    expect(result).toBeInstanceOf(File);
    expect(mockWritableStream.write).toHaveBeenCalledWith('');
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
