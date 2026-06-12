import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAssetLibraryFolderMap,
  getTargetFolderPath,
  hasSameAsset,
  isAssetInSelectedFolder,
  listAssets,
} from './helper';

// Mock dependencies
vi.mock('@sveltia/utils/crypto');
vi.mock('@sveltia/utils/file');
vi.mock('fast-deep-equal');
vi.mock('$lib/services/assets', async () => {
  const { writable } = await import('svelte/store');

  return { allAssets: writable(/** @type {import('$lib/types/private').Asset[]} */ ([])) };
});
vi.mock('$lib/services/assets/folders', async () => {
  const { writable, derived } = await import('svelte/store');

  return {
    allAssetFolders: writable(/** @type {import('$lib/types/private').AssetFolderInfo[]} */ ([])),
    globalAssetFolder: derived([writable([])], ([_allAssetFolders], set) => {
      set(undefined);
    }),
    getAssetFolder: vi.fn(),
  };
});

const { getAssetFolder } = await import('$lib/services/assets/folders');
const { allAssetFolders } = await import('$lib/services/assets/folders');
const { getHash } = await import('@sveltia/utils/crypto');
const { getPathInfo } = await import('@sveltia/utils/file');
const { default: equal } = await import('fast-deep-equal');
const { allAssets } = await import('$lib/services/assets');

describe('contents/fields/file/helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allAssetFolders.set([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAssetLibraryFolderMap', () => {
    describe('with minimal parameters', () => {
      it('should return folder map with only collection name', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result).toHaveProperty('field');
        expect(result).toHaveProperty('entry');
        expect(result).toHaveProperty('file');
        expect(result).toHaveProperty('collection');
        expect(result).toHaveProperty('global');
      });
    });

    describe('field folder', () => {
      it('should enable field folder when getAssetFolder returns a folder', () => {
        const mockFieldFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/images/banner',
          publicPath: '/images/banner',
          entryRelative: true,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockImplementation((args) => {
          if ('typedKeyPath' in args && 'isIndexFile' in args) {
            return mockFieldFolder;
          }

          return undefined;
        });

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
          fileName: 'post-1.md',
          typedKeyPath: 'fields.banner',
          isIndexFile: false,
        });

        expect(result.field.enabled).toBe(true);
        expect(result.field.folder).toEqual(mockFieldFolder);
      });

      it('should disable field folder when getAssetFolder returns undefined', () => {
        vi.mocked(getAssetFolder).mockReturnValue(undefined);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
          typedKeyPath: 'fields.banner',
        });

        expect(result.field.enabled).toBe(false);
        expect(result.field.folder).toBeUndefined();
      });
    });

    describe('file folder', () => {
      it('should enable file folder when fileName is provided and folder exists', () => {
        const mockFileFolder = {
          collectionName: 'posts',
          fileName: 'post-1.md',
          internalPath: 'content/posts/post-1/media',
          publicPath: '/post-1/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockImplementation((args) => {
          if (args.fileName && !('typedKeyPath' in args)) {
            return mockFileFolder;
          }

          return undefined;
        });

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
          fileName: 'post-1.md',
        });

        expect(result.file.enabled).toBe(true);
        expect(result.file.folder).toEqual(mockFileFolder);
      });

      it('should disable file folder when entry-relative', () => {
        const mockFileFolder = {
          collectionName: 'posts',
          fileName: 'post-1.md',
          internalPath: 'content/posts/post-1/media',
          publicPath: '/post-1/media',
          entryRelative: true,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockImplementation((args) => {
          if (args.fileName && !('typedKeyPath' in args)) {
            return mockFileFolder;
          }

          return undefined;
        });

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
          fileName: 'post-1.md',
        });

        expect(result.file.enabled).toBe(false);
        expect(result.file.folder).toEqual(mockFileFolder);
      });

      it('should disable file folder when has template tags', () => {
        const mockFileFolder = {
          collectionName: 'posts',
          fileName: 'post-1.md',
          internalPath: 'content/posts/{{slug}}/media',
          publicPath: '/{{slug}}/media',
          entryRelative: false,
          hasTemplateTags: true,
        };

        vi.mocked(getAssetFolder).mockImplementation((args) => {
          if (args.fileName && !('typedKeyPath' in args)) {
            return mockFileFolder;
          }

          return undefined;
        });

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
          fileName: 'post-1.md',
        });

        expect(result.file.enabled).toBe(false);
        expect(result.file.folder).toEqual(mockFileFolder);
      });

      it('should disable file folder when fileName is not provided', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result.file.enabled).toBe(false);
        expect(result.file.folder).toBeUndefined();
      });
    });

    describe('entry folder', () => {
      it('should enable entry folder when fileAssetFolder exists and is entry-relative', () => {
        const mockFileFolder = {
          collectionName: 'posts',
          fileName: 'post-1.md',
          internalPath: './media',
          publicPath: '/media',
          entryRelative: true,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockImplementation((args) => {
          if (args.fileName && !('typedKeyPath' in args)) {
            return mockFileFolder;
          }

          return undefined;
        });

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
          fileName: 'post-1.md',
        });

        expect(result.entry.enabled).toBe(true);
        expect(result.entry.folder).toEqual(mockFileFolder);
      });

      it('should enable entry folder when fileAssetFolder exists and has template tags', () => {
        const mockFileFolder = {
          collectionName: 'posts',
          fileName: 'post-1.md',
          internalPath: 'content/posts/{{slug}}/media',
          publicPath: '/{{slug}}/media',
          entryRelative: false,
          hasTemplateTags: true,
        };

        vi.mocked(getAssetFolder).mockImplementation((args) => {
          if (args.fileName && !('typedKeyPath' in args)) {
            return mockFileFolder;
          }

          return undefined;
        });

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
          fileName: 'post-1.md',
        });

        expect(result.entry.enabled).toBe(true);
        expect(result.entry.folder).toEqual(mockFileFolder);
      });

      it('should use collectionAssetFolder as entry folder when fileAssetFolder is undefined', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result.entry.folder).toEqual(mockCollectionFolder);
      });

      it('should disable entry folder when entry folder exists but is not entry-relative and has no template tags', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result.entry.enabled).toBe(false);
      });

      it('should disable entry folder when entry folder is undefined', () => {
        vi.mocked(getAssetFolder).mockReturnValue(undefined);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result.entry.enabled).toBe(false);
        expect(result.entry.folder).toBeUndefined();
      });
    });

    describe('collection folder', () => {
      it('should enable collection folder when it exists and is not entry-relative and has no template tags', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result.collection.enabled).toBe(true);
        expect(result.collection.folder).toEqual(mockCollectionFolder);
      });

      it('should disable collection folder when it is entry-relative', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: './media',
          publicPath: '/media',
          entryRelative: true,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result.collection.enabled).toBe(false);
      });

      it('should disable collection folder when it has template tags', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/{{slug}}/media',
          publicPath: '/{{slug}}/media',
          entryRelative: false,
          hasTemplateTags: true,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result.collection.enabled).toBe(false);
      });

      it('should disable collection folder when it is undefined', () => {
        vi.mocked(getAssetFolder).mockReturnValue(undefined);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result.collection.enabled).toBe(false);
        expect(result.collection.folder).toBeUndefined();
      });
    });

    describe('global folder', () => {
      it('should disable global folder when it is undefined', () => {
        vi.mocked(getAssetFolder).mockReturnValue(undefined);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result.global.enabled).toBe(false);
        expect(result.global.folder).toBeUndefined();
      });
    });

    describe('with all parameters', () => {
      it('should handle all parameters correctly', () => {
        const mockFieldFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/images/banner',
          publicPath: '/images/banner',
          entryRelative: true,
          hasTemplateTags: false,
        };

        const mockFileFolder = {
          collectionName: 'posts',
          fileName: 'post-1.md',
          internalPath: './post-1/media',
          publicPath: '/post-1/media',
          entryRelative: true,
          hasTemplateTags: false,
        };

        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockImplementation((args) => {
          if ('typedKeyPath' in args && 'isIndexFile' in args) {
            return mockFieldFolder;
          }

          if (args.fileName && !('typedKeyPath' in args)) {
            return mockFileFolder;
          }

          return mockCollectionFolder;
        });

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
          fileName: 'post-1.md',
          typedKeyPath: 'fields.banner',
          isIndexFile: false,
        });

        expect(result.field).toEqual({
          folder: mockFieldFolder,
          enabled: true,
        });
        expect(result.file).toEqual({
          folder: mockFileFolder,
          enabled: false,
        });
        expect(result.entry).toEqual({
          folder: mockFileFolder,
          enabled: true,
        });
        expect(result.collection).toEqual({
          folder: mockCollectionFolder,
          enabled: true,
        });
      });
    });

    describe('with index file', () => {
      it('should pass isIndexFile parameter to getAssetFolder for field folder', () => {
        vi.mocked(getAssetFolder).mockReturnValue(undefined);

        getAssetLibraryFolderMap({
          collectionName: 'posts',
          fileName: '_index.md',
          typedKeyPath: 'fields.thumbnail',
          isIndexFile: true,
        });

        expect(vi.mocked(getAssetFolder)).toHaveBeenCalledWith({
          collectionName: 'posts',
          fileName: '_index.md',
          typedKeyPath: 'fields.thumbnail',
          isIndexFile: true,
        });
      });
    });

    describe('asset collection folders', () => {
      it('should add asset collection folders to the map', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        const mockAssetCollection1 = {
          collectionName: 'assets:icons',
          isAssetCollection: true,
          internalPath: 'static/icons',
          publicPath: '/icons',
          entryRelative: false,
          hasTemplateTags: false,
        };

        const mockAssetCollection2 = {
          collectionName: 'assets:images',
          isAssetCollection: true,
          internalPath: 'static/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);
        allAssetFolders.set([mockAssetCollection1, mockAssetCollection2]);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        expect(result['assets:icons']).toEqual({
          folder: mockAssetCollection1,
          enabled: true,
        });
        expect(result['assets:images']).toEqual({
          folder: mockAssetCollection2,
          enabled: true,
        });
      });

      it('should not add asset collection folders without collectionName', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        const mockAssetCollectionWithoutName = {
          collectionName: undefined,
          isAssetCollection: true,
          internalPath: 'static/assets',
          publicPath: '/assets',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);
        allAssetFolders.set([mockAssetCollectionWithoutName]);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        // Should not have any dynamic asset collection properties (only the standard ones)
        expect(Object.keys(result).sort()).toEqual(
          ['collection', 'entry', 'field', 'file', 'global'].sort(),
        );
      });

      it('should not add folders where isAssetCollection is false', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        const mockRegularFolder = {
          collectionName: 'regular',
          isAssetCollection: false,
          internalPath: 'static/regular',
          publicPath: '/regular',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);
        allAssetFolders.set([mockRegularFolder]);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        // Should not have 'regular' key
        expect(result.regular).toBeUndefined();
      });

      it('should handle mixed asset collections and regular folders', () => {
        const mockCollectionFolder = {
          collectionName: 'posts',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        const mockAssetCollection = {
          collectionName: 'assets:icons',
          isAssetCollection: true,
          internalPath: 'static/icons',
          publicPath: '/icons',
          entryRelative: false,
          hasTemplateTags: false,
        };

        const mockRegularFolder = {
          collectionName: 'regular',
          isAssetCollection: false,
          internalPath: 'static/regular',
          publicPath: '/regular',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockReturnValue(mockCollectionFolder);
        allAssetFolders.set([mockAssetCollection, mockRegularFolder]);

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
        });

        // Should have asset collection but not the regular folder
        expect(result['assets:icons']).toBeDefined();
        expect(result.regular).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('should handle when both entryRelative and hasTemplateTags are false', () => {
        const mockFileFolder = {
          collectionName: 'posts',
          fileName: 'post-1.md',
          internalPath: 'content/posts/media',
          publicPath: '/media',
          entryRelative: false,
          hasTemplateTags: false,
        };

        vi.mocked(getAssetFolder).mockImplementation((args) => {
          if (args.fileName && !('typedKeyPath' in args)) {
            return mockFileFolder;
          }

          return undefined;
        });

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
          fileName: 'post-1.md',
        });

        expect(result.file.enabled).toBe(true);
        expect(result.entry.enabled).toBe(false);
      });

      it('should handle when both entryRelative and hasTemplateTags are true', () => {
        const mockFileFolder = {
          collectionName: 'posts',
          fileName: 'post-1.md',
          internalPath: './{{slug}}/media',
          publicPath: '/{{slug}}/media',
          entryRelative: true,
          hasTemplateTags: true,
        };

        vi.mocked(getAssetFolder).mockImplementation((args) => {
          if (args.fileName && !('typedKeyPath' in args)) {
            return mockFileFolder;
          }

          return undefined;
        });

        const result = getAssetLibraryFolderMap({
          collectionName: 'posts',
          fileName: 'post-1.md',
        });

        expect(result.file.enabled).toBe(false);
        expect(result.entry.enabled).toBe(true);
      });
    });
  });

  describe('getTargetFolderPath', () => {
    describe('when folder is undefined', () => {
      it('should return undefined', () => {
        const result = getTargetFolderPath({ entry: undefined, folder: undefined });

        expect(result).toBeUndefined();
      });
    });

    describe('when folder is not entry-relative', () => {
      it('should return internalPath when it has no template tags', () => {
        const result = getTargetFolderPath({
          entry: undefined,
          folder: /** @type {any} */ ({
            entryRelative: false,
            internalPath: 'static/uploads',
            internalSubPath: undefined,
          }),
        });

        expect(result).toBe('static/uploads');
      });

      it('should replace {{slug}} with the entry slug when entry is provided', () => {
        const result = getTargetFolderPath({
          entry: /** @type {any} */ ({ slug: 'my-post' }),
          folder: /** @type {any} */ ({
            entryRelative: false,
            internalPath: 'content/posts/{{slug}}/images',
            internalSubPath: undefined,
          }),
        });

        expect(result).toBe('content/posts/my-post/images');
      });

      it('should replace {{slug}} with a dash placeholder when entry is absent', () => {
        const result = getTargetFolderPath({
          entry: undefined,
          folder: /** @type {any} */ ({
            entryRelative: false,
            internalPath: 'content/posts/{{slug}}/images',
            internalSubPath: undefined,
          }),
        });

        expect(result).toBe('content/posts/-/images');
      });

      it('should return undefined when internalPath is undefined', () => {
        const result = getTargetFolderPath({
          entry: undefined,
          folder: /** @type {any} */ ({
            entryRelative: false,
            internalPath: undefined,
            internalSubPath: undefined,
          }),
        });

        expect(result).toBeUndefined();
      });
    });

    describe('when folder is entry-relative', () => {
      it('should return the entry directory when entry is provided and no internalSubPath', () => {
        vi.mocked(getPathInfo).mockReturnValue(/** @type {any} */ ({ dirname: 'content/posts' }));

        const result = getTargetFolderPath({
          entry: /** @type {any} */ ({
            locales: { en: { path: 'content/posts/my-post.md' } },
          }),
          folder: /** @type {any} */ ({
            entryRelative: true,
            internalPath: 'content/posts',
            internalSubPath: '',
          }),
        });

        expect(result).toBe('content/posts');
        expect(getPathInfo).toHaveBeenCalledWith('content/posts/my-post.md');
      });

      it('should return entry directory with subPath when internalSubPath is set', () => {
        vi.mocked(getPathInfo).mockReturnValue(/** @type {any} */ ({ dirname: 'content/posts' }));

        const result = getTargetFolderPath({
          entry: /** @type {any} */ ({
            locales: { en: { path: 'content/posts/my-post.md' } },
          }),
          folder: /** @type {any} */ ({
            entryRelative: true,
            internalPath: 'content/posts',
            internalSubPath: 'images',
          }),
        });

        expect(result).toBe('content/posts/images');
      });

      it('should return internalPath/-  when no entry and no internalSubPath', () => {
        const result = getTargetFolderPath({
          entry: undefined,
          folder: /** @type {any} */ ({
            entryRelative: true,
            internalPath: 'content/posts',
            internalSubPath: '',
          }),
        });

        expect(result).toBe('content/posts/-');
      });

      it('should return internalPath/subPath/- when no entry and internalSubPath is set', () => {
        const result = getTargetFolderPath({
          entry: undefined,
          folder: /** @type {any} */ ({
            entryRelative: true,
            internalPath: 'content/posts',
            internalSubPath: 'images',
          }),
        });

        expect(result).toBe('content/posts/images/-');
      });
    });
  });

  describe('isAssetInSelectedFolder', () => {
    /** @type {import('$lib/types/private').AssetFolderInfo} */
    const folder = {
      collectionName: 'posts',
      internalPath: 'content/posts/images',
      publicPath: '/images',
      entryRelative: false,
      hasTemplateTags: false,
    };

    /** @type {import('$lib/types/private').Asset} */
    const asset = {
      path: 'content/posts/images/photo.jpg',
      name: 'photo.jpg',
      kind: 'image',
      size: 1024,
      text: '',
      sha: 'abc123',
      folder: {
        collectionName: 'posts',
        internalPath: 'content/posts/images',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      },
    };

    describe('returns false for mismatching folder info', () => {
      it('should return false when folder is undefined', () => {
        expect(
          isAssetInSelectedFolder({ asset, folder: undefined, folderPath: 'content/posts/images' }),
        ).toBe(false);
      });

      it('should return false when asset folder internalPath differs', () => {
        const differentFolder = { ...folder, internalPath: 'static/uploads' };

        expect(
          isAssetInSelectedFolder({
            asset,
            folder: differentFolder,
            folderPath: 'static/uploads',
          }),
        ).toBe(false);
      });

      it('should return false when asset folder entryRelative differs', () => {
        const relativeFolder = { ...folder, entryRelative: true };

        expect(
          isAssetInSelectedFolder({
            asset,
            folder: relativeFolder,
            folderPath: 'content/posts/images',
          }),
        ).toBe(false);
      });
    });

    describe('when folder is not entry-relative', () => {
      it('should return true when asset path exactly matches folderPath', () => {
        expect(
          isAssetInSelectedFolder({
            asset,
            folder,
            folderPath: 'content/posts/images/photo.jpg',
          }),
        ).toBe(true);
      });

      it('should return true when asset path with /- suffix matches folderPath (unresolved template)', () => {
        const assetAtRoot = { ...asset, path: 'content/posts/images' };

        expect(
          isAssetInSelectedFolder({
            asset: assetAtRoot,
            folder,
            folderPath: 'content/posts/images/-',
          }),
        ).toBe(true);
      });

      it('should return true when asset path is a subdirectory of folderPath', () => {
        expect(
          isAssetInSelectedFolder({
            asset,
            folder,
            folderPath: 'content/posts/images',
          }),
        ).toBe(true);
      });

      it('should return false when folderPath is undefined', () => {
        expect(isAssetInSelectedFolder({ asset, folder, folderPath: undefined })).toBe(false);
      });

      it('should return false when asset path does not match folderPath', () => {
        expect(
          isAssetInSelectedFolder({
            asset,
            folder,
            folderPath: 'static/uploads',
          }),
        ).toBe(false);
      });
    });

    describe('when folder is entry-relative', () => {
      const relativeFolder = { ...folder, entryRelative: true };

      const relativeAsset = {
        ...asset,
        path: 'content/posts/my-post/photo.jpg',
        folder: { ...asset.folder, entryRelative: true },
      };

      it('should return true when asset dirname exactly matches folderPath', () => {
        vi.mocked(getPathInfo).mockReturnValue(
          /** @type {any} */ ({ dirname: 'content/posts/my-post' }),
        );

        expect(
          isAssetInSelectedFolder({
            asset: relativeAsset,
            folder: relativeFolder,
            folderPath: 'content/posts/my-post',
          }),
        ).toBe(true);
      });

      it('should return true when asset dirname is a subdirectory of folderPath', () => {
        vi.mocked(getPathInfo).mockReturnValue(
          /** @type {any} */ ({ dirname: 'content/posts/my-post/images' }),
        );

        expect(
          isAssetInSelectedFolder({
            asset: relativeAsset,
            folder: relativeFolder,
            folderPath: 'content/posts/my-post',
          }),
        ).toBe(true);
      });

      it('should return false when dirname is undefined', () => {
        vi.mocked(getPathInfo).mockReturnValue(/** @type {any} */ ({ dirname: undefined }));

        expect(
          isAssetInSelectedFolder({
            asset: relativeAsset,
            folder: relativeFolder,
            folderPath: 'content/posts/my-post',
          }),
        ).toBe(false);
      });

      it('should return false when dirname does not match folderPath', () => {
        vi.mocked(getPathInfo).mockReturnValue(
          /** @type {any} */ ({ dirname: 'content/other/post' }),
        );

        expect(
          isAssetInSelectedFolder({
            asset: relativeAsset,
            folder: relativeFolder,
            folderPath: 'content/posts/my-post',
          }),
        ).toBe(false);
      });

      it('should return false when folderPath is undefined', () => {
        vi.mocked(getPathInfo).mockReturnValue(
          /** @type {any} */ ({ dirname: 'content/posts/my-post' }),
        );

        expect(
          isAssetInSelectedFolder({
            asset: relativeAsset,
            folder: relativeFolder,
            folderPath: undefined,
          }),
        ).toBe(false);
      });
    });
  });

  describe('listAssets', () => {
    /** @type {import('$lib/types/private').AssetFolderInfo} */
    const folder = {
      collectionName: 'posts',
      internalPath: 'content/posts/images',
      publicPath: '/images',
      entryRelative: false,
      hasTemplateTags: false,
    };

    /**
     * Create a minimal asset in the shared folder.
     * @param {string} name Asset file name.
     * @param {import('$lib/types/private').AssetKind} [kind] Asset kind.
     * @returns {import('$lib/types/private').Asset} Asset.
     */
    const makeAsset = (name, kind = 'image') => ({
      path: `content/posts/images/${name}`,
      name,
      kind,
      size: 100,
      text: '',
      sha: 'abc',
      folder,
    });

    beforeEach(() => {
      allAssets.set([]);
    });

    it('should return empty array when there are no assets', () => {
      const result = listAssets({
        kind: undefined,
        folder,
        folderPath: 'content/posts/images',
        unsavedAssets: [],
      });

      expect(result).toEqual([]);
    });

    it('should include matching assets from the allAssets store', () => {
      allAssets.set([makeAsset('photo.jpg')]);

      const result = listAssets({
        kind: undefined,
        folder,
        folderPath: 'content/posts/images',
        unsavedAssets: [],
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('photo.jpg');
    });

    it('should include matching unsaved assets', () => {
      const result = listAssets({
        kind: undefined,
        folder,
        folderPath: 'content/posts/images',
        unsavedAssets: [makeAsset('draft.jpg')],
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('draft.jpg');
    });

    it('should combine allAssets and unsavedAssets', () => {
      allAssets.set([makeAsset('saved.jpg')]);

      const result = listAssets({
        kind: undefined,
        folder,
        folderPath: 'content/posts/images',
        unsavedAssets: [makeAsset('draft.jpg')],
      });

      expect(result).toHaveLength(2);
    });

    it('should filter by kind when kind is provided', () => {
      allAssets.set([makeAsset('photo.jpg', 'image'), makeAsset('video.mp4', 'video')]);

      const result = listAssets({
        kind: 'image',
        folder,
        folderPath: 'content/posts/images',
        unsavedAssets: [],
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('photo.jpg');
    });

    it('should include all kinds when kind is undefined', () => {
      allAssets.set([makeAsset('photo.jpg', 'image'), makeAsset('video.mp4', 'video')]);

      const result = listAssets({
        kind: undefined,
        folder,
        folderPath: 'content/posts/images',
        unsavedAssets: [],
      });

      expect(result).toHaveLength(2);
    });

    it('should sort assets alphabetically by name', () => {
      allAssets.set([makeAsset('c.jpg'), makeAsset('a.jpg'), makeAsset('b.jpg')]);

      const result = listAssets({
        kind: undefined,
        folder,
        folderPath: 'content/posts/images',
        unsavedAssets: [],
      });

      expect(result.map((a) => a.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    });

    it('should place unsaved assets before saved assets regardless of name order', () => {
      allAssets.set([makeAsset('alpha.jpg')]);

      const unsaved = /** @type {any} */ ({ ...makeAsset('zeta.jpg'), unsaved: true });

      const result = listAssets({
        kind: undefined,
        folder,
        folderPath: 'content/posts/images',
        unsavedAssets: [unsaved],
      });

      expect(result[0].name).toBe('zeta.jpg');
      expect(result[1].name).toBe('alpha.jpg');
    });

    it('should exclude assets not in the selected folder', () => {
      /** @type {import('$lib/types/private').AssetFolderInfo} */
      const otherFolder = { ...folder, internalPath: 'static/uploads' };
      const inFolder = makeAsset('photo.jpg');
      const outOfFolder = { ...makeAsset('other.jpg'), folder: otherFolder };

      allAssets.set([inFolder, outOfFolder]);

      const result = listAssets({
        kind: undefined,
        folder,
        folderPath: 'content/posts/images',
        unsavedAssets: [],
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('photo.jpg');
    });

    it('should return empty array when folder is undefined', () => {
      allAssets.set([makeAsset('photo.jpg')]);

      const result = listAssets({
        kind: undefined,
        folder: undefined,
        folderPath: 'content/posts/images',
        unsavedAssets: [],
      });

      expect(result).toEqual([]);
    });
  });

  describe('hasSameAsset', () => {
    /** @type {import('$lib/types/private').AssetFolderInfo} */
    const folder = {
      collectionName: 'posts',
      internalPath: 'content/posts/images',
      publicPath: '/images',
      entryRelative: false,
      hasTemplateTags: false,
    };

    it('should return false when unsavedAssets is empty', async () => {
      const result = await hasSameAsset({ hash: 'abc123', folder, unsavedAssets: [] });

      expect(result).toBe(false);
    });

    it('should return false when asset has no file', async () => {
      const asset = /** @type {any} */ ({ file: undefined, folder });

      vi.mocked(equal).mockReturnValue(true);

      const result = await hasSameAsset({ hash: 'abc123', folder, unsavedAssets: [asset] });

      expect(result).toBe(false);
    });

    it('should return false when asset folder does not match', async () => {
      const file = new File(['data'], 'photo.jpg');
      const asset = /** @type {any} */ ({ file, folder: { ...folder, internalPath: 'other' } });

      vi.mocked(equal).mockReturnValue(false);

      const result = await hasSameAsset({ hash: 'abc123', folder, unsavedAssets: [asset] });

      expect(result).toBe(false);
      expect(getHash).not.toHaveBeenCalled();
    });

    it('should return false when hash does not match', async () => {
      const file = new File(['data'], 'photo.jpg');
      const asset = /** @type {any} */ ({ file, folder });

      vi.mocked(equal).mockReturnValue(true);
      vi.mocked(getHash).mockResolvedValue('different-hash');

      const result = await hasSameAsset({ hash: 'abc123', folder, unsavedAssets: [asset] });

      expect(result).toBe(false);
    });

    it('should return true when hash and folder both match', async () => {
      const file = new File(['data'], 'photo.jpg');
      const asset = /** @type {any} */ ({ file, folder });

      vi.mocked(equal).mockReturnValue(true);
      vi.mocked(getHash).mockResolvedValue('abc123');

      const result = await hasSameAsset({ hash: 'abc123', folder, unsavedAssets: [asset] });

      expect(result).toBe(true);
    });

    it('should return true when at least one asset matches among multiple', async () => {
      const file1 = new File(['data1'], 'photo1.jpg');
      const file2 = new File(['data2'], 'photo2.jpg');

      const assets = /** @type {any[]} */ ([
        { file: file1, folder },
        { file: file2, folder },
      ]);

      vi.mocked(equal).mockReturnValue(true);
      vi.mocked(getHash).mockResolvedValueOnce('no-match').mockResolvedValueOnce('abc123');

      const result = await hasSameAsset({ hash: 'abc123', folder, unsavedAssets: assets });

      expect(result).toBe(true);
    });

    it('should pass the asset file to getHash', async () => {
      const file = new File(['data'], 'photo.jpg');
      const asset = /** @type {any} */ ({ file, folder });

      vi.mocked(equal).mockReturnValue(true);
      vi.mocked(getHash).mockResolvedValue('abc123');

      await hasSameAsset({ hash: 'abc123', folder, unsavedAssets: [asset] });

      expect(getHash).toHaveBeenCalledWith(file);
    });

    it('should pass the asset folder and provided folder to equal', async () => {
      const file = new File(['data'], 'photo.jpg');
      const assetFolder = { ...folder };
      const asset = /** @type {any} */ ({ file, folder: assetFolder });

      vi.mocked(equal).mockReturnValue(false);

      await hasSameAsset({ hash: 'abc123', folder, unsavedAssets: [asset] });

      expect(equal).toHaveBeenCalledWith(assetFolder, folder);
    });
  });
});
