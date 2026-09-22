// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

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
  allCollections: { current: undefined },
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  allCollectionFiles: { current: undefined },
  getCollectionFilesByEntry: vi.fn(),
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: { current: undefined },
  focusedAsset: { current: undefined },
  overlaidAsset: { current: undefined },
  getAssetByInternalPath: vi.fn(),
}));

vi.mock('$lib/services/assets/data', () => ({
  assetUpdatesToast: {
    set: vi.fn(),
  },
}));

vi.mock('$lib/services/assets/folders', () => ({
  getAssetFoldersByPath: vi.fn(),
  globalAssetFolder: { current: undefined },
}));

vi.mock('$lib/services/assets/info', () => ({
  getAssetBlob: vi.fn(),
  getAssetPublicURL: vi.fn(),
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
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

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
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

      const { isCollectionIndexFile, getIndexFile } =
        await import('$lib/services/contents/collection/entries/index-file');

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

      const { isCollectionIndexFile } =
        await import('$lib/services/contents/collection/entries/index-file');

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

    it('should call getIndexFile when entry is an index file (line 111 true branch)', async () => {
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');

      const { isCollectionIndexFile, getIndexFile } =
        await import('$lib/services/contents/collection/entries/index-file');

      const mockEntry = {
        id: 'index-entry',
        locales: {
          en: { path: 'content/blog/_index.md', content: {} },
        },
      };

      const mockCollection = {
        name: 'blog',
        editor: { preview: true },
      };

      const mockIndexFile = { name: '_index', format: 'yaml-frontmatter' };

      vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
      vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
      // isIndexFile = true → indexFile = getIndexFile(collection) branch is taken
      vi.mocked(isCollectionIndexFile).mockReturnValue(true);
      vi.mocked(getIndexFile).mockReturnValue(mockIndexFile);

      const savingEntries = [];
      const changes = [];
      const _cmsConfig = {};

      await expect(
        collectEntryChanges({
          _cmsConfig,
          entry: mockEntry,
          savingEntries,
          changes,
        }),
      ).resolves.not.toThrow();

      expect(getIndexFile).toHaveBeenCalledWith(mockCollection);
    });
  });

  describe('collectEntryChangesFromAsset', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    const mockAsset = {
      path: 'assets/image.jpg',
      folder: { internalPath: 'assets' },
      blobURL: undefined,
    };

    it('should do nothing for an asset without a URL', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');

      vi.mocked(getAssetPublicURL).mockReturnValue(undefined);

      const updatingEntryMap = new Map();

      await collectEntryChangesFromAsset({
        _globalAssetFolder: {},
        newPath: 'new-path.jpg',
        asset: mockAsset,
        updatingEntryMap,
      });

      expect(getEntriesByAssetURL).not.toHaveBeenCalled();
      expect(updatingEntryMap.size).toBe(0);
    });

    it('should do nothing for an asset no entry uses', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');

      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/assets/image.jpg');
      vi.mocked(getEntriesByAssetURL).mockResolvedValue([]);

      const updatingEntryMap = new Map();

      await collectEntryChangesFromAsset({
        _globalAssetFolder: {},
        newPath: 'new-assets/image.jpg',
        asset: mockAsset,
        updatingEntryMap,
      });

      expect(getEntriesByAssetURL).toHaveBeenCalledOnce();
      expect(updatingEntryMap.size).toBe(0);
    });

    it('should use the blob URL when the asset has no public URL', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');

      vi.mocked(getAssetPublicURL).mockReturnValue(undefined);
      vi.mocked(getEntriesByAssetURL).mockResolvedValue([]);

      await collectEntryChangesFromAsset({
        _globalAssetFolder: {},
        newPath: 'new-assets/image.jpg',
        asset: { ...mockAsset, blobURL: 'blob:http://example.com/12345' },
        updatingEntryMap: new Map(),
      });

      expect(getEntriesByAssetURL).toHaveBeenCalledWith('blob:http://example.com/12345');
    });

    it('should rewrite the references in a copy of each entry using the asset', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: { en: { content: { image: '/images/image.jpg' } } } };

      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/images/image.jpg');
      vi.mocked(getEntriesByAssetURL).mockResolvedValueOnce([entry]).mockResolvedValueOnce([]);
      // The collection folder’s public path is used over the global folder’s
      vi.mocked(getAssetFoldersByPath).mockReturnValue([
        { collectionName: undefined, publicPath: '/global' },
        { collectionName: 'posts', publicPath: '/images' },
      ]);

      const updatingEntryMap = new Map();

      await collectEntryChangesFromAsset({
        _globalAssetFolder: { publicPath: '/global' },
        newPath: 'assets/new/image.jpg',
        asset: mockAsset,
        updatingEntryMap,
      });

      const copy = updatingEntryMap.get('entry1');

      // A copy, so the original entry is left alone until the change is saved
      expect(copy).toEqual(entry);
      expect(copy).not.toBe(entry);
      expect(getEntriesByAssetURL).toHaveBeenLastCalledWith(
        'https://example.com/images/image.jpg',
        {
          entries: [copy],
          newURL: '/images/new/image.jpg',
        },
      );
    });

    it('should reuse the copy of an entry using several of the moved assets', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: {} };
      const updatingEntryMap = new Map();

      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/images/image.jpg');
      vi.mocked(getEntriesByAssetURL).mockResolvedValue([entry]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      await collectEntryChangesFromAsset({
        _globalAssetFolder: { publicPath: '/images' },
        newPath: 'assets/new/image.jpg',
        asset: mockAsset,
        updatingEntryMap,
      });

      const copy = updatingEntryMap.get('entry1');

      await collectEntryChangesFromAsset({
        _globalAssetFolder: { publicPath: '/images' },
        newPath: 'assets/new/other.jpg',
        asset: { ...mockAsset, path: 'assets/other.jpg' },
        updatingEntryMap,
      });

      expect(updatingEntryMap.size).toBe(1);
      expect(updatingEntryMap.get('entry1')).toBe(copy);
      expect(getEntriesByAssetURL).toHaveBeenLastCalledWith(expect.any(String), {
        entries: [copy],
        newURL: '/images/new/other.jpg',
      });
    });

    it('should fall back to the global folder without a public path', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: {} };

      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/image.jpg');
      vi.mocked(getEntriesByAssetURL).mockResolvedValue([entry]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      await collectEntryChangesFromAsset({
        _globalAssetFolder: { publicPath: undefined },
        newPath: 'new/image.jpg',
        asset: { ...mockAsset, folder: { internalPath: undefined } },
        updatingEntryMap: new Map(),
      });

      expect(getEntriesByAssetURL).toHaveBeenLastCalledWith('https://example.com/image.jpg', {
        entries: [expect.objectContaining({ id: 'entry1' })],
        newURL: 'new/image.jpg',
      });
    });
  });

  describe('updateStores', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should update stores after moving assets', async () => {
      const { focusedAsset, getAssetByInternalPath, overlaidAsset } =
        await import('$lib/services/assets');

      const { assetUpdatesToast } = await import('$lib/services/assets/data');
      const mockAsset1 = { path: 'old1.jpg' };
      const mockAsset2 = { path: 'old2.jpg' };
      const mockNewAsset1 = { path: 'new1.jpg' };
      const mockNewAsset2 = { path: 'new2.jpg' };

      const movedAssets = [
        { asset: mockAsset1, path: 'new1.jpg' },
        { asset: mockAsset2, path: 'new2.jpg' },
      ];

      focusedAsset.current = mockAsset1;
      overlaidAsset.current = mockAsset2;
      vi.mocked(getAssetByInternalPath).mockImplementation((path) =>
        path === 'new1.jpg' ? mockNewAsset1 : mockNewAsset2,
      );

      updateStores({ action: 'move', movedAssets });

      expect(getAssetByInternalPath).toHaveBeenCalledWith('new1.jpg');
      expect(getAssetByInternalPath).toHaveBeenCalledWith('new2.jpg');
      expect(focusedAsset.current).toEqual(mockNewAsset1);
      expect(overlaidAsset.current).toEqual(mockNewAsset2);
      expect(assetUpdatesToast.current).toEqual({
        saved: false,
        published: false,
        deleted: false,
        moved: true,
        renamed: false,
        count: 2,
      });
    });

    it('should update stores after renaming assets', async () => {
      const { assetUpdatesToast } = await import('$lib/services/assets/data');
      const movedAssets = [{ asset: { path: 'old.jpg' }, path: 'new.jpg' }];

      updateStores({ action: 'rename', movedAssets });

      expect(assetUpdatesToast.current).toEqual({
        saved: false,
        published: false,
        deleted: false,
        moved: false,
        renamed: true,
        count: 1,
      });
    });

    it('should handle focused asset not in movedAssets', async () => {
      const { focusedAsset, overlaidAsset } = await import('$lib/services/assets');
      const mockAsset = { path: 'different.jpg' };
      const mockMovedAsset = { path: 'moved.jpg' };
      const movedAssets = [{ asset: mockMovedAsset, path: 'new.jpg' }];

      focusedAsset.current = mockAsset;
      overlaidAsset.current = undefined;

      updateStores({ action: 'move', movedAssets });

      // focusedAsset should not be changed since it's not in movedAssets
      expect(focusedAsset.current).toBe(mockAsset);
    });

    it('should handle focused asset found in allAssets', async () => {
      const { focusedAsset, getAssetByInternalPath, overlaidAsset } =
        await import('$lib/services/assets');

      const mockMovedAsset = { path: 'old.jpg' };
      const mockNewAsset = { path: 'new.jpg' };
      const movedAssets = [{ asset: mockMovedAsset, path: 'new.jpg' }];

      focusedAsset.current = mockMovedAsset;
      overlaidAsset.current = undefined;
      vi.mocked(getAssetByInternalPath).mockReturnValue(mockNewAsset);

      updateStores({ action: 'move', movedAssets });

      expect(getAssetByInternalPath).toHaveBeenCalledWith('new.jpg');
      // focusedAsset should be set to the matching asset from allAssets
      expect(focusedAsset.current).toEqual(mockNewAsset);
    });

    it('should handle focused asset not found in allAssets', async () => {
      const { focusedAsset, getAssetByInternalPath, overlaidAsset } =
        await import('$lib/services/assets');

      const mockMovedAsset = { path: 'old.jpg' };
      const movedAssets = [{ asset: mockMovedAsset, path: 'new.jpg' }];

      focusedAsset.current = mockMovedAsset;
      overlaidAsset.current = undefined;
      vi.mocked(getAssetByInternalPath).mockReturnValue(undefined);

      updateStores({ action: 'move', movedAssets });

      // focusedAsset should be set to undefined
      expect(focusedAsset.current).toEqual(undefined);
    });

    it('should handle overlaid asset not found in allAssets', async () => {
      const { focusedAsset, getAssetByInternalPath, overlaidAsset } =
        await import('$lib/services/assets');

      const mockMovedAsset = { path: 'old.jpg' };
      const mockFocusedAsset = { path: 'focused.jpg' };
      const movedAssets = [{ asset: mockMovedAsset, path: 'new.jpg' }];

      focusedAsset.current = mockFocusedAsset;
      overlaidAsset.current = mockMovedAsset;
      vi.mocked(getAssetByInternalPath).mockReturnValue(undefined);

      updateStores({ action: 'rename', movedAssets });

      // overlaidAsset should be set to undefined
      expect(overlaidAsset.current).toEqual(undefined);
    });

    it('should handle overlaid asset found in allAssets', async () => {
      const { focusedAsset, getAssetByInternalPath, overlaidAsset } =
        await import('$lib/services/assets');

      const mockMovedAsset = { path: 'old.jpg' };
      const mockNewAsset = { path: 'new.jpg' };
      const movedAssets = [{ asset: mockMovedAsset, path: 'new.jpg' }];

      focusedAsset.current = undefined;
      overlaidAsset.current = mockMovedAsset;
      vi.mocked(getAssetByInternalPath).mockReturnValue(mockNewAsset);

      updateStores({ action: 'move', movedAssets });

      expect(getAssetByInternalPath).toHaveBeenCalledWith('new.jpg');
      // overlaidAsset should be set to the matching asset from allAssets
      expect(overlaidAsset.current).toEqual(mockNewAsset);
    });
  });

  describe('moveAssets', () => {
    beforeEach(() => {
      // The implementations the tests above gave the mocks must not leak into these
      vi.resetAllMocks();
    });

    it('should move assets and update entries', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetBlob } = await import('$lib/services/assets/info');
      const { saveChanges } = await import('$lib/services/backends/save');

      const mockAsset = {
        path: 'old/image.jpg',
        sha: 'abc123',
        file: undefined,
      };

      const movingAssets = [{ asset: mockAsset, path: 'new/image.jpg' }];

      cmsConfig.current = /** @type {any} */ ({ editor: { preview: true } });
      vi.mocked(getPathInfo).mockReturnValue({ basename: 'image.jpg' });
      vi.mocked(getAssetBlob).mockResolvedValue(new Blob(['content']));
      vi.mocked(saveChanges).mockResolvedValue({});

      // Test that the function completes without error
      await expect(moveAssets('move', movingAssets)).resolves.not.toThrow();

      expect(saveChanges).toHaveBeenCalled();
      expect(getAssetBlob).toHaveBeenCalledWith(mockAsset);
    });

    it('should commit the extra changes along, and keep quiet when asked', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { saveChanges } = await import('$lib/services/backends/save');
      const { assetUpdatesToast } = await import('$lib/services/assets/data');
      const mockFile = new File(['content'], 'image.jpg');
      const mockAsset = { path: 'old/image.jpg', sha: 'abc123', file: mockFile };
      const extraChange = { action: 'move', path: 'new/.gitkeep', previousPath: 'old/.gitkeep' };

      cmsConfig.current = /** @type {any} */ ({});
      assetUpdatesToast.current = undefined;
      vi.mocked(getPathInfo).mockReturnValue({ basename: 'image.jpg' });
      vi.mocked(saveChanges).mockResolvedValue({});

      await moveAssets('move', [{ asset: mockAsset, path: 'new/image.jpg' }], {
        extraChanges: [extraChange],
        notify: false,
      });

      const { changes } = vi.mocked(saveChanges).mock.calls[0][0];

      expect(changes).toHaveLength(2);
      expect(changes[1]).toBe(extraChange);
      expect(assetUpdatesToast.current).toBeUndefined();
    });

    it('should save an entry using several of the moved assets once', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { saveChanges } = await import('$lib/services/backends/save');
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssetURL } = await import('$lib/services/contents/collection/entries');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const { getAssociatedCollections } = await import('$lib/services/contents/entry');
      const { globalAssetFolder } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: {} };

      globalAssetFolder.current = { publicPath: '/images' };

      const assets = [
        { path: 'old/a.jpg', sha: 'a', file: new File(['a'], 'a.jpg'), folder: {} },
        { path: 'old/b.jpg', sha: 'b', file: new File(['b'], 'b.jpg'), folder: {} },
      ];

      cmsConfig.current = /** @type {any} */ ({});
      vi.mocked(getPathInfo).mockReturnValue({ basename: 'x.jpg' });
      vi.mocked(saveChanges).mockResolvedValue({});
      vi.mocked(getAssetPublicURL).mockImplementation((asset) => `/${asset.path}`);
      vi.mocked(getEntriesByAssetURL).mockResolvedValue([entry]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);
      vi.mocked(getAssociatedCollections).mockReturnValue([]);

      await moveAssets(
        'move',
        assets.map((asset) => ({ asset, path: asset.path.replace('old', 'new') })),
      );

      // Both references are replaced in one copy of the entry, which is then collected once
      expect(getAssociatedCollections).toHaveBeenCalledOnce();
      expect(getAssociatedCollections).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'entry1' }),
      );
    });

    it('should handle asset with existing file', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { saveChanges } = await import('$lib/services/backends/save');
      const mockFile = new File(['content'], 'image.jpg');

      const mockAsset = {
        path: 'old/image.jpg',
        sha: 'abc123',
        file: mockFile,
      };

      const movingAssets = [{ asset: mockAsset, path: 'new/image.jpg' }];

      cmsConfig.current = /** @type {any} */ ({});
      vi.mocked(getPathInfo).mockReturnValue({ basename: 'image.jpg' });
      vi.mocked(saveChanges).mockResolvedValue({});

      // Test that the function completes without error
      await expect(moveAssets('rename', movingAssets)).resolves.not.toThrow();

      expect(saveChanges).toHaveBeenCalled();
    });

    it('should read the asset bytes before the move so the change does not depend on the old file', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { getAssetBlob } = await import('$lib/services/assets/info');
      const { saveChanges } = await import('$lib/services/backends/save');
      // Simulate a blob backed by a file system handle: it can be read now, but any read after the
      // file has been moved away fails, as with OPFS in Chrome
      const blob = new Blob(['content'], { type: 'text/markdown' });
      let moved = false;

      vi.spyOn(blob, 'arrayBuffer').mockImplementation(async () => {
        if (moved) {
          throw new DOMException('File not found', 'NotFoundError');
        }

        return new TextEncoder().encode('content').buffer;
      });

      const mockAsset = { path: 'static/uploads/notes.md', sha: 'abc123', file: undefined };
      const movingAssets = [{ asset: mockAsset, path: 'static/uploads/renamed.md' }];

      cmsConfig.current = /** @type {any} */ ({});
      vi.mocked(getPathInfo).mockReturnValue({ basename: 'renamed.md' });
      vi.mocked(getAssetBlob).mockResolvedValue(blob);
      vi.mocked(saveChanges).mockImplementation(async () => {
        moved = true;

        return /** @type {any} */ ({});
      });

      await moveAssets('rename', movingAssets);

      const { changes, savingAssets } = vi.mocked(saveChanges).mock.calls[0][0];
      const { data } = changes[0];

      expect(blob.arrayBuffer).toHaveBeenCalledOnce();
      expect(data).toBeInstanceOf(File);
      expect(/** @type {File} */ (data).name).toBe('renamed.md');
      expect(/** @type {File} */ (data).type).toBe('text/markdown');
      // The copy can still be read after the original has been moved away
      await expect(/** @type {File} */ (data).text()).resolves.toBe('content');
      expect(savingAssets).toEqual([
        { ...mockAsset, path: 'static/uploads/renamed.md', name: 'renamed.md' },
      ]);
    });
  });
});
