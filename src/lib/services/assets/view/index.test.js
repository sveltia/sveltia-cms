/* eslint-disable jsdoc/require-jsdoc */
// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { filterAssets } from '$lib/services/assets/view/filter';
import { groupAssets } from '$lib/services/assets/view/group';
import { currentView, initSettings } from '$lib/services/assets/view/settings';
import { sortAssets } from '$lib/services/assets/view/sort';

import {
  assetGroups,
  getAdjacentAssets,
  getFolderLabelByCollection,
  listedAssetIndexMap,
  listedAssets,
  listedSubfolders,
  selectedFolderAssets,
  showAssetOverlay,
  showNewSubfolderDialog,
  showUploadAssetsConfirmDialog,
  showUploadAssetsDialog,
} from '.';

// Real reactive boxes are used for the mocked state, so that the derived state and effects in the
// module under test react to changes made by the tests
const {
  _publishedAssets,
  _selectedAssets,
  _uploadingAssets,
  _selectedAssetFolder,
  _browsedDirPath,
  _backend,
  _currentView,
  _prefs,
} = await vi.hoisted(async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return {
    /** @type {{ current: any }} */
    _publishedAssets: createRawState([]),
    /** @type {{ current: any[] }} */
    _selectedAssets: createRawState([]),
    /** @type {{ current: any }} */
    _uploadingAssets: createRawState({ folder: undefined, files: [] }),
    /** @type {{ current: any }} */
    _selectedAssetFolder: createRawState(undefined),
    /** @type {{ current: any }} */
    _browsedDirPath: createRawState(undefined),
    /** @type {{ current: any }} */
    _backend: createRawState(null),
    /** @type {{ current: any }} */
    _currentView: createRawState({ type: 'grid', showInfo: true }),
    _prefs: { devModeEnabled: false },
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
  publishedAssets: _publishedAssets,
  selectedAssets: _selectedAssets,
  uploadingAssets: _uploadingAssets,
}));

vi.mock('$lib/services/assets/folders', () => ({
  selectedAssetFolder: _selectedAssetFolder,
}));

vi.mock('$lib/services/assets/subfolders', () => ({
  browsedDirPath: _browsedDirPath,
  getDirName: (/** @type {string} */ path) =>
    path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '',
  getSubfolders: vi.fn((/** @type {{ dirPath: string, assets: any[] }} */ { dirPath, assets }) => {
    const prefix = dirPath ? `${dirPath}/` : '';

    /** @type {Set<string>} */
    const names = new Set(
      assets
        .map(({ path }) => (path.startsWith(prefix) ? path.slice(prefix.length) : ''))
        .filter((/** @type {string} */ rest) => rest.includes('/'))
        .map((/** @type {string} */ rest) => rest.split('/')[0]),
    );

    return [...names].sort().map((name) => ({ name, path: `${prefix}${name}` }));
  }),
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

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: _prefs,
}));

vi.mock('$lib/services/backends', () => ({
  backend: _backend,
}));

vi.mock('$lib/services/assets/view/settings', () => ({
  assetListSettings: { current: undefined },
  currentView: _currentView,
  initSettings: vi.fn(),
}));

/**
 * Wait for the effects to run.
 * @returns {Promise<void>} Promise that resolves after a short delay.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

/**
 * Create a mock asset.
 * @param {string} path Asset path.
 * @param {any} [folder] Asset folder.
 * @returns {any} Asset.
 */
const createAsset = (path, folder = undefined) => ({
  path,
  name: path.split('/').pop(),
  sha: `sha-${path}`,
  size: 1024,
  kind: 'image',
  folder,
});

describe('assets/view/index', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _backend.current = null;
    _prefs.devModeEnabled = false;
    _publishedAssets.current = [];
    _selectedAssets.current = [];
    _uploadingAssets.current = { folder: undefined, files: [] };
    _selectedAssetFolder.current = undefined;
    _browsedDirPath.current = undefined;
    currentView.current = { type: 'grid', showInfo: true };
    await wait();
  });
  describe('showAssetOverlay', () => {
    it('should be defined as reactive state', () => {
      expect(showAssetOverlay).toBeDefined();
      expect('current' in showAssetOverlay).toBe(true);
    });
  });

  describe('showNewSubfolderDialog', () => {
    it('should be hidden by default', () => {
      expect(showNewSubfolderDialog.current).toBe(false);
    });
  });

  describe('showUploadAssetsDialog', () => {
    it('should be defined as reactive state', () => {
      expect(showUploadAssetsDialog).toBeDefined();
      expect('current' in showUploadAssetsDialog).toBe(true);
    });
  });

  describe('showUploadAssetsConfirmDialog', () => {
    it('should be false when uploadingAssets.files is empty', () => {
      expect(showUploadAssetsConfirmDialog.current).toBe(false);
    });

    it('should be true when uploadingAssets.files has items', () => {
      _uploadingAssets.current = { folder: undefined, files: [new File(['a'], 'a.txt')] };

      expect(showUploadAssetsConfirmDialog.current).toBe(true);
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

    it('should return provided label without calling collection functions', async () => {
      const { getCollection, getCollectionLabel } =
        await import('$lib/services/contents/collection');

      vi.clearAllMocks();

      const folder = {
        label: 'Custom Folder Label',
        collectionName: 'blog',
        fileName: 'featured',
        internalPath: 'static/blog/featured',
        publicPath: '/static/blog/featured',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const result = getFolderLabelByCollection(folder);

      expect(result).toBe('Custom Folder Label');
      expect(getCollection).not.toHaveBeenCalled();
      expect(getCollectionLabel).not.toHaveBeenCalled();
    });
  });

  describe('listedAssets', () => {
    const globalFolder = {
      collectionName: undefined,
      internalPath: 'images',
      publicPath: '/images',
    };

    const blogFolder = { collectionName: 'blog', internalPath: 'blog', publicPath: '/blog' };

    beforeEach(() => {
      _publishedAssets.current = [
        createAsset('images/photo1.jpg', globalFolder),
        createAsset('blog/photo2.jpg', blogFolder),
      ];
    });

    it('should list all the assets when no folder is selected', () => {
      expect(listedAssets.current.map(({ path }) => path)).toEqual([
        'images/photo1.jpg',
        'blog/photo2.jpg',
      ]);
      // A copy is returned
      expect(listedAssets.current).not.toBe(_publishedAssets.current);
    });

    it('should list all the assets when the All Assets folder is selected', () => {
      _selectedAssetFolder.current = { collectionName: undefined, internalPath: undefined };

      expect(listedAssets.current).toHaveLength(2);
    });

    it('should be empty when there are no assets', () => {
      _publishedAssets.current = null;

      expect(listedAssets.current).toEqual([]);
    });

    it('should filter the assets by the selected folder', () => {
      _selectedAssetFolder.current = blogFolder;

      expect(listedAssets.current.map(({ path }) => path)).toEqual(['blog/photo2.jpg']);
    });

    it('should match the selected folder by value as well as by identity', () => {
      // A folder restored from the history state is an equal but separate object
      _selectedAssetFolder.current = { ...blogFolder };

      expect(listedAssets.current.map(({ path }) => path)).toEqual(['blog/photo2.jpg']);
    });

    it('should map each asset path to its position via listedAssetIndexMap', () => {
      const indexMap = listedAssetIndexMap.current;

      expect([...indexMap]).toEqual([
        ['images/photo1.jpg', 0],
        ['blog/photo2.jpg', 1],
      ]);
      expect(indexMap.get('missing')).toBeUndefined();
    });

    it('should reset the selected assets when the listed assets change', async () => {
      _selectedAssets.current = [createAsset('images/photo1.jpg', globalFolder)];
      _selectedAssetFolder.current = blogFolder;
      await wait();

      expect(_selectedAssets.current).toEqual([]);
    });

    it('should not log the assets to the console when dev mode is disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      _selectedAssetFolder.current = blogFolder;
      await wait();

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log the assets to the console when dev mode is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      _prefs.devModeEnabled = true;
      _selectedAssetFolder.current = blogFolder;
      await wait();

      expect(consoleSpy).toHaveBeenCalledWith('listedAssets', expect.any(Array));
      consoleSpy.mockRestore();
    });

    describe('with folder support', () => {
      beforeEach(() => {
        _publishedAssets.current = [
          createAsset('images/photo1.jpg', globalFolder),
          createAsset('images/2024/photo2.jpg', globalFolder),
          createAsset('images/2024/summer/photo3.jpg', globalFolder),
          createAsset('images/2023/photo4.jpg', globalFolder),
          createAsset('blog/photo5.jpg', blogFolder),
        ];
        _selectedAssetFolder.current = globalFolder;
      });

      it('should list every asset in the folder via selectedFolderAssets', () => {
        _browsedDirPath.current = 'images/2024';

        expect(selectedFolderAssets.current.map(({ path }) => path)).toEqual([
          'images/photo1.jpg',
          'images/2024/photo2.jpg',
          'images/2024/summer/photo3.jpg',
          'images/2023/photo4.jpg',
        ]);
      });

      it('should list only the assets in the browsed directory', () => {
        _browsedDirPath.current = 'images';
        expect(listedAssets.current.map(({ path }) => path)).toEqual(['images/photo1.jpg']);

        _browsedDirPath.current = 'images/2024';
        expect(listedAssets.current.map(({ path }) => path)).toEqual(['images/2024/photo2.jpg']);

        _browsedDirPath.current = 'images/2024/summer';
        expect(listedAssets.current.map(({ path }) => path)).toEqual([
          'images/2024/summer/photo3.jpg',
        ]);
      });

      it('should list the subfolders of the browsed directory', () => {
        _browsedDirPath.current = 'images';
        expect(listedSubfolders.current).toEqual([
          { name: '2023', path: 'images/2023' },
          { name: '2024', path: 'images/2024' },
        ]);

        _browsedDirPath.current = 'images/2024';
        expect(listedSubfolders.current).toEqual([{ name: 'summer', path: 'images/2024/summer' }]);

        _browsedDirPath.current = 'images/2023';
        expect(listedSubfolders.current).toEqual([]);
      });

      it('should list no subfolder when the folder is not browsed by subfolder', () => {
        expect(listedSubfolders.current).toEqual([]);
        expect(listedAssets.current).toHaveLength(4);
      });

      it('should offset the asset row indexes by the subfolder count', () => {
        _browsedDirPath.current = 'images';

        expect([...listedAssetIndexMap.current]).toEqual([['images/photo1.jpg', 2]]);
      });
    });
  });

  describe('assetGroups', () => {
    const asset = createAsset('images/photo1.jpg');

    beforeEach(() => {
      _publishedAssets.current = [asset];
      vi.mocked(sortAssets).mockImplementation((assets) => assets);
      vi.mocked(filterAssets).mockImplementation((assets) => assets);
      vi.mocked(groupAssets).mockImplementation((assets) => ({ '*': assets }));
    });

    it('should sort, filter, and group the listed assets', () => {
      currentView.current = {
        type: 'grid',
        showInfo: true,
        sort: { key: 'name', order: 'ascending' },
        filter: { field: 'kind', pattern: 'image' },
        group: { field: 'kind' },
      };

      expect(assetGroups.current).toEqual({ '*': [asset] });
      expect(sortAssets).toHaveBeenCalledWith([asset], { key: 'name', order: 'ascending' });
      expect(filterAssets).toHaveBeenCalledWith([asset], { field: 'kind', pattern: 'image' });
      expect(groupAssets).toHaveBeenCalledWith([asset], { field: 'kind' });
    });

    it('should only rerun the steps whose view conditions have changed', () => {
      vi.mocked(sortAssets).mockImplementation((assets) => [...assets]);
      vi.mocked(filterAssets).mockImplementation((assets) => [...assets]);

      /** @type {any} */
      const view = {
        type: 'grid',
        showInfo: true,
        sort: { key: 'name', order: 'ascending' },
        filter: { field: 'kind', pattern: 'image' },
        group: { field: 'kind' },
      };

      // Assets of its own, so the groups aren’t equal to what an earlier test left behind
      _publishedAssets.current = [createAsset('images/photo3.jpg')];
      currentView.current = view;
      void assetGroups.current;
      vi.clearAllMocks();

      // Switching to the list view leaves the conditions as they were, even though the view is a
      // new object with copies of them
      currentView.current = { ...structuredClone(view), type: 'list' };
      void assetGroups.current;

      expect(sortAssets).not.toHaveBeenCalled();
      expect(filterAssets).not.toHaveBeenCalled();
      expect(groupAssets).not.toHaveBeenCalled();

      // A new filter doesn’t sort the assets again
      currentView.current = { ...view, filter: { field: 'kind', pattern: 'video' } };
      void assetGroups.current;

      expect(sortAssets).not.toHaveBeenCalled();
      expect(filterAssets).toHaveBeenCalledTimes(1);
      expect(groupAssets).toHaveBeenCalledTimes(1);
    });

    it('should keep the same groups when the computed groups are equal', () => {
      const groups = assetGroups.current;

      // Change the view without affecting the result
      currentView.current = { type: 'list', showInfo: true };

      expect(assetGroups.current).toBe(groups);
    });

    it('should return new groups when the computed groups differ', () => {
      const groups = assetGroups.current;

      _publishedAssets.current = [asset, createAsset('images/photo2.jpg')];

      expect(assetGroups.current).not.toBe(groups);
      expect(assetGroups.current).toEqual({ '*': _publishedAssets.current });
    });
  });

  describe('getAdjacentAssets', () => {
    const assets = [
      createAsset('images/a.jpg'),
      createAsset('images/b.jpg'),
      createAsset('images/c.jpg'),
    ];

    it('should return the neighbours of an asset in the middle', () => {
      expect(getAdjacentAssets(assets, ({ path }) => path === 'images/b.jpg')).toEqual({
        previous: assets[0],
        next: assets[2],
      });
    });

    it('should omit the previous asset for the first one', () => {
      expect(getAdjacentAssets(assets, ({ path }) => path === 'images/a.jpg')).toEqual({
        previous: undefined,
        next: assets[1],
      });
    });

    it('should omit the next asset for the last one', () => {
      expect(getAdjacentAssets(assets, ({ path }) => path === 'images/c.jpg')).toEqual({
        previous: assets[1],
        next: undefined,
      });
    });

    it('should return nothing when the asset is not listed', () => {
      expect(getAdjacentAssets(assets, ({ path }) => path === 'images/d.jpg')).toEqual({});
      expect(getAdjacentAssets([], () => true)).toEqual({});
    });
  });

  describe('backend effect', () => {
    it('should initialize the settings once a backend is selected', async () => {
      _backend.current = { repository: { databaseName: 'test-db' } };
      await wait();

      expect(initSettings).toHaveBeenCalledWith({ repository: { databaseName: 'test-db' } });
    });

    it('should not initialize the settings without a backend', async () => {
      expect(initSettings).not.toHaveBeenCalled();
    });
  });
});
