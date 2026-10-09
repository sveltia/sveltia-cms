// @ts-nocheck
import { IndexedDB } from '@sveltia/utils/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { allAssets } from '$lib/services/assets/state';
import { gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { repositoryHead } from '$lib/services/backends/git/shared/head';
import { createFileList } from '$lib/services/backends/process';
import { cmsConfigVersion } from '$lib/services/config';
import { allEntries, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';

import { applyFileMetadata, parseAssetFileInfo, parseFileInfo, updateStores } from './parse-files';

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

describe('git/shared/parse-files', () => {
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
    it('should update all stores with provided data', () => {
      const entries = [{ id: 'e1', locales: { _default: { path: 'entry1.md' } } }];
      const assets = [{ path: 'asset1.jpg' }];
      const configFiles = [{ path: '.gitignore' }];
      const errors = [new Error('Parse error')];

      updateStores({ entries, assets, configFiles, errors });

      expect(allEntries.current).toEqual(entries);
      expect(allAssets.current).toEqual(assets);
      expect(gitConfigFiles.current).toEqual(configFiles);
      expect(entryParseErrors.current).toEqual(errors);
      expect(dataLoaded.current).toEqual(true);
    });

    it('should keep the entries and assets already in the stores where the files are unchanged', () => {
      const oldEntry = { id: 'old-1', locales: { _default: { path: 'entry1.md' } } };
      const oldChangedEntry = { id: 'old-2', locales: { _default: { path: 'entry2.md' } } };
      const oldAsset = { path: 'asset1.jpg', blobURL: 'blob:1' };

      allEntries.current = [oldEntry, oldChangedEntry];
      allAssets.current = [oldAsset];

      const newEntry = { id: 'new-1', locales: { _default: { path: 'entry1.md' } } };
      const newChangedEntry = { id: 'new-2', locales: { _default: { path: 'entry2.md' } } };
      const newAsset = { path: 'asset1.jpg' };

      updateStores({
        entries: [newEntry, newChangedEntry],
        assets: [newAsset],
        configFiles: [],
        changedPaths: new Set(['entry2.md']),
      });

      // Unchanged: the same object; changed: the new object under the old ID
      expect(allEntries.current[0]).toBe(oldEntry);
      expect(allEntries.current[1]).toEqual({ ...newChangedEntry, id: 'old-2' });
      expect(allAssets.current[0]).toBe(oldAsset);
    });

    it('should treat every file as changed when the changed paths are not given', () => {
      const oldEntry = { id: 'old-1', locales: { _default: { path: 'entry1.md' } } };
      const oldAsset = { path: 'asset1.jpg', blobURL: 'blob:1' };

      allEntries.current = [oldEntry];
      allAssets.current = [oldAsset];

      const newEntry = { id: 'new-1', locales: { _default: { path: 'entry1.md' } } };
      const newAsset = { path: 'asset1.jpg' };

      updateStores({ entries: [newEntry], assets: [newAsset], configFiles: [] });

      expect(allEntries.current[0]).toEqual({ ...newEntry, id: 'old-1' });
      expect(allAssets.current[0]).toBe(newAsset);
    });

    it('should update stores with empty errors array by default', () => {
      const entries = [];
      const assets = [];
      const configFiles = [];

      updateStores({ entries, assets, configFiles });

      expect(entryParseErrors.current).toEqual([]);
      expect(dataLoaded.current).toEqual(true);
    });
  });

  describe('applyFileMetadata', () => {
    const meta = {
      commitAuthor: { name: 'Author', email: 'a@example.com', id: 1, login: 'author' },
      commitDate: new Date('2024-01-01T00:00:00Z'),
    };

    beforeEach(() => {
      allEntries.current = [];
      allAssets.current = [];
    });

    it('should fill in the metadata of the fetched files, entries and assets', () => {
      const fetchedFileMap = /** @type {any} */ ({
        'posts/a.md': { sha: 'sha1', size: 1, text: '', meta: undefined },
        'img/a.png': { sha: 'sha2', size: 1, meta: undefined },
      });

      const entry = /** @type {any} */ ({
        id: 'a',
        locales: { en: { path: 'posts/a.md' }, fr: { path: 'posts/a.fr.md' } },
      });

      const asset = /** @type {any} */ ({ path: 'img/a.png' });

      allEntries.current = [entry];
      allAssets.current = [asset];

      applyFileMetadata({
        fetchedFileMap,
        metadataMap: { 'posts/a.md': meta, 'img/a.png': meta, 'other.md': meta },
      });

      // Cached along with the text, so the file isn’t fetched again next time
      expect(fetchedFileMap['posts/a.md'].meta).toBe(meta);
      expect(fetchedFileMap['img/a.png'].meta).toBe(meta);
      expect(allEntries.current).toEqual([{ ...entry, ...meta }]);
      expect(allAssets.current).toEqual([{ ...asset, ...meta }]);
    });

    it('should take the metadata from whichever file of an entry is known', () => {
      const entry = /** @type {any} */ ({
        id: 'a',
        locales: { en: { path: 'posts/a.md' }, fr: { path: 'posts/a.fr.md' } },
      });

      allEntries.current = [entry];

      applyFileMetadata({ fetchedFileMap: {}, metadataMap: { 'posts/a.fr.md': meta } });

      expect(allEntries.current[0].commitDate).toBe(meta.commitDate);
    });

    it('should leave an entry or asset saved in the meantime alone', () => {
      const newer = new Date('2024-06-01T00:00:00Z');

      const entry = /** @type {any} */ ({
        id: 'a',
        locales: { en: { path: 'posts/a.md' } },
        commitDate: newer,
      });

      const asset = /** @type {any} */ ({ path: 'img/a.png', commitDate: newer });
      const entries = [entry];
      const assets = [asset];

      allEntries.current = entries;
      allAssets.current = assets;

      applyFileMetadata({
        fetchedFileMap: {},
        metadataMap: { 'posts/a.md': meta, 'img/a.png': meta },
      });

      // Nothing changed, so the store arrays aren’t even replaced
      expect(allEntries.current).toBe(entries);
      expect(allAssets.current).toBe(assets);
      expect(entry.commitDate).toBe(newer);
    });

    it('should not touch the stores when nothing matches', () => {
      const entries = [/** @type {any} */ ({ id: 'a', locales: { en: { path: 'posts/a.md' } } })];
      const assets = [/** @type {any} */ ({ path: 'img/a.png' })];

      allEntries.current = entries;
      allAssets.current = assets;

      applyFileMetadata({ fetchedFileMap: {}, metadataMap: { 'unrelated.md': meta } });

      expect(allEntries.current).toBe(entries);
      expect(allAssets.current).toBe(assets);
    });
  });
});
