/* eslint-disable jsdoc/require-jsdoc, func-names, object-shorthand */

import { describe, expect, test, vi } from 'vitest';

import { parseAssetFileInfo, parseTextFileInfo } from '$lib/services/backends/fs/shared/load';
import { createMockDirectoryHandle, createMockFileHandle } from '$lib/test/fs-handles';

vi.mock('@sveltia/utils/misc', () => ({
  sleep: vi.fn(async () => {}),
}));

// Provide a minimal FileSystemFileHandle global so canMoveFile() can inspect the prototype.
// Tests that require canMoveFile() === false can set env.isBrave to true directly.
// @ts-ignore - We only need the prototype.move property for testing
globalThis.FileSystemFileHandle ??= { prototype: { move: () => {} } };

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

    expect(result.text).toBeUndefined();
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

    expect(result.text).toBeUndefined();
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

    vi.doMock('$lib/services/assets/state', () => ({
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

    const { loadFiles } = await import('$lib/services/backends/fs/shared/load');
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
