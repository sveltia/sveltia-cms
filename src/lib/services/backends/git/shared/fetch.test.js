// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { allAssets } from '$lib/services/assets';
import { parseAssetFiles } from '$lib/services/assets/parser';
import { isLastCommitPublished } from '$lib/services/backends';
import { gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { createFileList } from '$lib/services/backends/process';
import { allEntries, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';

import {
  fetchAndParseFiles,
  getFileList,
  parseFile,
  restoreCachedFileData,
  updateCache,
  updateStores,
} from './fetch';

// Mock dependencies
vi.mock('@sveltia/utils/storage');
vi.mock('$lib/services/assets');
vi.mock('$lib/services/assets/parser');
vi.mock('$lib/services/backends');
vi.mock('$lib/services/backends/git/shared/config');
vi.mock('$lib/services/backends/process');
vi.mock('$lib/services/contents');
vi.mock('$lib/services/contents/file/process');

describe('git/shared/fetch', () => {
  let mockMetaDB;
  let mockCacheDB;

  beforeEach(() => {
    mockMetaDB = {
      get: vi.fn(),
      set: vi.fn(),
    };

    mockCacheDB = {
      entries: vi.fn(),
      saveEntries: vi.fn(),
      deleteEntries: vi.fn(),
    };

    // Mock IndexedDB constructor
    global.IndexedDB = vi.fn().mockImplementation((dbName, storeName) => {
      if (storeName === 'meta') {
        return mockMetaDB;
      }

      if (storeName === 'file-cache') {
        return mockCacheDB;
      }

      return {};
    });

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

    vi.mocked(parseAssetFiles).mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getFileList', () => {
    const mockFetchFileList = vi.fn();
    const lastHash = 'abc123';

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
    });

    it('should use cached file list when hash matches and cache exists', async () => {
      mockMetaDB.get.mockImplementation((key) => {
        if (key === 'last_commit_hash') {
          return Promise.resolve(lastHash);
        }

        if (key === 'git_config_fetched') {
          return Promise.resolve(true);
        }

        return Promise.resolve(null);
      });

      const result = await getFileList({
        metaDB: mockMetaDB,
        lastHash,
        cachedFileEntries,
        fetchFileList: mockFetchFileList,
      });

      expect(mockFetchFileList).not.toHaveBeenCalled();
      expect(createFileList).toHaveBeenCalledWith([
        { path: 'file1.md', name: 'file1.md', sha: 'def456', size: 1024 },
        { path: 'file2.md', name: 'file2.md', sha: 'ghi789', size: 2048 },
      ]);
      expect(result).toBeDefined();
    });

    it('should fetch new file list when hash does not match', async () => {
      mockMetaDB.get.mockImplementation((key) => {
        if (key === 'last_commit_hash') {
          return Promise.resolve('old-hash');
        }

        if (key === 'git_config_fetched') {
          return Promise.resolve(true);
        }

        return Promise.resolve(null);
      });

      await getFileList({
        metaDB: mockMetaDB,
        lastHash,
        cachedFileEntries,
        fetchFileList: mockFetchFileList,
      });

      expect(mockFetchFileList).toHaveBeenCalledWith(lastHash);
      expect(mockMetaDB.set).toHaveBeenCalledWith('last_commit_hash', lastHash);
      expect(mockMetaDB.set).toHaveBeenCalledWith('git_config_fetched', true);
    });

    it('should fetch new file list when cache is empty', async () => {
      mockMetaDB.get.mockImplementation((key) => {
        if (key === 'last_commit_hash') {
          return Promise.resolve(lastHash);
        }

        if (key === 'git_config_fetched') {
          return Promise.resolve(true);
        }

        return Promise.resolve(null);
      });

      await getFileList({
        metaDB: mockMetaDB,
        lastHash,
        cachedFileEntries: [], // Empty cache
        fetchFileList: mockFetchFileList,
      });

      expect(mockFetchFileList).toHaveBeenCalledWith(lastHash);
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

  describe('parseFile', () => {
    it('should merge file data with fetched data', () => {
      const file = {
        path: 'test.md',
        sha: 'abc123',
        name: 'test.md',
      };

      const fetchedFileMap = {
        'test.md': {
          size: 1024,
          text: 'file content',
          meta: { parsed: true },
        },
      };

      const result = parseFile({ file, fetchedFileMap });

      expect(result).toEqual({
        path: 'test.md',
        sha: 'abc123',
        name: 'test.md',
        size: 1024,
        text: 'file content',
        meta: { parsed: true },
      });
    });

    it('should preserve existing file data when not in fetched map', () => {
      const file = {
        path: 'test.md',
        sha: 'abc123',
        name: 'test.md',
        size: 500,
        text: 'existing content',
        meta: { existing: true },
      };

      const fetchedFileMap = {};
      const result = parseFile({ file, fetchedFileMap });

      expect(result).toEqual(file);
    });
  });

  describe('updateStores', () => {
    const mockStores = {
      allEntries: { set: vi.fn() },
      allAssets: { set: vi.fn() },
      gitConfigFiles: { set: vi.fn() },
      entryParseErrors: { set: vi.fn() },
      dataLoaded: { set: vi.fn() },
    };

    beforeEach(() => {
      vi.mocked(allEntries).set = mockStores.allEntries.set;
      vi.mocked(allAssets).set = mockStores.allAssets.set;
      vi.mocked(gitConfigFiles).set = mockStores.gitConfigFiles.set;
      vi.mocked(entryParseErrors).set = mockStores.entryParseErrors.set;
      vi.mocked(dataLoaded).set = mockStores.dataLoaded.set;
    });

    it('should update all stores with provided data', () => {
      const entries = [{ path: 'entry1.md' }];
      const assets = [{ path: 'asset1.jpg' }];
      const configFiles = [{ path: '.gitignore' }];
      const errors = [new Error('Parse error')];

      updateStores({ entries, assets, configFiles, errors });

      expect(allEntries.set).toHaveBeenCalledWith(entries);
      expect(allAssets.set).toHaveBeenCalledWith(assets);
      expect(gitConfigFiles.set).toHaveBeenCalledWith(configFiles);
      expect(entryParseErrors.set).toHaveBeenCalledWith(errors);
      expect(dataLoaded.set).toHaveBeenCalledWith(true);
    });

    it('should update stores with empty errors array by default', () => {
      const entries = [];
      const assets = [];
      const configFiles = [];

      updateStores({ entries, assets, configFiles });

      expect(entryParseErrors.set).toHaveBeenCalledWith([]);
      expect(dataLoaded.set).toHaveBeenCalledWith(true);
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
  });

  describe('fetchAndParseFiles', () => {
    const mockRepository = {
      databaseName: 'test-db',
      branch: 'main',
    };

    const mockFetchDefaultBranchName = vi.fn().mockResolvedValue('main');

    const mockFetchLastCommit = vi.fn().mockResolvedValue({
      hash: 'abc123',
      message: 'Test commit',
    });

    const mockFetchFileList = vi.fn().mockResolvedValue([]);
    const mockFetchFileContents = vi.fn().mockResolvedValue({});

    beforeEach(() => {
      mockCacheDB.entries.mockResolvedValue([]);
      vi.mocked(createFileList).mockReturnValue({
        count: 0,
        entryFiles: [],
        assetFiles: [],
        configFiles: [],
        allFiles: [],
      });
    });

    it('should set branch name if not provided', async () => {
      const repository = { ...mockRepository, branch: '' };

      await fetchAndParseFiles({
        repository,
        fetchDefaultBranchName: mockFetchDefaultBranchName,
        fetchLastCommit: mockFetchLastCommit,
        fetchFileList: mockFetchFileList,
        fetchFileContents: mockFetchFileContents,
      });

      expect(mockFetchDefaultBranchName).toHaveBeenCalled();
      expect(repository.branch).toBe('main');
    });

    it('should set isLastCommitPublished based on commit message', async () => {
      mockFetchLastCommit.mockResolvedValue({
        hash: 'abc123',
        message: '[skip ci] Test commit',
      });

      await fetchAndParseFiles({
        repository: mockRepository,
        fetchDefaultBranchName: mockFetchDefaultBranchName,
        fetchLastCommit: mockFetchLastCommit,
        fetchFileList: mockFetchFileList,
        fetchFileContents: mockFetchFileContents,
      });

      expect(isLastCommitPublished.set).toHaveBeenCalledWith(false);
    });

    it('should update stores with empty data when no files found', async () => {
      await fetchAndParseFiles({
        repository: mockRepository,
        fetchDefaultBranchName: mockFetchDefaultBranchName,
        fetchLastCommit: mockFetchLastCommit,
        fetchFileList: mockFetchFileList,
        fetchFileContents: mockFetchFileContents,
      });

      expect(allEntries.set).toHaveBeenCalledWith([]);
      expect(allAssets.set).toHaveBeenCalledWith([]);
      expect(gitConfigFiles.set).toHaveBeenCalledWith([]);
      expect(dataLoaded.set).toHaveBeenCalledWith(true);
    });
  });
});
