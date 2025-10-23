// @ts-nocheck
import { IndexedDB } from '@sveltia/utils/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { allAssets } from '$lib/services/assets';
import { isLastCommitPublished } from '$lib/services/backends';
import { gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { createFileList } from '$lib/services/backends/process';
import { allEntries, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';

import {
  fetchAndParseFiles,
  getFileList,
  parseAssetFileInfo,
  parseFileInfo,
  restoreCachedFileData,
  updateCache,
  updateStores,
} from './fetch';

// Mock dependencies
vi.mock('@sveltia/utils/storage');
vi.mock('$lib/services/assets');
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

    // Mock IndexedDB constructor - import at module level from storage mock
    vi.mocked(IndexedDB).mockImplementation((dbName, storeName) => {
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

  describe('parseFileInfo', () => {
    it('should merge file data with fetched data', () => {
      const fileInfo = {
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

      const result = parseFileInfo({ fileInfo, fetchedFileMap });

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
      const fileInfo = {
        path: 'test.md',
        sha: 'abc123',
        name: 'test.md',
        size: 500,
        text: 'existing content',
        meta: { existing: true },
      };

      const fetchedFileMap = {};
      const result = parseFileInfo({ fileInfo, fetchedFileMap });

      expect(result).toEqual(fileInfo);
    });
  });

  describe('parseAssetFileInfo', () => {
    it('should parse asset file with image extension', () => {
      const fileInfo = {
        path: 'images/sample.jpg',
        name: 'sample.jpg',
        sha: 'abc123',
        size: 2048,
        text: undefined,
      };

      const result = parseAssetFileInfo(fileInfo);

      expect(result).toEqual({
        path: 'images/sample.jpg',
        name: 'sample.jpg',
        sha: 'abc123',
        size: 2048,
        text: undefined,
        kind: 'image',
      });
    });

    it('should parse asset file with video extension', () => {
      const fileInfo = {
        path: 'videos/sample.mp4',
        name: 'sample.mp4',
        sha: 'def456',
        size: 10240,
      };

      const result = parseAssetFileInfo(fileInfo);

      expect(result.kind).toBe('video');
      expect(result.name).toBe('sample.mp4');
      expect(result.sha).toBe('def456');
    });

    it('should parse asset file with audio extension', () => {
      const fileInfo = {
        path: 'audio/song.mp3',
        name: 'song.mp3',
        sha: 'ghi789',
        size: 5120,
      };

      const result = parseAssetFileInfo(fileInfo);

      expect(result.kind).toBe('audio');
      expect(result.name).toBe('song.mp3');
    });

    it('should parse asset file with document extension', () => {
      const fileInfo = {
        path: 'docs/report.pdf',
        name: 'report.pdf',
        sha: 'jkl012',
        size: 1024,
      };

      const result = parseAssetFileInfo(fileInfo);

      expect(result.kind).toBe('document');
      expect(result.name).toBe('report.pdf');
    });

    it('should parse asset file with unknown extension as "other"', () => {
      const fileInfo = {
        path: 'files/unknown.xyz',
        name: 'unknown.xyz',
        sha: 'mno345',
        size: 512,
      };

      const result = parseAssetFileInfo(fileInfo);

      expect(result.kind).toBe('other');
      expect(result.name).toBe('unknown.xyz');
    });

    it('should preserve meta data if provided', () => {
      const fileInfo = {
        path: 'images/sample.png',
        name: 'sample.png',
        sha: 'pqr678',
        size: 3072,
        meta: { customField: 'customValue', exif: { width: 800, height: 600 } },
      };

      const result = parseAssetFileInfo(fileInfo);

      expect(result).toEqual({
        path: 'images/sample.png',
        name: 'sample.png',
        sha: 'pqr678',
        size: 3072,
        kind: 'image',
        customField: 'customValue',
        exif: { width: 800, height: 600 },
      });
    });

    it('should handle asset file with various document types', () => {
      const documentTypes = [
        { name: 'file.pdf', expected: 'document' },
        { name: 'file.docx', expected: 'document' },
        { name: 'file.xlsx', expected: 'document' },
        { name: 'file.csv', expected: 'document' },
        { name: 'file.pptx', expected: 'document' },
      ];

      documentTypes.forEach(({ name, expected }) => {
        const result = parseAssetFileInfo({ path: name, name, sha: 'test123' });

        expect(result.kind).toBe(expected);
      });
    });

    it('should extract name from fileInfo when parsing', () => {
      const fileInfo = {
        path: 'images/my-image.gif',
        name: 'my-image.gif',
        sha: 'stu901',
      };

      const result = parseAssetFileInfo(fileInfo);

      expect(result.name).toBe('my-image.gif');
      expect(result.kind).toBe('image');
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

    it('should fetch and process entries, assets, and config files', async () => {
      const mockEntryFiles = [
        { path: 'posts/post1.md', name: 'post1.md', sha: 'entry1', size: 1024 },
      ];

      const mockAssetFiles = [
        { path: 'images/image1.jpg', name: 'image1.jpg', sha: 'asset1', size: 2048 },
      ];

      const mockConfigFiles = [
        { path: '.gitignore', name: '.gitignore', sha: 'config1', size: 512 },
      ];

      const allFilesArray = [...mockEntryFiles, ...mockAssetFiles, ...mockConfigFiles];

      vi.mocked(createFileList).mockReturnValue({
        count: 3,
        entryFiles: mockEntryFiles,
        assetFiles: mockAssetFiles,
        configFiles: mockConfigFiles,
        allFiles: allFilesArray,
      });

      vi.mocked(prepareEntries).mockResolvedValue({
        entries: [{ path: 'posts/post1.md', title: 'Post 1' }],
        errors: [],
      });

      mockCacheDB.entries.mockResolvedValue([]);
      mockMetaDB.get.mockResolvedValue(null);

      await fetchAndParseFiles({
        repository: mockRepository,
        fetchDefaultBranchName: mockFetchDefaultBranchName,
        fetchLastCommit: mockFetchLastCommit,
        fetchFileList: mockFetchFileList,
        fetchFileContents: mockFetchFileContents,
      });

      expect(prepareEntries).toHaveBeenCalled();
      expect(mockFetchFileContents).toHaveBeenCalledWith(allFilesArray);
    });

    it('should handle entries with parsing errors', async () => {
      const mockEntryFiles = [{ path: 'posts/bad.md', name: 'bad.md', sha: 'bad1', size: 512 }];
      const mockAssetFiles = [];
      const mockConfigFiles = [];
      const allFilesArray = mockEntryFiles;

      vi.mocked(createFileList).mockReturnValue({
        count: 1,
        entryFiles: mockEntryFiles,
        assetFiles: mockAssetFiles,
        configFiles: mockConfigFiles,
        allFiles: allFilesArray,
      });

      const parseError = new Error('Invalid YAML');

      vi.mocked(prepareEntries).mockResolvedValue({
        entries: [],
        errors: [parseError],
      });

      mockCacheDB.entries.mockResolvedValue([]);
      mockMetaDB.get.mockResolvedValue(null);

      await fetchAndParseFiles({
        repository: mockRepository,
        fetchDefaultBranchName: mockFetchDefaultBranchName,
        fetchLastCommit: mockFetchLastCommit,
        fetchFileList: mockFetchFileList,
        fetchFileContents: mockFetchFileContents,
      });

      expect(entryParseErrors.set).toHaveBeenCalledWith([parseError]);
    });

    it('should skip fetching file contents when all files are cached', async () => {
      const mockEntryFiles = [
        { path: 'posts/post1.md', name: 'post1.md', sha: 'entry1', size: 1024 },
      ];

      const allFilesArray = mockEntryFiles;

      vi.mocked(createFileList).mockReturnValue({
        count: 1,
        entryFiles: mockEntryFiles,
        assetFiles: [],
        configFiles: [],
        allFiles: allFilesArray.map((file) => ({ ...file, meta: { cached: true } })),
      });

      vi.mocked(prepareEntries).mockResolvedValue({
        entries: [],
        errors: [],
      });

      mockCacheDB.entries.mockResolvedValue([]);
      mockMetaDB.get.mockResolvedValue(null);

      await fetchAndParseFiles({
        repository: mockRepository,
        fetchDefaultBranchName: mockFetchDefaultBranchName,
        fetchLastCommit: mockFetchLastCommit,
        fetchFileList: mockFetchFileList,
        fetchFileContents: mockFetchFileContents,
      });

      expect(mockFetchFileContents).not.toHaveBeenCalled();
    });

    it('should call updateCache with correct parameters', async () => {
      const mockEntryFiles = [
        { path: 'posts/post1.md', name: 'post1.md', sha: 'entry1', size: 1024 },
      ];

      const allFilesArray = mockEntryFiles;

      vi.mocked(createFileList).mockReturnValue({
        count: 1,
        entryFiles: mockEntryFiles,
        assetFiles: [],
        configFiles: [],
        allFiles: allFilesArray,
      });

      vi.mocked(prepareEntries).mockResolvedValue({
        entries: [],
        errors: [],
      });

      const fetchedContent = {
        'posts/post1.md': { sha: 'entry1', text: '# Post 1' },
      };

      mockFetchFileContents.mockResolvedValue(fetchedContent);
      mockCacheDB.entries.mockResolvedValue([]);
      mockMetaDB.get.mockResolvedValue(null);

      await fetchAndParseFiles({
        repository: mockRepository,
        fetchDefaultBranchName: mockFetchDefaultBranchName,
        fetchLastCommit: mockFetchLastCommit,
        fetchFileList: mockFetchFileList,
        fetchFileContents: mockFetchFileContents,
      });

      expect(mockCacheDB.saveEntries).toHaveBeenCalledWith(
        expect.arrayContaining([['posts/post1.md', expect.objectContaining({ sha: 'entry1' })]]),
      );
    });

    it('should restore cached data before fetching new content', async () => {
      const mockEntryFiles = [
        { path: 'posts/post1.md', name: 'post1.md', sha: 'entry1', size: 1024 },
        { path: 'posts/post2.md', name: 'post2.md', sha: 'entry2', size: 2048 },
      ];

      const allFilesArray = mockEntryFiles;

      vi.mocked(createFileList).mockReturnValue({
        count: 2,
        entryFiles: mockEntryFiles,
        assetFiles: [],
        configFiles: [],
        allFiles: allFilesArray,
      });

      vi.mocked(prepareEntries).mockResolvedValue({
        entries: [{ path: 'posts/post1.md', title: 'Post 1', text: 'cached content' }],
        errors: [],
      });

      // Simulate cache with post1 but not post2
      mockCacheDB.entries.mockResolvedValue([
        ['posts/post1.md', { sha: 'entry1', text: 'cached content', meta: { cached: true } }],
      ]);

      mockMetaDB.get.mockResolvedValue(null);
      mockFetchFileContents.mockResolvedValue({
        'posts/post2.md': { sha: 'entry2', text: 'new content' },
      });

      await fetchAndParseFiles({
        repository: mockRepository,
        fetchDefaultBranchName: mockFetchDefaultBranchName,
        fetchLastCommit: mockFetchLastCommit,
        fetchFileList: mockFetchFileList,
        fetchFileContents: mockFetchFileContents,
      });

      // post2 should be fetched since it's not cached
      expect(mockFetchFileContents).toHaveBeenCalled();
      expect(mockFetchFileContents).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ path: 'posts/post2.md' })]),
      );
    });

    it('should set published status to true when commit message does not start with [skip ci]', async () => {
      mockFetchLastCommit.mockResolvedValue({
        hash: 'abc123',
        message: 'Regular commit message',
      });

      await fetchAndParseFiles({
        repository: mockRepository,
        fetchDefaultBranchName: mockFetchDefaultBranchName,
        fetchLastCommit: mockFetchLastCommit,
        fetchFileList: mockFetchFileList,
        fetchFileContents: mockFetchFileContents,
      });

      expect(isLastCommitPublished.set).toHaveBeenCalledWith(true);
    });

    it('should cache meta database hash after fetching files', async () => {
      const lastHash = 'hash123abc';

      mockFetchLastCommit.mockResolvedValue({
        hash: lastHash,
        message: 'Test commit',
      });

      vi.mocked(createFileList).mockReturnValue({
        count: 0,
        entryFiles: [],
        assetFiles: [],
        configFiles: [],
        allFiles: [],
      });

      mockCacheDB.entries.mockResolvedValue([]);
      mockMetaDB.get.mockResolvedValue(null);

      await fetchAndParseFiles({
        repository: mockRepository,
        fetchDefaultBranchName: mockFetchDefaultBranchName,
        fetchLastCommit: mockFetchLastCommit,
        fetchFileList: mockFetchFileList,
        fetchFileContents: mockFetchFileContents,
      });

      expect(mockMetaDB.set).toHaveBeenCalledWith('last_commit_hash', lastHash);
    });
  });
});
