// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addSavingEntryData,
  collectEntryChanges,
  collectEntryChangesFromAsset,
  getDraftBaseProps,
  moveAssets,
  updateStores,
} from './move.js';

// Mock dependencies
vi.mock('$lib/services/contents/collection', () => ({
  allCollections: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  allCollectionFiles: { subscribe: vi.fn() },
  getCollectionFilesByEntry: vi.fn(),
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: {
    subscribe: vi.fn(),
    set: vi.fn(),
  },
  focusedAsset: {
    subscribe: vi.fn(),
    set: vi.fn(),
  },
  overlaidAsset: {
    subscribe: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('$lib/services/assets/data', () => ({
  assetUpdatesToast: {
    set: vi.fn(),
  },
}));

vi.mock('$lib/services/assets/folders', () => ({
  getAssetFoldersByPath: vi.fn(),
  globalAssetFolder: {
    subscribe: vi.fn(),
  },
}));

vi.mock('$lib/services/assets/info', () => ({
  getAssetBlob: vi.fn(),
  getAssetPublicURL: vi.fn(),
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: {
    subscribe: vi.fn(),
  },
}));

vi.mock('$lib/services/contents/collection/data', () => ({
  UPDATE_TOAST_DEFAULT_STATE: {
    saved: false,
    published: false,
    deleted: false,
    moved: false,
    renamed: false,
    count: 0,
  },
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByAssetURL: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/index-file', () => ({
  getIndexFile: vi.fn(),
  isCollectionIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/save/changes', () => ({
  createSavingEntryData: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/slugs', () => ({
  getSlugs: vi.fn(),
}));

vi.mock('$lib/services/contents/entry', () => ({
  getAssociatedCollections: vi.fn(),
}));

vi.mock('@sveltia/utils/file', () => ({
  getPathInfo: vi.fn(),
}));

vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

describe('assets/data/move', () => {
  describe('getDraftBaseProps', () => {
    it('should return draft properties with original entry', () => {
      const entry = {
        id: 'test-post-id',
        slug: 'test-post',
        collectionName: 'blog',
        fileName: 'post.md',
        subPath: '',
        locales: {
          en: {
            path: '/content/blog/test-post.md',
            sha: 'abc123',
            slug: 'test-post',
            content: { title: 'Test Post' },
          },
        },
      };

      const result = getDraftBaseProps({ entry });

      expect(result.originalEntry).toBe(entry);
      expect(result.isNew).toBe(false);
      expect(result.originalLocales).toEqual({ en: true });
      expect(result.currentLocales).toEqual({ en: true });
      expect(result.originalSlugs).toEqual({ en: 'test-post' });
      expect(result.currentSlugs).toEqual({ en: 'test-post' });
      expect(result.originalValues).toEqual({ en: { title: 'Test Post' } });
      expect(result.currentValues).toEqual({ en: { title: 'Test Post' } });
      expect(typeof result.createdAt).toBe('number');
      expect(result.files).toEqual({});
      expect(result.validities).toEqual({});
      expect(result.expanderStates).toEqual({});
    });

    it('should handle entry without locales', () => {
      const entry = {
        id: 'test-post-id',
        slug: 'test-post',
        collectionName: 'blog',
        fileName: 'post.md',
        subPath: '',
        locales: {},
      };

      const result = getDraftBaseProps({ entry });

      expect(result.originalEntry).toBe(entry);
      expect(result.originalLocales).toEqual({});
      expect(result.currentLocales).toEqual({});
      expect(result.originalSlugs).toEqual({});
      expect(result.currentSlugs).toEqual({});
    });

    it('should handle entry with multiple locales', () => {
      const entry = {
        id: 'test-post-id',
        slug: 'test-post',
        collectionName: 'blog',
        fileName: 'post.md',
        subPath: '',
        locales: {
          en: {
            path: '/content/blog/en/test-post.md',
            sha: 'abc123',
            slug: 'test-post-en',
            content: { title: 'Test Post EN' },
          },
          es: {
            path: '/content/blog/es/test-post.md',
            sha: 'def456',
            slug: 'test-post-es',
            content: { title: 'Test Post ES' },
          },
        },
      };

      const result = getDraftBaseProps({ entry });

      expect(result.originalLocales).toEqual({ en: true, es: true });
      expect(result.originalSlugs).toEqual({ en: 'test-post-en', es: 'test-post-es' });
      expect(result.originalValues).toEqual({
        en: { title: 'Test Post EN' },
        es: { title: 'Test Post ES' },
      });
    });
  });

  describe('addSavingEntryData', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should add saving entry data with regular fields', async () => {
      const mockSavingEntry = /** @type {import('$lib/types/private').Entry} */ ({
        id: 'test-entry',
        slug: 'test-slug',
        subPath: 'test.md',
        locales: {
          en: {
            path: 'content/test.md',
            sha: 'abc123',
            slug: 'test-slug',
            content: { title: 'Test' },
          },
        },
      });

      const mockChanges = /** @type {import('$lib/types/private').FileChange[]} */ ([
        { action: 'create', path: 'test.md', data: 'content', sha: undefined },
      ]);

      const { createSavingEntryData } = await import('$lib/services/contents/draft/save/changes');
      const { getSlugs } = await import('$lib/services/contents/draft/slugs');

      vi.mocked(createSavingEntryData).mockResolvedValue({
        savingEntry: mockSavingEntry,
        changes: mockChanges,
      });
      vi.mocked(getSlugs).mockReturnValue({ default: 'test-slug' });

      const draftProps = {
        collection: {
          fields: [{ name: 'title', widget: 'string' }],
        },
        collectionFile: undefined,
      };

      /** @type {import('$lib/types/private').Entry[]} */
      const savingEntries = [];
      /** @type {import('$lib/types/private').FileChange[]} */
      const changes = [];

      await addSavingEntryData({
        draftProps,
        indexFile: undefined,
        savingEntries,
        changes,
      });

      expect(savingEntries).toContain(mockSavingEntry);
      expect(changes).toEqual(mockChanges);
      expect(createSavingEntryData).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          ...draftProps,
          fields: draftProps.collection.fields,
        }),
        slugs: { default: 'test-slug' },
      });
    });

    it('should use index file fields when available', async () => {
      const { createSavingEntryData } = await import('$lib/services/contents/draft/save/changes');
      const { getSlugs } = await import('$lib/services/contents/draft/slugs');

      vi.mocked(createSavingEntryData).mockResolvedValue({
        savingEntry: /** @type {import('$lib/types/private').Entry} */ ({
          id: 'test',
          slug: 'test',
          subPath: 'test.md',
          locales: {},
        }),
        changes: [],
      });
      vi.mocked(getSlugs).mockReturnValue({});

      const draftProps = {
        collection: {
          fields: [{ name: 'title', widget: 'string' }],
        },
        collectionFile: {
          fields: [{ name: 'description', widget: 'text' }],
        },
      };

      const indexFile = {
        fields: [{ name: 'custom', widget: 'string' }],
      };

      /** @type {import('$lib/types/private').Entry[]} */
      const savingEntries = [];
      /** @type {import('$lib/types/private').FileChange[]} */
      const changes = [];

      await addSavingEntryData({
        draftProps,
        indexFile,
        savingEntries,
        changes,
      });

      expect(createSavingEntryData).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          fields: indexFile.fields,
        }),
        slugs: {},
      });
    });

    it('should use regularFields when indexFile exists but has no fields', async () => {
      const { createSavingEntryData } = await import('$lib/services/contents/draft/save/changes');
      const { getSlugs } = await import('$lib/services/contents/draft/slugs');

      vi.mocked(createSavingEntryData).mockResolvedValue({
        savingEntry: /** @type {import('$lib/types/private').Entry} */ ({
          id: 'test',
          slug: 'test',
          subPath: 'test.md',
          locales: {},
        }),
        changes: [],
      });
      vi.mocked(getSlugs).mockReturnValue({});

      const regularFields = [{ name: 'title', widget: 'string' }];

      const draftProps = {
        collection: {
          fields: regularFields,
        },
        collectionFile: undefined,
      };

      const indexFile = {
        fields: undefined,
      };

      /** @type {import('$lib/types/private').Entry[]} */
      const savingEntries = [];
      /** @type {import('$lib/types/private').FileChange[]} */
      const changes = [];

      await addSavingEntryData({
        draftProps,
        indexFile,
        savingEntries,
        changes,
      });

      // Should use regularFields when indexFile.fields is undefined
      expect(createSavingEntryData).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          fields: regularFields,
        }),
        slugs: {},
      });
    });

    it('should use collectionFile fields when collectionFile has no fields property', async () => {
      const { createSavingEntryData } = await import('$lib/services/contents/draft/save/changes');
      const { getSlugs } = await import('$lib/services/contents/draft/slugs');

      vi.mocked(createSavingEntryData).mockResolvedValue({
        savingEntry: /** @type {import('$lib/types/private').Entry} */ ({
          id: 'test',
          slug: 'test',
          subPath: 'test.md',
          locales: {},
        }),
        changes: [],
      });
      vi.mocked(getSlugs).mockReturnValue({});

      const collectionFileData = {
        name: 'config',
      };

      const draftProps = {
        collection: {
          fields: [{ name: 'fallback', widget: 'string' }],
        },
        collectionFile: collectionFileData,
      };

      /** @type {import('$lib/types/private').Entry[]} */
      const savingEntries = [];
      /** @type {import('$lib/types/private').FileChange[]} */
      const changes = [];

      await addSavingEntryData({
        draftProps,
        indexFile: undefined,
        savingEntries,
        changes,
      });

      // Should use collectionFile which has no fields property, defaulting to []
      expect(createSavingEntryData).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          fields: [],
        }),
        slugs: {},
      });
    });
  });

  describe('collectEntryChanges', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should collect changes for associated collections', async () => {
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const { isCollectionIndexFile, getIndexFile } = await import(
        '$lib/services/contents/collection/index-file'
      );

      const mockEntry = {
        id: 'test-entry',
        locales: {
          en: { path: 'content/test.md', content: {} },
        },
      };

      const mockCollection = {
        name: 'posts',
        editor: { preview: true },
      };

      vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getIndexFile).mockReturnValue(undefined);

      const savingEntries = [];
      const changes = [];
      const _cmsConfig = { editor: { preview: true } };

      // Test that the function completes without error
      await expect(
        collectEntryChanges({
          _cmsConfig,
          entry: mockEntry,
          savingEntries,
          changes,
        }),
      ).resolves.not.toThrow();

      expect(getAssociatedCollections).toHaveBeenCalledWith(mockEntry);
    });

    it('should handle collection files', async () => {
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const { isCollectionIndexFile } = await import(
        '$lib/services/contents/collection/index-file'
      );

      const mockEntry = {
        id: 'test-entry',
        locales: {
          en: { path: 'content/test.md', content: {} },
        },
      };

      const mockCollection = {
        name: 'settings',
      };

      const mockCollectionFile = {
        name: 'general',
        fields: [],
      };

      vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([mockCollectionFile]);
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);

      const savingEntries = [];
      const changes = [];
      const _cmsConfig = {};

      // Test that the function completes without error
      await expect(
        collectEntryChanges({
          _cmsConfig,
          entry: mockEntry,
          savingEntries,
          changes,
        }),
      ).resolves.not.toThrow();

      expect(getAssociatedCollections).toHaveBeenCalledWith(mockEntry);
      expect(getCollectionFilesByEntry).toHaveBeenCalledWith(mockCollection, mockEntry);
    });
  });

  describe('collectEntryChangesFromAsset', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should collect changes for asset with entries', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'assets/image.jpg',
        folder: { internalPath: 'assets' },
        blobURL: undefined,
      };

      const mockFolder = {
        collectionName: 'posts',
        publicPath: '/images',
      };

      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/assets/image.jpg');
      vi.mocked(getEntriesByAssetURL).mockResolvedValue([]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([mockFolder]);

      const savingEntries = [];
      const changes = [];
      const _cmsConfig = {};
      const _globalAssetFolder = { publicPath: '/global' };

      // Test that the function completes without error
      await expect(
        collectEntryChangesFromAsset({
          _cmsConfig,
          _globalAssetFolder,
          newPath: 'new-assets/image.jpg',
          asset: mockAsset,
          savingEntries,
          changes,
        }),
      ).resolves.not.toThrow();

      expect(getAssetPublicURL).toHaveBeenCalledWith(mockAsset);
    });

    it('should handle asset without URL', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');

      const mockAsset = {
        path: 'assets/image.jpg',
        folder: { internalPath: 'assets' },
        blobURL: undefined,
      };

      vi.mocked(getAssetPublicURL).mockReturnValue(undefined);

      const savingEntries = [];
      const changes = [];

      await collectEntryChangesFromAsset({
        _cmsConfig: {},
        _globalAssetFolder: {},
        newPath: 'new-path.jpg',
        asset: mockAsset,
        savingEntries,
        changes,
      });

      // Should return early without making further calls
      expect(savingEntries).toHaveLength(0);
      expect(changes).toHaveLength(0);
    });

    it('should handle asset with used entries but no updating entries', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'assets/image.jpg',
        folder: { internalPath: 'assets' },
        blobURL: undefined,
      };

      const mockFolder = {
        collectionName: 'posts',
        publicPath: '/images',
      };

      const mockUsedEntry = { id: 'entry1', title: 'Test' };

      // First call returns used entries, second call returns empty (no updating entries)
      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/assets/image.jpg');
      vi.mocked(getEntriesByAssetURL)
        .mockResolvedValueOnce([mockUsedEntry])
        .mockResolvedValueOnce([]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([mockFolder]);

      const savingEntries = [];
      const changes = [];

      await collectEntryChangesFromAsset({
        _cmsConfig: {},
        _globalAssetFolder: { publicPath: '/global' },
        newPath: 'new-assets/image.jpg',
        asset: mockAsset,
        savingEntries,
        changes,
      });

      // Should return early when no updating entries found
      expect(savingEntries).toHaveLength(0);
      expect(changes).toHaveLength(0);
    });

    it('should collect changes for asset with updating entries', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'assets/image.jpg',
        folder: { internalPath: 'assets' },
        blobURL: undefined,
      };

      const mockFolder = {
        collectionName: 'posts',
        publicPath: '/images',
      };

      const mockUsedEntry = { id: 'entry1', title: 'Test' };

      const mockUpdatingEntry = {
        id: 'entry1',
        title: 'Test Updated',
        locales: { en: { path: 'content/test.md', content: {} } },
      };

      // First call returns used entries, second call returns updating entries
      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/assets/image.jpg');
      vi.mocked(getEntriesByAssetURL)
        .mockResolvedValueOnce([mockUsedEntry])
        .mockResolvedValueOnce([mockUpdatingEntry]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([mockFolder]);

      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const { isCollectionIndexFile } = await import(
        '$lib/services/contents/collection/index-file'
      );

      vi.mocked(getAssociatedCollections).mockReturnValue([]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);

      const savingEntries = [];
      const changes = [];

      await collectEntryChangesFromAsset({
        _globalAssetFolder: { publicPath: '/global' },
        newPath: 'new-assets/image.jpg',
        asset: mockAsset,
        savingEntries,
        changes,
      });

      // Should call getEntriesByAssetURL twice and process updating entries
      expect(getEntriesByAssetURL).toHaveBeenCalledTimes(2);
      expect(getAssociatedCollections).toHaveBeenCalledWith(mockUpdatingEntry);
    });

    it('should use blobURL when getAssetPublicURL returns undefined', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');

      const mockAsset = {
        path: 'assets/image.jpg',
        folder: { internalPath: 'assets' },
        blobURL: 'blob:http://example.com/12345',
      };

      vi.mocked(getAssetPublicURL).mockReturnValue(undefined);
      vi.mocked(getEntriesByAssetURL).mockResolvedValue([]);

      const savingEntries = [];
      const changes = [];

      await collectEntryChangesFromAsset({
        _globalAssetFolder: {},
        newPath: 'new-assets/image.jpg',
        asset: mockAsset,
        savingEntries,
        changes,
      });

      // Should use blobURL as fallback
      expect(getEntriesByAssetURL).toHaveBeenCalledWith('blob:http://example.com/12345');
    });

    it('should handle asset folder without internalPath', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'assets/image.jpg',
        folder: { internalPath: undefined },
        blobURL: undefined,
      };

      const mockFolder = {
        collectionName: 'posts',
        publicPath: '/images',
      };

      const mockUsedEntry = { id: 'entry1' };

      const mockUpdatingEntry = {
        id: 'entry1',
        locales: { en: { path: 'content/test.md', content: {} } },
      };

      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/assets/image.jpg');
      vi.mocked(getEntriesByAssetURL)
        .mockResolvedValueOnce([mockUsedEntry])
        .mockResolvedValueOnce([mockUpdatingEntry]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([mockFolder]);

      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const { isCollectionIndexFile } = await import(
        '$lib/services/contents/collection/index-file'
      );

      vi.mocked(getAssociatedCollections).mockReturnValue([]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);

      const savingEntries = [];
      const changes = [];

      await collectEntryChangesFromAsset({
        _globalAssetFolder: { publicPath: '/global' },
        newPath: 'new-assets/image.jpg',
        asset: mockAsset,
        savingEntries,
        changes,
      });

      // When internalPath is undefined (becomes ''), replace('', publicPath) prepends publicPath
      expect(getEntriesByAssetURL).toHaveBeenLastCalledWith(
        'https://example.com/assets/image.jpg',
        expect.objectContaining({
          newURL: '/imagesnew-assets/image.jpg', // '' is replaced with '/images'
        }),
      );
    });

    it('should use global asset folder publicPath when collection not found', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'assets/image.jpg',
        folder: { internalPath: 'assets' },
        blobURL: undefined,
      };

      const mockUsedEntry = { id: 'entry1' };

      const mockUpdatingEntry = {
        id: 'entry1',
        locales: { en: { path: 'content/test.md', content: {} } },
      };

      // Return empty array so find returns undefined
      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/assets/image.jpg');
      vi.mocked(getEntriesByAssetURL)
        .mockResolvedValueOnce([mockUsedEntry])
        .mockResolvedValueOnce([mockUpdatingEntry]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const { isCollectionIndexFile } = await import(
        '$lib/services/contents/collection/index-file'
      );

      vi.mocked(getAssociatedCollections).mockReturnValue([]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);

      const savingEntries = [];
      const changes = [];
      const globalPublicPath = '/media';

      await collectEntryChangesFromAsset({
        _globalAssetFolder: { publicPath: globalPublicPath },
        newPath: 'new-assets/image.jpg',
        asset: mockAsset,
        savingEntries,
        changes,
      });

      // Should use global asset folder publicPath
      expect(getEntriesByAssetURL).toHaveBeenLastCalledWith(
        'https://example.com/assets/image.jpg',
        expect.objectContaining({
          newURL: expect.stringContaining(globalPublicPath),
        }),
      );
    });

    it('should handle global asset folder with undefined publicPath', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'assets/image.jpg',
        folder: { internalPath: 'assets' },
        blobURL: undefined,
      };

      const mockUsedEntry = { id: 'entry1' };

      const mockUpdatingEntry = {
        id: 'entry1',
        locales: { en: { path: 'content/test.md', content: {} } },
      };

      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/assets/image.jpg');
      vi.mocked(getEntriesByAssetURL)
        .mockResolvedValueOnce([mockUsedEntry])
        .mockResolvedValueOnce([mockUpdatingEntry]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const { isCollectionIndexFile } = await import(
        '$lib/services/contents/collection/index-file'
      );

      vi.mocked(getAssociatedCollections).mockReturnValue([]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);

      const savingEntries = [];
      const changes = [];

      await collectEntryChangesFromAsset({
        _globalAssetFolder: { publicPath: undefined },
        newPath: 'new-assets/image.jpg',
        asset: mockAsset,
        savingEntries,
        changes,
      });

      // Should use undefined as publicPath when global has undefined
      expect(getEntriesByAssetURL).toHaveBeenLastCalledWith(
        'https://example.com/assets/image.jpg',
        expect.objectContaining({
          newURL: expect.any(String),
        }),
      );
    });

    it('should handle when both find() and ?? return globalAssetFolder', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'assets/image.jpg',
        folder: { internalPath: 'assets' },
        blobURL: undefined,
      };

      const mockUsedEntry = { id: 'entry1' };

      const mockUpdatingEntry = {
        id: 'entry1',
        locales: { en: { path: 'content/test.md', content: {} } },
      };

      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/assets/image.jpg');
      vi.mocked(getEntriesByAssetURL)
        .mockResolvedValueOnce([mockUsedEntry])
        .mockResolvedValueOnce([mockUpdatingEntry]);
      // Return array with folder that doesn't have collectionName !== undefined property
      vi.mocked(getAssetFoldersByPath).mockReturnValue([{ publicPath: '/local' }]);

      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const { isCollectionIndexFile } = await import(
        '$lib/services/contents/collection/index-file'
      );

      vi.mocked(getAssociatedCollections).mockReturnValue([]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);

      const savingEntries = [];
      const changes = [];

      await collectEntryChangesFromAsset({
        _globalAssetFolder: { publicPath: '/global' },
        newPath: 'new-assets/image.jpg',
        asset: mockAsset,
        savingEntries,
        changes,
      });

      // Should use global publicPath when find() doesn't find a folder with collectionName
      expect(getEntriesByAssetURL).toHaveBeenLastCalledWith(
        'https://example.com/assets/image.jpg',
        expect.objectContaining({
          newURL: expect.stringContaining('/global'),
        }),
      );
    });

    it('should collect changes for multiple updating entries', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');

      const mockAsset = {
        path: 'assets/image.jpg',
        folder: { internalPath: 'assets' },
        blobURL: undefined,
      };

      const mockFolder = {
        collectionName: 'posts',
        publicPath: '/images',
      };

      const mockUsedEntry = { id: 'entry1' };

      const mockUpdatingEntry1 = {
        id: 'entry1',
        locales: { en: { path: 'content/test1.md', content: {} } },
      };

      const mockUpdatingEntry2 = {
        id: 'entry2',
        locales: { en: { path: 'content/test2.md', content: {} } },
      };

      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/assets/image.jpg');
      vi.mocked(getEntriesByAssetURL)
        .mockResolvedValueOnce([mockUsedEntry])
        .mockResolvedValueOnce([mockUpdatingEntry1, mockUpdatingEntry2]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([mockFolder]);

      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const { isCollectionIndexFile } = await import(
        '$lib/services/contents/collection/index-file'
      );

      vi.mocked(getAssociatedCollections).mockReturnValue([]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);

      const savingEntries = [];
      const changes = [];

      await collectEntryChangesFromAsset({
        _globalAssetFolder: { publicPath: '/global' },
        newPath: 'new-assets/image.jpg',
        asset: mockAsset,
        savingEntries,
        changes,
      });

      // Should process both updating entries
      expect(getAssociatedCollections).toHaveBeenCalledTimes(2);
      expect(getAssociatedCollections).toHaveBeenNthCalledWith(1, mockUpdatingEntry1);
      expect(getAssociatedCollections).toHaveBeenNthCalledWith(2, mockUpdatingEntry2);
    });
  });

  describe('updateStores', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should update stores after moving assets', async () => {
      const { get } = await import('svelte/store');
      const { allAssets, focusedAsset, overlaidAsset } = await import('$lib/services/assets');
      const { assetUpdatesToast } = await import('$lib/services/assets/data');
      const mockAsset1 = { path: 'old1.jpg' };
      const mockAsset2 = { path: 'old2.jpg' };
      const mockNewAsset1 = { path: 'new1.jpg' };
      const mockNewAsset2 = { path: 'new2.jpg' };

      const movedAssets = [
        { asset: mockAsset1, path: 'new1.jpg' },
        { asset: mockAsset2, path: 'new2.jpg' },
      ];

      vi.mocked(get).mockImplementation((store) => {
        if (store === allAssets) return [mockNewAsset1, mockNewAsset2];
        if (store === focusedAsset) return mockAsset1;
        if (store === overlaidAsset) return mockAsset2;
        return undefined;
      });

      updateStores({ action: 'move', movedAssets });

      expect(focusedAsset.set).toHaveBeenCalledWith(mockNewAsset1);
      expect(overlaidAsset.set).toHaveBeenCalledWith(mockNewAsset2);
      expect(assetUpdatesToast.set).toHaveBeenCalledWith({
        saved: false,
        published: false,
        deleted: false,
        moved: true,
        renamed: false,
        count: 2,
      });
    });

    it('should update stores after renaming assets', async () => {
      const { get } = await import('svelte/store');
      const { assetUpdatesToast } = await import('$lib/services/assets/data');

      vi.mocked(get).mockReturnValue(undefined);

      const movedAssets = [{ asset: { path: 'old.jpg' }, path: 'new.jpg' }];

      updateStores({ action: 'rename', movedAssets });

      expect(assetUpdatesToast.set).toHaveBeenCalledWith({
        saved: false,
        published: false,
        deleted: false,
        moved: false,
        renamed: true,
        count: 1,
      });
    });

    it('should handle focused asset not in movedAssets', async () => {
      const { get } = await import('svelte/store');
      const { allAssets, focusedAsset, overlaidAsset } = await import('$lib/services/assets');
      const mockAsset = { path: 'different.jpg' };
      const mockMovedAsset = { path: 'moved.jpg' };
      const mockNewAsset = { path: 'new.jpg' };
      const movedAssets = [{ asset: mockMovedAsset, path: 'new.jpg' }];

      vi.mocked(get).mockImplementation((store) => {
        if (store === allAssets) return [mockNewAsset];
        if (store === focusedAsset) return mockAsset;
        if (store === overlaidAsset) return undefined;
        return undefined;
      });

      updateStores({ action: 'move', movedAssets });

      // focusedAsset should not be set since it's not in movedAssets
      expect(focusedAsset.set).not.toHaveBeenCalled();
    });

    it('should handle focused asset found in allAssets', async () => {
      const { get } = await import('svelte/store');
      const { allAssets, focusedAsset, overlaidAsset } = await import('$lib/services/assets');
      const mockMovedAsset = { path: 'old.jpg' };
      const mockNewAsset = { path: 'new.jpg' };
      const mockAllAssets = [mockNewAsset];
      const movedAssets = [{ asset: mockMovedAsset, path: 'new.jpg' }];

      vi.mocked(get).mockImplementation((store) => {
        if (store === allAssets) return mockAllAssets;
        if (store === focusedAsset) return mockMovedAsset;
        if (store === overlaidAsset) return undefined;
        return undefined;
      });

      updateStores({ action: 'move', movedAssets });

      // focusedAsset should be set to the matching asset from allAssets
      expect(focusedAsset.set).toHaveBeenCalledWith(mockNewAsset);
    });

    it('should handle focused asset not found in allAssets', async () => {
      const { get } = await import('svelte/store');
      const { allAssets, focusedAsset, overlaidAsset } = await import('$lib/services/assets');
      const mockMovedAsset = { path: 'old.jpg' };
      const movedAssets = [{ asset: mockMovedAsset, path: 'new.jpg' }];

      vi.mocked(get).mockImplementation((store) => {
        if (store === allAssets) return []; // Empty array, asset not found
        if (store === focusedAsset) return mockMovedAsset;
        if (store === overlaidAsset) return undefined;
        return undefined;
      });

      updateStores({ action: 'move', movedAssets });

      // focusedAsset should be set to undefined
      expect(focusedAsset.set).toHaveBeenCalledWith(undefined);
    });

    it('should handle overlaid asset not found in allAssets', async () => {
      const { get } = await import('svelte/store');
      const { allAssets, focusedAsset, overlaidAsset } = await import('$lib/services/assets');
      const mockMovedAsset = { path: 'old.jpg' };
      const mockFocusedAsset = { path: 'focused.jpg' };
      const movedAssets = [{ asset: mockMovedAsset, path: 'new.jpg' }];

      vi.mocked(get).mockImplementation((store) => {
        if (store === allAssets) return [];
        if (store === focusedAsset) return mockFocusedAsset;
        if (store === overlaidAsset) return mockMovedAsset;
        return undefined;
      });

      updateStores({ action: 'rename', movedAssets });

      // overlaidAsset should be set to undefined
      expect(overlaidAsset.set).toHaveBeenCalledWith(undefined);
    });

    it('should handle overlaid asset found in allAssets', async () => {
      const { get } = await import('svelte/store');
      const { allAssets, focusedAsset, overlaidAsset } = await import('$lib/services/assets');
      const mockMovedAsset = { path: 'old.jpg' };
      const mockNewAsset = { path: 'new.jpg' };
      const mockAllAssets = [mockNewAsset];
      const movedAssets = [{ asset: mockMovedAsset, path: 'new.jpg' }];

      vi.mocked(get).mockImplementation((store) => {
        if (store === allAssets) return mockAllAssets;
        if (store === focusedAsset) return undefined;
        if (store === overlaidAsset) return mockMovedAsset;
        return undefined;
      });

      updateStores({ action: 'move', movedAssets });

      // overlaidAsset should be set to the matching asset from allAssets
      expect(overlaidAsset.set).toHaveBeenCalledWith(mockNewAsset);
    });
  });

  describe('moveAssets', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should move assets and update entries', async () => {
      const { get } = await import('svelte/store');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetBlob } = await import('$lib/services/assets/info');
      const { saveChanges } = await import('$lib/services/backends/save');

      const mockAsset = {
        path: 'old/image.jpg',
        sha: 'abc123',
        file: undefined,
      };

      const movingAssets = [{ asset: mockAsset, path: 'new/image.jpg' }];

      vi.mocked(get).mockReturnValue({ editor: { preview: true } });
      vi.mocked(getPathInfo).mockReturnValue({ basename: 'image.jpg' });
      vi.mocked(getAssetBlob).mockResolvedValue(new Blob(['content']));
      vi.mocked(saveChanges).mockResolvedValue({});

      // Test that the function completes without error
      await expect(moveAssets('move', movingAssets)).resolves.not.toThrow();

      expect(saveChanges).toHaveBeenCalled();
      expect(getAssetBlob).toHaveBeenCalledWith(mockAsset);
    });

    it('should handle asset with existing file', async () => {
      const { get } = await import('svelte/store');
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { saveChanges } = await import('$lib/services/backends/save');
      const mockFile = new File(['content'], 'image.jpg');

      const mockAsset = {
        path: 'old/image.jpg',
        sha: 'abc123',
        file: mockFile,
      };

      const movingAssets = [{ asset: mockAsset, path: 'new/image.jpg' }];

      vi.mocked(get).mockReturnValue({});
      vi.mocked(getPathInfo).mockReturnValue({ basename: 'image.jpg' });
      vi.mocked(saveChanges).mockResolvedValue({});

      // Test that the function completes without error
      await expect(moveAssets('rename', movingAssets)).resolves.not.toThrow();

      expect(saveChanges).toHaveBeenCalled();
    });
  });
});
