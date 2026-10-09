// @ts-nocheck
import { IndexedDB } from '@sveltia/utils/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { allAssets } from '$lib/services/assets/state';
import { repositoryHead } from '$lib/services/backends/git/shared/head';
import { createFileList, describeFileList } from '$lib/services/backends/process';
import { cmsConfigVersion } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';

import {
  advanceRepositoryHead,
  getFileList,
  restoreCachedFileData,
  updateCache,
} from './file-cache';

// Mock dependencies
vi.mock('@sveltia/utils/storage');
vi.mock('$lib/services/assets', () => ({ allAssets: { current: [] } }));
vi.mock('$lib/services/backends/git/shared/config', () => ({ gitConfigFiles: { current: [] } }));
vi.mock('$lib/services/backends/process');
vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
  cmsConfigVersion: { current: undefined },
}));
vi.mock('$lib/services/contents', () => ({
  allEntries: { current: [] },
  dataLoaded: { current: false },
  entryParseErrors: { current: [] },
}));
vi.mock('$lib/services/contents/file/process');
// No collection uses a multi-file i18n structure, so each entry is made of a single file
vi.mock('$lib/services/contents/collection', () => ({ getCollection: vi.fn() }));
vi.mock('$lib/services/contents/collection/files', () => ({ getCollectionFile: vi.fn() }));
vi.mock('$lib/services/deployments');
vi.mock('$lib/services/utils/logging');

const lastConfigHash = 'config-hash-1';

describe('git/shared/file-cache', () => {
  let mockMetaDB;
  let mockCacheDB;

  beforeEach(() => {
    cmsConfigVersion.current = lastConfigHash;
    allEntries.current = [];
    allAssets.current = [];
    repositoryHead.current = '';

    mockMetaDB = {
      entries: vi.fn(),
      saveEntries: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    };

    mockCacheDB = {
      entries: vi.fn(),
      saveEntries: vi.fn(),
      deleteEntries: vi.fn(),
    };

    // Mock IndexedDB constructor - Vitest 4 requires proper constructor with 'class' keyword
    /** @type {any} */
    class MockIndexedDB {
      /**
       * Creates an instance that returns appropriate mock based on store name.
       * @param {string} dbName Database name.
       * @param {string} storeName Store name.
       */
      constructor(dbName, storeName) {
        if (storeName === 'meta') {
          Object.assign(this, mockMetaDB);
        } else if (storeName === 'file-cache') {
          Object.assign(this, mockCacheDB);
        }
      }
    }

    vi.mocked(IndexedDB).mockImplementation(MockIndexedDB);

    vi.mocked(createFileList).mockReturnValue({
      count: 10,
      entryFiles: [],
      assetFiles: [],
      configFiles: [],
      allFiles: [],
    });

    vi.mocked(prepareEntries).mockResolvedValue({
      entries: [],
      errors: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getFileList', () => {
    const mockFetchFileList = vi.fn();
    const mockLog = vi.fn();
    const lastCommitHash = 'abc123';

    global.IndexedDB = vi.fn();

    const cachedFileEntries = [
      ['file1.md', { sha: 'def456', size: 1024 }],
      ['file2.md', { sha: 'ghi789', size: 2048 }],
    ];

    beforeEach(() => {
      mockFetchFileList.mockResolvedValue([
        { path: 'file1.md', name: 'file1.md', sha: 'def456' },
        { path: 'file2.md', name: 'file2.md', sha: 'ghi789' },
      ]);
      vi.mocked(describeFileList).mockReturnValue('2 entry files, 0 asset files, 0 config files');
    });

    it('should use cached file list when hashes match and cache exists', async () => {
      const metaEntries = /** @type {[string, any][]} */ ([
        ['last_config_hash', lastConfigHash],
        ['last_commit_hash', lastCommitHash],
        ['git_config_fetched', true],
      ]);

      const result = await getFileList({
        metaEntries,
        lastCommitHash,
        cachedFileEntries,
        fetchFileList: mockFetchFileList,
        log: mockLog,
      });

      expect(mockFetchFileList).not.toHaveBeenCalled();
      expect(createFileList).toHaveBeenCalledWith([
        { path: 'file1.md', name: 'file1.md', sha: 'def456', size: 1024 },
        { path: 'file2.md', name: 'file2.md', sha: 'ghi789', size: 2048 },
      ]);
      expect(result).toBeDefined();
      expect(mockLog).toHaveBeenCalledWith(
        'Restored the file list from the cache: 2 entry files, 0 asset files, 0 config files',
      );
    });

    it('should fetch new file list when commit hash does not match', async () => {
      const metaEntries = /** @type {[string, any][]} */ ([
        ['last_config_hash', lastConfigHash],
        ['last_commit_hash', 'old-hash'],
        ['git_config_fetched', true],
      ]);

      await getFileList({
        metaEntries,
        lastCommitHash,
        cachedFileEntries,
        fetchFileList: mockFetchFileList,
        log: mockLog,
      });

      expect(mockFetchFileList).toHaveBeenCalledWith(lastCommitHash);
      // The commit is only recorded once the file contents have been cached
      expect(mockMetaDB.saveEntries).not.toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalledWith(
        'Fetched the file list: 2 entry files, 0 asset files, 0 config files',
      );
    });

    it('should fetch new file list when config hash does not match', async () => {
      const metaEntries = /** @type {[string, any][]} */ ([
        ['last_config_hash', 'old-config-hash'],
        ['last_commit_hash', lastCommitHash],
        ['git_config_fetched', true],
      ]);

      await getFileList({
        metaEntries,
        lastCommitHash,
        cachedFileEntries,
        fetchFileList: mockFetchFileList,
        log: mockLog,
      });

      expect(mockFetchFileList).toHaveBeenCalledWith(lastCommitHash);
    });

    it('should fetch new file list when cache is empty', async () => {
      const metaEntries = /** @type {[string, any][]} */ ([
        ['last_config_hash', lastConfigHash],
        ['last_commit_hash', lastCommitHash],
        ['git_config_fetched', true],
      ]);

      await getFileList({
        metaEntries,
        lastCommitHash,
        cachedFileEntries: [], // Empty cache
        fetchFileList: mockFetchFileList,
        log: mockLog,
      });

      expect(mockFetchFileList).toHaveBeenCalledWith(lastCommitHash);
    });
  });

  describe('advanceRepositoryHead', () => {
    const repository = /** @type {any} */ ({ databaseName: 'github:owner/repo:apps/site' });

    it('should move the head and the file cache on to the new commit', async () => {
      repositoryHead.current = 'head-1';
      mockMetaDB.get.mockResolvedValue('head-1');

      await advanceRepositoryHead(repository, 'head-1', 'head-2');

      expect(repositoryHead.current).toBe('head-2');
      expect(IndexedDB).toHaveBeenCalledWith('github:owner/repo:apps/site', 'meta');
      expect(mockMetaDB.get).toHaveBeenCalledWith('last_commit_hash');
      expect(mockMetaDB.set).toHaveBeenCalledWith('last_commit_hash', 'head-2');
    });

    it('should leave a file cache recorded at another commit alone', async () => {
      // A cache update still in flight records its own commit afterwards
      mockMetaDB.get.mockResolvedValue('head-0');

      await advanceRepositoryHead(repository, 'head-1', 'head-2');

      expect(repositoryHead.current).toBe('head-2');
      expect(mockMetaDB.set).not.toHaveBeenCalled();
    });

    it('should still move the head when the file cache can’t be updated', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockMetaDB.get.mockRejectedValue(new Error('IndexedDB error'));

      await advanceRepositoryHead(repository, 'head-1', 'head-2');

      expect(repositoryHead.current).toBe('head-2');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to update the file cache.',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('restoreCachedFileData', () => {
    it('should restore cached data to matching files', () => {
      const allFiles = [
        { path: 'file1.md', sha: 'abc123' },
        { path: 'file2.md', sha: 'def456' },
        { path: 'file3.md', sha: 'ghi789' },
      ];

      const cachedFiles = {
        'file1.md': { sha: 'abc123', text: 'cached content 1', meta: { cached: true } },
        'file2.md': { sha: 'old-sha', text: 'old content', meta: { cached: true } },
        'file3.md': { sha: 'ghi789', text: 'cached content 3', meta: { cached: true } },
      };

      restoreCachedFileData({ allFiles, cachedFiles });

      expect(allFiles[0]).toEqual({
        path: 'file1.md',
        sha: 'abc123',
        text: 'cached content 1',
        meta: { cached: true },
      });

      // File 2 should not be updated because SHA doesn't match
      expect(allFiles[1]).toEqual({ path: 'file2.md', sha: 'def456' });

      expect(allFiles[2]).toEqual({
        path: 'file3.md',
        sha: 'ghi789',
        text: 'cached content 3',
        meta: { cached: true },
      });
    });
  });

  describe('updateCache', () => {
    it('should save new entries and delete unused ones', async () => {
      const allFiles = [{ path: 'file1.md' }, { path: 'file2.md' }, { path: 'file3.md' }];

      const cachedFiles = {
        'file1.md': { sha: 'abc123' },
        'file2.md': { sha: 'def456' },
        'old-file.md': { sha: 'old123' },
      };

      const fetchingFiles = [{ path: 'file3.md' }];

      const fetchedFileMap = {
        'file3.md': { sha: 'ghi789', text: 'new content' },
      };

      await updateCache({
        cacheDB: mockCacheDB,
        allFiles,
        cachedFiles,
        fetchingFiles,
        fetchedFileMap,
      });

      expect(mockCacheDB.saveEntries).toHaveBeenCalledWith([
        ['file3.md', { sha: 'ghi789', text: 'new content' }],
      ]);

      expect(mockCacheDB.deleteEntries).toHaveBeenCalledWith(['old-file.md']);
    });

    it('should not save entries when no files are being fetched', async () => {
      const allFiles = [{ path: 'file1.md' }];
      const cachedFiles = { 'file1.md': { sha: 'abc123' } };
      const fetchingFiles = [];
      const fetchedFileMap = {};

      await updateCache({
        cacheDB: mockCacheDB,
        allFiles,
        cachedFiles,
        fetchingFiles,
        fetchedFileMap,
      });

      expect(mockCacheDB.saveEntries).not.toHaveBeenCalled();
    });

    it('should not delete entries when no unused files exist', async () => {
      const allFiles = [{ path: 'file1.md' }];
      const cachedFiles = { 'file1.md': { sha: 'abc123' } };
      const fetchingFiles = [];
      const fetchedFileMap = {};

      await updateCache({
        cacheDB: mockCacheDB,
        allFiles,
        cachedFiles,
        fetchingFiles,
        fetchedFileMap,
      });

      expect(mockCacheDB.deleteEntries).not.toHaveBeenCalled();
    });

    it('should wait for the unused entries to be deleted', async () => {
      const { promise, resolve } = Promise.withResolvers();
      let settled = false;

      mockCacheDB.deleteEntries.mockReturnValue(promise);

      const run = updateCache({
        cacheDB: mockCacheDB,
        allFiles: [{ path: 'file1.md' }],
        cachedFiles: { 'file1.md': { sha: 'abc123' }, 'old-file.md': { sha: 'old123' } },
        fetchingFiles: [{ path: 'file1.md' }],
        fetchedFileMap: { 'file1.md': { sha: 'abc123', text: 'content' } },
      }).then(() => {
        settled = true;
      });

      // The save and the deletion are started together
      expect(mockCacheDB.saveEntries).toHaveBeenCalled();
      expect(mockCacheDB.deleteEntries).toHaveBeenCalledWith(['old-file.md']);
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);

      resolve(undefined);
      await run;

      expect(settled).toBe(true);
    });

    it('should reject if the unused entries fail to be deleted', async () => {
      mockCacheDB.deleteEntries.mockRejectedValue(new Error('Delete failed'));

      await expect(
        updateCache({
          cacheDB: mockCacheDB,
          allFiles: [],
          cachedFiles: { 'old-file.md': { sha: 'old123' } },
          fetchingFiles: [],
          fetchedFileMap: {},
        }),
      ).rejects.toThrow('Delete failed');
    });
  });
});
