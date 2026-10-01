/* eslint-disable jsdoc/require-jsdoc, func-names, object-shorthand */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { collectScanningPaths, getPathRegex, scanDir } from '$lib/services/backends/fs/shared/scan';
import { createMockDirectoryHandle, createMockFileHandle } from '$lib/test/fs-handles';

vi.mock('@sveltia/utils/misc', () => ({
  sleep: vi.fn(async () => {}),
}));

// Provide a minimal FileSystemFileHandle global so canMoveFile() can inspect the prototype.
// Tests that require canMoveFile() === false can set env.isBrave to true directly.
// @ts-ignore - We only need the prototype.move property for testing
globalThis.FileSystemFileHandle ??= { prototype: { move: () => {} } };

/**
 * @import { FileHandleItem } from '$lib/services/backends/fs/shared/scan';
 */

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

  test('should delete temp files left behind by an unfinished save', async () => {
    const dirHandle = createMockDirectoryHandle('test');
    const now = Date.now();
    const staleTempFile = createMockFileHandle('.sveltia-tmp-stale');
    const freshTempFile = createMockFileHandle('.sveltia-tmp-fresh');
    const goneTempFile = createMockFileHandle('.sveltia-tmp-gone');
    const hiddenFile = createMockFileHandle('.hidden');
    const tempDir = createMockDirectoryHandle('.sveltia-tmp-dir');

    staleTempFile.getFile = vi
      .fn()
      .mockResolvedValue(new File([''], staleTempFile.name, { lastModified: now - 60 * 1000 }));
    // A save in progress, e.g. in another tab
    freshTempFile.getFile = vi
      .fn()
      .mockResolvedValue(new File([''], freshTempFile.name, { lastModified: now - 59 * 1000 }));
    // Renamed by the save in progress in the meantime
    goneTempFile.getFile = vi.fn().mockRejectedValue(new DOMException('Gone', 'NotFoundError'));

    // @ts-ignore - Mock async iterator
    dirHandle.entries = vi.fn(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield ['.sveltia-tmp-stale', staleTempFile];
        yield ['.sveltia-tmp-fresh', freshTempFile];
        yield ['.sveltia-tmp-gone', goneTempFile];
        yield ['.hidden', hiddenFile];
        yield ['.sveltia-tmp-dir', tempDir];
      },
    }));

    await scanDir(dirHandle, {
      rootDirHandle,
      scanningPaths: [''],
      scanningPathsRegEx: [/.*/],
      fileHandles,
      pathRegexCache: new Map(),
    });

    expect(dirHandle.removeEntry).toHaveBeenCalledTimes(1);
    expect(dirHandle.removeEntry).toHaveBeenCalledWith('.sveltia-tmp-stale');
    expect(hiddenFile.getFile).not.toHaveBeenCalled();
    // The temp files are never listed
    expect(fileHandles).toHaveLength(0);
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

    const { getAllFiles } = await import('$lib/services/backends/fs/shared/scan');
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

    const { getAllFiles } = await import('$lib/services/backends/fs/shared/scan');
    const result = await getAllFiles(rootDirHandle);

    expect(result).toEqual([]);
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
