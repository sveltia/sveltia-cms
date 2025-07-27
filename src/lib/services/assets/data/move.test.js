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
  siteConfig: {
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
      const _siteConfig = { editor: { preview: true } };

      // Test that the function completes without error
      await expect(
        collectEntryChanges({
          _siteConfig,
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
      const _siteConfig = {};

      // Test that the function completes without error
      await expect(
        collectEntryChanges({
          _siteConfig,
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
      const _siteConfig = {};
      const _globalAssetFolder = { publicPath: '/global' };

      // Test that the function completes without error
      await expect(
        collectEntryChangesFromAsset({
          _siteConfig,
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
        _siteConfig: {},
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
