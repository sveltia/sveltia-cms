// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

import {
  addSavingEntryData,
  collectEntryChanges,
  collectEntryChangesFromAssets,
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
  getAssetByInternalPath: vi.fn(),
}));

vi.mock('$lib/services/assets/state', () => ({
  allAssets: { current: undefined },
  focusedAsset: { current: undefined },
  overlaidAsset: { current: undefined },
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

vi.mock('$lib/services/assets/references', () => ({
  getEntriesByAssets: vi.fn(async (targets) => targets.map(() => [])),
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

vi.mock('$lib/services/contents/entry/collections', () => ({
  getAssociatedCollections: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/readonly', () => ({
  isEntryReadonly: vi.fn(() => false),
  getReadonlyEntryLabel: vi.fn((entry) => `Archive › ${entry.id}`),
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
      const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
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
      const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
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
      const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
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

  describe('collectEntryChangesFromAssets', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    const mockAsset = {
      path: 'assets/image.jpg',
      folder: { internalPath: 'assets' },
      blobURL: undefined,
    };

    it('should do nothing without assets', async () => {
      const { getEntriesByAssets } = await import('$lib/services/assets/references');
      const updatingEntryMap = new Map();

      await collectEntryChangesFromAssets({
        _globalAssetFolder: {},
        movingAssets: [],
        updatingEntryMap,
      });

      expect(getEntriesByAssets).not.toHaveBeenCalled();
      expect(updatingEntryMap.size).toBe(0);
    });

    it('should do nothing for assets no entry uses', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssets } = await import('$lib/services/assets/references');

      vi.mocked(getAssetPublicURL).mockReturnValue('https://example.com/assets/image.jpg');
      vi.mocked(getEntriesByAssets).mockResolvedValue([[]]);

      const updatingEntryMap = new Map();

      await collectEntryChangesFromAssets({
        _globalAssetFolder: {},
        movingAssets: [{ asset: mockAsset, path: 'new-assets/image.jpg' }],
        updatingEntryMap,
      });

      expect(getEntriesByAssets).toHaveBeenCalledOnce();
      expect(updatingEntryMap.size).toBe(0);
    });

    it('should match an asset without a public URL by the asset, even if it’s not loaded', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssets } = await import('$lib/services/assets/references');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: { en: { content: { image: 'image.jpg' } } } };

      // An entry-relative asset: no public URL, and no blob URL either, as it’s never been loaded
      vi.mocked(getAssetPublicURL).mockReturnValue(undefined);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);
      vi.mocked(getEntriesByAssets)
        .mockResolvedValueOnce([[entry]])
        .mockResolvedValueOnce([]);

      const updatingEntryMap = new Map();

      await collectEntryChangesFromAssets({
        _globalAssetFolder: { publicPath: '/images' },
        movingAssets: [{ asset: mockAsset, path: 'assets/new/image.jpg' }],
        updatingEntryMap,
      });

      expect(getEntriesByAssets).toHaveBeenNthCalledWith(1, [{ asset: mockAsset }]);
      expect(getEntriesByAssets).toHaveBeenLastCalledWith(
        [{ asset: mockAsset, newURL: '/images/new/image.jpg' }],
        { entries: [updatingEntryMap.get('entry1')] },
      );
    });

    it('should rewrite the references in a copy of each entry, falling back to the folder paths', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssets } = await import('$lib/services/assets/references');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: { en: { content: { image: '/images/image.jpg' } } } };

      // The moved asset has no public path, as in an entry-relative folder
      vi.mocked(getAssetPublicURL).mockImplementation((_a, options) =>
        options ? undefined : 'https://example.com/images/image.jpg',
      );
      vi.mocked(getEntriesByAssets)
        .mockResolvedValueOnce([[entry]])
        .mockResolvedValueOnce([]);
      // The collection folder’s public path is used over the global folder’s
      vi.mocked(getAssetFoldersByPath).mockReturnValue([
        { collectionName: undefined, publicPath: '/global' },
        { collectionName: 'posts', publicPath: '/images' },
      ]);

      const updatingEntryMap = new Map();

      await collectEntryChangesFromAssets({
        _globalAssetFolder: { publicPath: '/global' },
        movingAssets: [{ asset: mockAsset, path: 'assets/new/image.jpg' }],
        updatingEntryMap,
      });

      const copy = updatingEntryMap.get('entry1');

      // A copy, so the original entry is left alone until the change is saved
      expect(copy).toEqual(entry);
      expect(copy).not.toBe(entry);
      expect(getEntriesByAssets).toHaveBeenLastCalledWith(
        [{ url: 'https://example.com/images/image.jpg', newURL: '/images/new/image.jpg' }],
        { entries: [copy] },
      );
    });

    it('should derive the new URL from the moved asset the way the current URL is derived', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssets } = await import('$lib/services/assets/references');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: {} };

      // `media_folder: public` with `public_folder: /`
      const asset = {
        path: 'public/photo.jpg',
        name: 'photo.jpg',
        folder: { internalPath: 'public' },
      };

      vi.mocked(getAssetPublicURL).mockImplementation(
        (a, { pathOnly = false } = {}) =>
          `${pathOnly ? '' : 'https://example.com'}/${a.path.replace('public/', '')}`,
      );
      vi.mocked(getEntriesByAssets).mockResolvedValue([[entry]]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      await collectEntryChangesFromAssets({
        _globalAssetFolder: { internalPath: 'public', publicPath: '/' },
        movingAssets: [{ asset, path: 'public/2024/new.jpg' }],
        updatingEntryMap: new Map(),
      });

      expect(getAssetPublicURL).toHaveBeenLastCalledWith(
        { ...asset, path: 'public/2024/new.jpg', name: 'new.jpg' },
        { pathOnly: true, allowSpecial: true },
      );
      expect(getEntriesByAssets).toHaveBeenLastCalledWith(
        [{ url: 'https://example.com/photo.jpg', newURL: '/2024/new.jpg' }],
        { entries: [expect.objectContaining({ id: 'entry1' })] },
      );
    });

    it('should look every asset up at once and copy an entry using several of them once', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssets } = await import('$lib/services/assets/references');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: {} };
      const other = { id: 'entry2', locales: {} };
      const existingCopy = { id: 'entry2', locales: {} };
      const updatingEntryMap = new Map([['entry2', existingCopy]]);
      const otherAsset = { ...mockAsset, path: 'assets/other.jpg' };

      vi.mocked(getAssetPublicURL).mockImplementation((a, options) =>
        options ? undefined : `https://example.com/${a.path}`,
      );

      const unusedAsset = { ...mockAsset, path: 'assets/unused.jpg' };

      vi.mocked(getEntriesByAssets).mockResolvedValue([[entry], [entry, other], []]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      await collectEntryChangesFromAssets({
        _globalAssetFolder: { publicPath: '/images' },
        movingAssets: [
          { asset: mockAsset, path: 'assets/new/image.jpg' },
          { asset: otherAsset, path: 'assets/new/other.jpg' },
          { asset: unusedAsset, path: 'assets/new/unused.jpg' },
        ],
        updatingEntryMap,
      });

      expect(getEntriesByAssets).toHaveBeenCalledTimes(2);
      expect(getEntriesByAssets).toHaveBeenNthCalledWith(1, [
        { url: 'https://example.com/assets/image.jpg' },
        { url: 'https://example.com/assets/other.jpg' },
        { url: 'https://example.com/assets/unused.jpg' },
      ]);
      expect(updatingEntryMap.size).toBe(2);
      // A copy made earlier is reused
      expect(updatingEntryMap.get('entry2')).toBe(existingCopy);
      expect(getEntriesByAssets).toHaveBeenLastCalledWith(
        [
          { url: 'https://example.com/assets/image.jpg', newURL: '/images/new/image.jpg' },
          { url: 'https://example.com/assets/other.jpg', newURL: '/images/new/other.jpg' },
        ],
        { entries: [updatingEntryMap.get('entry1'), existingCopy] },
      );
    });

    it('should swap the file name in a reference relative to the entry when renaming', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssets } = await import('$lib/services/assets/references');
      const entry = { id: 'entry1', locales: {} };

      const asset = {
        path: 'content/posts/hello/my photo.png',
        name: 'my photo.png',
        folder: { internalPath: 'content/posts', entryRelative: true },
      };

      vi.mocked(getAssetPublicURL).mockReturnValue(undefined);
      vi.mocked(getEntriesByAssets).mockResolvedValue([[entry]]);

      await collectEntryChangesFromAssets({
        _globalAssetFolder: { publicPath: '/images' },
        movingAssets: [{ asset, path: 'content/posts/hello/new photo.png' }],
        updatingEntryMap: new Map(),
      });

      const [[{ newURL }]] = vi.mocked(getEntriesByAssets).mock.lastCall;

      // The rest of the reference is kept as the entry has it, and an encoded name stays encoded
      expect(newURL('my photo.png')).toBe('new photo.png');
      expect(newURL('./my photo.png')).toBe('./new photo.png');
      expect(newURL('images/my%20photo.png')).toBe('images/new%20photo.png');
      // A reference that doesn’t end with the name is left alone
      expect(newURL('other.png')).toBeUndefined();
      expect(newURL('not-my photo.png')).toBeUndefined();
    });

    it('should fall back to the folder paths when an entry-relative asset changes folders', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssets } = await import('$lib/services/assets/references');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: {} };

      const asset = {
        path: 'content/posts/hello/photo.png',
        name: 'photo.png',
        folder: { internalPath: 'content/posts', entryRelative: true },
      };

      vi.mocked(getAssetPublicURL).mockReturnValue(undefined);
      vi.mocked(getEntriesByAssets).mockResolvedValue([[entry]]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      await collectEntryChangesFromAssets({
        _globalAssetFolder: { publicPath: '/images' },
        movingAssets: [{ asset, path: 'content/posts/hello/sub/photo.png' }],
        updatingEntryMap: new Map(),
      });

      expect(getEntriesByAssets).toHaveBeenLastCalledWith(
        [{ asset, newURL: '/images/hello/sub/photo.png' }],
        { entries: [expect.objectContaining({ id: 'entry1' })] },
      );
    });

    it('should fall back to the global folder without a public path', async () => {
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssets } = await import('$lib/services/assets/references');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: {} };

      // The moved asset has no public path, as in an entry-relative folder
      vi.mocked(getAssetPublicURL).mockImplementation((_a, options) =>
        options ? undefined : 'https://example.com/image.jpg',
      );
      vi.mocked(getEntriesByAssets).mockResolvedValue([[entry]]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      await collectEntryChangesFromAssets({
        _globalAssetFolder: { publicPath: undefined },
        movingAssets: [
          { asset: { ...mockAsset, folder: { internalPath: undefined } }, path: 'new/image.jpg' },
        ],
        updatingEntryMap: new Map(),
      });

      expect(getEntriesByAssets).toHaveBeenLastCalledWith(
        [{ url: 'https://example.com/image.jpg', newURL: 'new/image.jpg' }],
        { entries: [expect.objectContaining({ id: 'entry1' })] },
      );
    });
  });

  describe('updateStores', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should update stores after moving assets', async () => {
      const { getAssetByInternalPath } = await import('$lib/services/assets');
      const { focusedAsset, overlaidAsset } = await import('$lib/services/assets/state');
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
      const { focusedAsset, overlaidAsset } = await import('$lib/services/assets/state');
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
      const { getAssetByInternalPath } = await import('$lib/services/assets');
      const { focusedAsset, overlaidAsset } = await import('$lib/services/assets/state');
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
      const { getAssetByInternalPath } = await import('$lib/services/assets');
      const { focusedAsset, overlaidAsset } = await import('$lib/services/assets/state');
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
      const { getAssetByInternalPath } = await import('$lib/services/assets');
      const { focusedAsset, overlaidAsset } = await import('$lib/services/assets/state');
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
      const { getAssetByInternalPath } = await import('$lib/services/assets');
      const { focusedAsset, overlaidAsset } = await import('$lib/services/assets/state');
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
      const { getEntriesByAssets } = await import('$lib/services/assets/references');
      const { getAssetFoldersByPath } = await import('$lib/services/assets/folders');
      const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
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
      vi.mocked(getEntriesByAssets).mockResolvedValue([[entry], [entry]]);
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

    it('should refuse to move an asset a read-only entry uses', async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');
      const { saveChanges } = await import('$lib/services/backends/save');
      const { getAssetPublicURL } = await import('$lib/services/assets/info');
      const { getEntriesByAssets } = await import('$lib/services/assets/references');
      const { isEntryReadonly } = await import('$lib/services/contents/entry/readonly');
      const { globalAssetFolder } = await import('$lib/services/assets/folders');
      const entry = { id: 'entry1', locales: {} };
      const asset = { path: 'old/a.jpg', sha: 'a', file: new File(['a'], 'a.jpg'), folder: {} };

      globalAssetFolder.current = { publicPath: '/images' };
      cmsConfig.current = /** @type {any} */ ({});
      vi.mocked(getPathInfo).mockReturnValue({ basename: 'a.jpg' });
      vi.mocked(getAssetPublicURL).mockImplementation((_asset) => `/${_asset.path}`);
      vi.mocked(getEntriesByAssets).mockResolvedValue([[entry]]);
      vi.mocked(isEntryReadonly).mockReturnValueOnce(true);

      await expect(moveAssets('rename', [{ asset, path: 'old/b.jpg' }])).rejects.toThrow(
        'cannot_move_referenced_asset',
      );
      expect(isEntryReadonly).toHaveBeenCalledWith(entry);
      expect(saveChanges).not.toHaveBeenCalled();
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
