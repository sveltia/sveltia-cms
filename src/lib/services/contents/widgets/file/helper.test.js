import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAssetLibraryFolderMap } from './helper';

// Mock dependencies
vi.mock('$lib/services/assets/folders', async () => {
  const actual = await vi.importActual('$lib/services/assets/folders');

  return {
    ...actual,
    getAssetFolder: vi.fn(),
  };
});

const { getAssetFolder } = await import('$lib/services/assets/folders');

describe('contents/widgets/file/helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
