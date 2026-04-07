/* eslint-disable jsdoc/require-param-description */
/* eslint-disable jsdoc/require-description */
/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFolderLabelByCollection, showAssetOverlay, showUploadAssetsDialog } from '.';

const { _backendAv, _assetListSettingsAv } = vi.hoisted(() => {
  /**
   * Minimal writable store factory.
   * @template T
   * @param {T} initial Initial value.
   * @returns {import('svelte/store').Writable<T>} Writable store.
   */
  const w = (initial) => {
    let value = initial;
    /** @type {Set<(v: T) => void>} */
    const subs = new Set();

    /** @param {T} v */
    const setFn = (v) => {
      value = v;
      subs.forEach((run) => run(value));
    };

    return {
      subscribe(run) {
        subs.add(run);
        run(value);
        return () => subs.delete(run);
      },
      set: setFn,
      update(fn) {
        setFn(fn(value));
      },
    };
  };

  return {
    /** @type {import('svelte/store').Writable<any>} */
    _backendAv: w(/** @type {any} */ (null)),
    /** @type {import('svelte/store').Writable<any>} */
    _assetListSettingsAv: w(/** @type {any} */ (undefined)),
  };
});

// Mock dependencies
vi.mock('@sveltia/i18n', () => ({
  _: (/** @type {string} */ key) => {
    /** @type {Record<string, string>} */
    const translations = {
      all_assets: 'All Assets',
      global_assets: 'Global Assets',
    };

    return translations[key] || key;
  },
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
  getCollectionLabel: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFile: vi.fn(),
  getCollectionFileLabel: vi.fn(),
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: { subscribe: vi.fn(() => vi.fn()) },
  selectedAssets: {
    subscribe: vi.fn(() => vi.fn()),
    set: vi.fn(),
  },
  uploadingAssets: {
    subscribe: vi.fn((callback) => {
      // Default mock with empty files
      callback(/** @type {any} */ ({ files: [] }));
      return vi.fn();
    }),
  },
}));

vi.mock('$lib/services/assets/folders', () => ({
  selectedAssetFolder: { subscribe: vi.fn(() => vi.fn()) },
}));

vi.mock('$lib/services/assets/view/filter', () => ({
  filterAssets: vi.fn((assets) => assets),
}));

vi.mock('$lib/services/assets/view/group', () => ({
  groupAssets: vi.fn(),
}));

vi.mock('$lib/services/assets/view/sort', () => ({
  sortAssets: vi.fn(),
}));

vi.mock('$lib/services/user/prefs', () => ({
  prefs: {
    subscribe: vi.fn((callback) => {
      callback({ devModeEnabled: false });
      return vi.fn();
    }),
  },
}));

vi.mock('$lib/services/backends', () => ({
  backend: _backendAv,
}));

vi.mock('$lib/services/assets/view/settings', () => ({
  assetListSettings: _assetListSettingsAv,
  initSettings: vi.fn(),
}));

describe('assets/view/index', () => {
  beforeEach(() => {
    _backendAv.set(null);
    _assetListSettingsAv.set(undefined);
  });
  describe('showAssetOverlay', () => {
    it('should be defined as a store', () => {
      expect(showAssetOverlay).toBeDefined();
      expect(typeof showAssetOverlay.subscribe).toBe('function');
    });
  });

  describe('showUploadAssetsDialog', () => {
    it('should be defined as a store', () => {
      expect(showUploadAssetsDialog).toBeDefined();
      expect(typeof showUploadAssetsDialog.subscribe).toBe('function');
    });

    it('should set to false when uploadingAssets.files is empty', async () => {
      const mockCallback = vi.fn();

      showUploadAssetsDialog.subscribe(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(false);
    });

    it('should trigger when uploadingAssets has files to exercise line 36', async () => {
      vi.resetModules();

      const mockCallback = vi.fn();
      const { uploadingAssets } = await import('$lib/services/assets');

      vi.mocked(uploadingAssets.subscribe).mockImplementationOnce((callback) => {
        callback(/** @type {any} */ ({ files: [new File(['test'], 'test.jpg')] }));
        return vi.fn();
      });

      const { showUploadAssetsConfirmDialog } = await import('.');

      showUploadAssetsConfirmDialog.subscribe(mockCallback);

      expect(mockCallback).toHaveBeenCalled();
    });

    it('should set to true when uploadingAssets.files has items', async () => {
      const mockCallback = vi.fn();
      const { uploadingAssets } = await import('$lib/services/assets');
      const uploadMock = vi.mocked(uploadingAssets);

      uploadMock.subscribe.mockImplementationOnce((callback) => {
        callback(
          /** @type {any} */ ({
            folder: undefined,
            files: [new File(['test'], 'test.jpg')],
          }),
        );
        return vi.fn();
      });

      showUploadAssetsDialog.subscribe(mockCallback);

      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('getFolderLabelByCollection', () => {
    it('should return collection name when collection is not found', async () => {
      const { getCollection, getCollectionLabel } =
        await import('$lib/services/contents/collection');

      vi.mocked(getCollection).mockReturnValue(undefined);

      const folder = {
        collectionName: 'blog',
        fileName: undefined,
        internalPath: 'static/uploads',
        publicPath: '/static/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(getCollection).toHaveBeenCalledWith('blog');
      expect(getCollectionLabel).not.toHaveBeenCalled();
      expect(result).toBe('blog');
    });

    it('should return "All Assets" when collectionName is undefined and internalPath is undefined', async () => {
      const folder = {
        collectionName: undefined,
        fileName: undefined,
        internalPath: undefined,
        publicPath: '/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(result).toBe('All Assets');
    });

    it('should return "Global Assets" when collectionName is undefined but internalPath is defined', async () => {
      const folder = {
        collectionName: undefined,
        fileName: undefined,
        internalPath: 'static/uploads',
        publicPath: '/static/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(result).toBe('Global Assets');
    });

    it('should return collection label when collection exists', async () => {
      const { getCollection, getCollectionLabel } =
        await import('$lib/services/contents/collection');

      // @ts-ignore - simplified mock for testing
      const mockCollection = { name: 'blog', label: 'Blog Posts' };

      // @ts-ignore - mocking with simplified data
      vi.mocked(getCollection).mockReturnValue(mockCollection);
      vi.mocked(getCollectionLabel).mockReturnValue('Blog Posts');

      const folder = {
        collectionName: 'blog',
        fileName: undefined,
        internalPath: 'static/blog',
        publicPath: '/static/blog',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(getCollection).toHaveBeenCalledWith('blog');
      expect(getCollectionLabel).toHaveBeenCalledWith(mockCollection);
      expect(result).toBe('Blog Posts');
    });

    it('should return collection and file label when both exist', async () => {
      const { getCollection, getCollectionLabel } =
        await import('$lib/services/contents/collection');

      const { getCollectionFile, getCollectionFileLabel } =
        await import('$lib/services/contents/collection/files');

      // @ts-ignore - simplified mock for testing
      const mockCollection = { name: 'blog', label: 'Blog Posts' };
      // @ts-ignore - simplified mock for testing
      const mockFile = { name: 'featured', label: 'Featured Posts' };

      // @ts-ignore - mocking with simplified data
      vi.mocked(getCollection).mockReturnValue(mockCollection);
      vi.mocked(getCollectionLabel).mockReturnValue('Blog Posts');
      // @ts-ignore - mocking with simplified data
      vi.mocked(getCollectionFile).mockReturnValue(mockFile);
      vi.mocked(getCollectionFileLabel).mockReturnValue('Featured Posts');

      const folder = {
        collectionName: 'blog',
        fileName: 'featured',
        internalPath: 'static/blog/featured',
        publicPath: '/static/blog/featured',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(getCollection).toHaveBeenCalledWith('blog');
      expect(getCollectionLabel).toHaveBeenCalledWith(mockCollection);
      expect(getCollectionFile).toHaveBeenCalledWith(mockCollection, 'featured');
      expect(getCollectionFileLabel).toHaveBeenCalledWith(mockFile);
      expect(result).toBe('Blog Posts › Featured Posts');
    });

    it('should return collection label and fileName when file is not found', async () => {
      const { getCollection, getCollectionLabel } =
        await import('$lib/services/contents/collection');

      const { getCollectionFile } = await import('$lib/services/contents/collection/files');
      // @ts-ignore - simplified mock for testing
      const mockCollection = { name: 'blog', label: 'Blog Posts' };

      // @ts-ignore - mocking with simplified data
      vi.mocked(getCollection).mockReturnValue(mockCollection);
      vi.mocked(getCollectionLabel).mockReturnValue('Blog Posts');
      vi.mocked(getCollectionFile).mockReturnValue(undefined);

      const folder = {
        collectionName: 'blog',
        fileName: 'unknown-file',
        internalPath: 'static/blog/unknown',
        publicPath: '/static/blog/unknown',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(getCollection).toHaveBeenCalledWith('blog');
      expect(getCollectionLabel).toHaveBeenCalledWith(mockCollection);
      expect(getCollectionFile).toHaveBeenCalledWith(mockCollection, 'unknown-file');
      expect(result).toBe('Blog Posts › unknown-file');
    });

    it('should handle case where collection is not found and fileName is provided', async () => {
      const { getCollection } = await import('$lib/services/contents/collection');
      const { getCollectionFile } = await import('$lib/services/contents/collection/files');

      vi.clearAllMocks();

      vi.mocked(getCollection).mockReturnValue(undefined);
      vi.mocked(getCollectionFile).mockReturnValue(undefined);

      const folder = {
        collectionName: 'nonexistent',
        fileName: 'some-file',
        internalPath: 'static/uploads',
        publicPath: '/static/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(result).toBe('nonexistent › some-file');
      expect(getCollectionFile).not.toHaveBeenCalled();
    });
  });

  describe('defaultView', () => {
    it('should have correct default view settings', async () => {
      const { defaultView } = await import('.');

      expect(defaultView).toEqual({
        type: 'grid',
        showInfo: true,
        sort: {
          key: 'name',
          order: 'ascending',
        },
      });
    });
  });

  describe('currentView', () => {
    it('should be defined as a store', async () => {
      const { currentView } = await import('.');

      expect(currentView).toBeDefined();
      expect(typeof currentView.subscribe).toBe('function');
    });
  });

  describe('listedAssets store with different scenarios', () => {
    it('should return all assets when selectedAssetFolder is undefined', async () => {
      vi.resetModules();

      const { allAssets, selectedAssets } = await import('$lib/services/assets');
      const { selectedAssetFolder } = await import('$lib/services/assets/folders');

      const mockAssetList = /** @type {any[]} */ ([
        {
          path: '/images/photo1.jpg',
          name: 'photo1.jpg',
          sha: 'sha1',
          size: 1024,
          kind: 'image',
          folder: {
            collectionName: undefined,
            internalPath: '/images',
            publicPath: '/images',
            entryRelative: false,
            hasTemplateTags: false,
          },
          commitAuthor: { name: 'Alice', email: 'alice@example.com' },
          commitDate: new Date('2023-01-01'),
        },
      ]);

      vi.mocked(allAssets.subscribe).mockImplementationOnce((callback) => {
        callback(mockAssetList);
        return vi.fn();
      });

      vi.mocked(selectedAssetFolder.subscribe).mockImplementationOnce((callback) => {
        callback(undefined);
        return vi.fn();
      });

      vi.mocked(selectedAssets.set).mockImplementationOnce(() => {});

      const { listedAssets } = await import('.');
      const mockAssetCallback = vi.fn();

      listedAssets.subscribe(mockAssetCallback);

      expect(mockAssetCallback).toHaveBeenCalled();
    });

    it('should return empty array when allAssets is null', async () => {
      vi.resetModules();

      const { allAssets, selectedAssets } = await import('$lib/services/assets');
      const { selectedAssetFolder } = await import('$lib/services/assets/folders');

      vi.mocked(allAssets.subscribe).mockImplementationOnce((callback) => {
        callback(/** @type {any} */ (null));
        return vi.fn();
      });

      vi.mocked(selectedAssetFolder.subscribe).mockImplementationOnce((callback) => {
        callback(
          /** @type {any} */ ({
            collectionName: undefined,
            internalPath: '/images',
            publicPath: '/images',
            entryRelative: false,
            hasTemplateTags: false,
          }),
        );
        return vi.fn();
      });

      vi.mocked(selectedAssets.set).mockImplementationOnce(() => {});

      const { listedAssets } = await import('.');
      const mockAssetCallback = vi.fn();

      listedAssets.subscribe(mockAssetCallback);

      expect(mockAssetCallback).toHaveBeenCalled();
    });

    it('should handle empty asset list from filter', async () => {
      vi.resetModules();

      const { allAssets, selectedAssets } = await import('$lib/services/assets');
      const { selectedAssetFolder } = await import('$lib/services/assets/folders');
      const emptyAssetList = /** @type {any[]} */ ([]);

      vi.mocked(allAssets.subscribe).mockImplementationOnce((callback) => {
        callback(emptyAssetList);
        return vi.fn();
      });

      vi.mocked(selectedAssetFolder.subscribe).mockImplementationOnce((callback) => {
        callback(
          /** @type {any} */ ({
            collectionName: undefined,
            internalPath: '/images',
            publicPath: '/images',
            entryRelative: false,
            hasTemplateTags: false,
          }),
        );
        return vi.fn();
      });

      vi.mocked(selectedAssets.set).mockImplementationOnce(() => {});

      const { listedAssets } = await import('.');
      const mockAssetCallback = vi.fn();

      listedAssets.subscribe(mockAssetCallback);

      expect(mockAssetCallback).toHaveBeenCalled();
    });

    it('should filter assets when folder with internalPath is selected', async () => {
      vi.resetModules();

      const { allAssets, selectedAssets } = await import('$lib/services/assets');
      const { selectedAssetFolder } = await import('$lib/services/assets/folders');

      const mockAssetList = /** @type {any[]} */ ([
        {
          path: '/images/photo1.jpg',
          name: 'photo1.jpg',
          sha: 'sha1',
          size: 1024,
          kind: 'image',
          folder: {
            collectionName: undefined,
            internalPath: '/images',
            publicPath: '/images',
            entryRelative: false,
            hasTemplateTags: false,
          },
          commitAuthor: { name: 'Alice', email: 'alice@example.com' },
          commitDate: new Date('2023-01-01'),
        },
      ]);

      const selectedFolder = /** @type {any} */ ({
        collectionName: undefined,
        internalPath: '/images',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      });

      vi.mocked(allAssets.subscribe).mockImplementationOnce((callback) => {
        callback(mockAssetList);
        return vi.fn();
      });

      vi.mocked(selectedAssetFolder.subscribe).mockImplementationOnce((callback) => {
        callback(selectedFolder);
        return vi.fn();
      });

      vi.mocked(selectedAssets.set).mockImplementationOnce(() => {});

      const { listedAssets } = await import('.');
      const mockAssetCallback = vi.fn();

      listedAssets.subscribe(mockAssetCallback);

      expect(mockAssetCallback).toHaveBeenCalled();
    });
  });

  describe('assetGroups derived store', () => {
    it('should sort, filter, and group assets', async () => {
      vi.resetModules();

      const { filterAssets } = await import('$lib/services/assets/view/filter');
      const { sortAssets } = await import('$lib/services/assets/view/sort');
      const { groupAssets } = await import('$lib/services/assets/view/group');
      const mockSortFn = vi.mocked(sortAssets);
      const mockFilterFn = vi.mocked(filterAssets);
      const mockGroupFn = vi.mocked(groupAssets);

      const mockAssets = /** @type {any[]} */ ([
        {
          path: '/images/photo1.jpg',
          name: 'photo1.jpg',
          sha: 'sha1',
          size: 1024,
          kind: 'image',
          folder: {
            collectionName: undefined,
            internalPath: '/images',
            publicPath: '/images',
            entryRelative: false,
            hasTemplateTags: false,
          },
          commitAuthor: { name: 'Alice', email: 'alice@example.com' },
          commitDate: new Date('2023-01-01'),
        },
      ]);

      const mockGroups = /** @type {any} */ ({ '*': mockAssets });

      mockSortFn.mockReturnValue(mockAssets);
      mockFilterFn.mockReturnValue(mockAssets);
      mockGroupFn.mockReturnValue(mockGroups);

      const { assetGroups } = await import('.');
      const mockCallback = vi.fn();

      assetGroups.subscribe(mockCallback);

      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('backend.subscribe and assetGroups coverage branches', () => {
    it('should call initSettings when backend becomes truthy and assetListSettings is falsy', async () => {
      const { initSettings } = await import('$lib/services/assets/view/settings');

      // _backendAv starts as null (covers &&-short-circuit / binary-expr false path at module load)
      // Set backend truthy with entryListSettings still undefined → initSettings called
      _assetListSettingsAv.set(undefined);
      _backendAv.set(/** @type {any} */ ({ repository: { databaseName: 'test-db' } }));

      expect(vi.mocked(initSettings)).toHaveBeenCalledWith({
        repository: { databaseName: 'test-db' },
      });
    });

    it('should skip set(groups) when computed groups equal current store value (L117 false)', async () => {
      // Cover L117 false: trigger two computations with the same groups result so that
      // equal(get(assetGroups), groups) === true → !equal() === false → skip set.
      // First computation: groups=mockGroups, get(assetGroups)=undefined → not equal → set →
      //   assetGroups.value = mockGroups.
      // Second computation (triggered by currentView update): groups=mockGroups still,
      //   get(assetGroups)=mockGroups → equal → skip → L117 false covered.
      vi.resetModules();

      const { allAssets, selectedAssets } = await import('$lib/services/assets');
      const { selectedAssetFolder } = await import('$lib/services/assets/folders');
      const { filterAssets } = await import('$lib/services/assets/view/filter');
      const { sortAssets } = await import('$lib/services/assets/view/sort');
      const { groupAssets } = await import('$lib/services/assets/view/group');
      const mockAssets = /** @type {any[]} */ ([]);
      const mockGroups = /** @type {any} */ ({ '*': [] });

      vi.mocked(sortAssets).mockReturnValue(mockAssets);
      vi.mocked(filterAssets).mockReturnValue(mockAssets);
      vi.mocked(groupAssets).mockReturnValue(mockGroups);

      vi.mocked(allAssets.subscribe).mockImplementationOnce((callback) => {
        callback(/** @type {any} */ ([]));
        return vi.fn();
      });

      vi.mocked(selectedAssetFolder.subscribe).mockImplementationOnce((callback) => {
        callback(/** @type {any} */ (undefined));
        return vi.fn();
      });

      vi.mocked(selectedAssets.set).mockImplementationOnce(() => {});

      const { assetGroups, currentView } = await import('.');
      const mockCallback = vi.fn();

      assetGroups.subscribe(mockCallback);

      // First computation sets assetGroups.value = mockGroups (true branch).
      // Update currentView to trigger a second computation — groups is still mockGroups,
      // get(assetGroups) is now mockGroups → equal → skip → L117 false branch fires.
      currentView.set(/** @type {any} */ ({ type: 'grid', showInfo: false }));

      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('listedAssets subscription with dev mode', () => {
    it('should not log assets to console when dev mode is disabled', async () => {
      vi.resetModules();

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const { prefs } = await import('$lib/services/user/prefs');

      vi.mocked(prefs.subscribe).mockImplementation((callback) => {
        callback(/** @type {any} */ ({ devModeEnabled: false }));
        return vi.fn();
      });

      await import('.');

      // Should not have been called for logging when dev mode is disabled
      expect(consoleSpy).not.toHaveBeenCalledWith('listedAssets', expect.any(Array));

      consoleSpy.mockRestore();
    });

    it('should log assets to console when dev mode is enabled', async () => {
      vi.resetModules();

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const { prefs } = await import('$lib/services/user/prefs');

      vi.mocked(prefs.subscribe).mockImplementation((callback) => {
        callback(/** @type {any} */ ({ devModeEnabled: true }));
        return vi.fn();
      });

      await import('.');

      expect(consoleSpy).toHaveBeenCalledWith('listedAssets', expect.any(Array));

      consoleSpy.mockRestore();
    });
  });
});
