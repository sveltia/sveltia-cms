import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  allAssetFolders,
  canCreateAsset,
  getAssetFolder,
  getAssetFoldersByPath,
  globalAssetFolder,
  selectedAssetFolder,
  targetAssetFolder,
} from './folders';

// Mock dependencies
vi.mock('@sveltia/utils/file');

describe('assets/folders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores
    allAssetFolders.set([]);
    selectedAssetFolder.set(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('stores', () => {
    it('should initialize allAssetFolders as empty array', () => {
      expect(get(allAssetFolders)).toEqual([]);
    });

    it('should initialize selectedAssetFolder as undefined', () => {
      expect(get(selectedAssetFolder)).toBeUndefined();
    });
  });

  describe('globalAssetFolder', () => {
    it('should find the global asset folder', () => {
      const mockFolders = [
        {
          collectionName: 'posts',
          internalPath: 'content/posts/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: undefined,
          internalPath: 'static/uploads',
          publicPath: '/uploads',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: undefined,
          internalPath: undefined,
          publicPath: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      ];

      allAssetFolders.set(mockFolders);

      const result = get(globalAssetFolder);

      expect(result).toEqual(mockFolders[1]);
    });

    it('should handle case when no global folder exists', () => {
      const mockFolders = [
        {
          collectionName: 'posts',
          internalPath: 'content/posts/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ];

      allAssetFolders.set(mockFolders);

      const result = get(globalAssetFolder);

      expect(result).toBeUndefined();
    });
  });

  describe('targetAssetFolder', () => {
    it('should return selected folder when it has internalPath', () => {
      const globalFolder = {
        collectionName: undefined,
        internalPath: 'static/uploads',
        publicPath: '/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const selectedFolder = {
        collectionName: 'posts',
        internalPath: 'content/posts/images',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      };

      allAssetFolders.set([globalFolder, selectedFolder]);
      selectedAssetFolder.set(selectedFolder);

      const result = get(targetAssetFolder);

      expect(result).toEqual(selectedFolder);
    });

    it('should return global folder when selected folder has no internalPath', () => {
      const globalFolder = {
        collectionName: undefined,
        internalPath: 'static/uploads',
        publicPath: '/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const selectedFolder = {
        collectionName: undefined,
        internalPath: undefined,
        publicPath: undefined,
        entryRelative: false,
        hasTemplateTags: false,
      };

      allAssetFolders.set([globalFolder, selectedFolder]);
      selectedAssetFolder.set(selectedFolder);

      const result = get(targetAssetFolder);

      expect(result).toEqual(globalFolder);
    });

    it('should return global folder when no folder is selected', () => {
      const globalFolder = {
        collectionName: undefined,
        internalPath: 'static/uploads',
        publicPath: '/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      allAssetFolders.set([globalFolder]);
      selectedAssetFolder.set(undefined);

      const result = get(targetAssetFolder);

      expect(result).toEqual(globalFolder);
    });
  });

  describe('getAssetFolder', () => {
    beforeEach(() => {
      const mockFolders = [
        {
          collectionName: 'posts',
          fileName: undefined,
          keyPath: undefined,
          internalPath: 'content/posts/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'posts',
          fileName: 'about.md',
          keyPath: undefined,
          internalPath: 'content/posts/about/images',
          publicPath: '/about/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'posts',
          fileName: undefined,
          keyPath: 'gallery',
          internalPath: 'content/posts/gallery',
          publicPath: '/gallery',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ];

      allAssetFolders.set(mockFolders);
    });

    it('should find folder by collection name only', () => {
      const result = getAssetFolder({
        collectionName: 'posts',
        fileName: undefined,
        keyPath: undefined,
      });

      expect(result).toEqual({
        collectionName: 'posts',
        fileName: undefined,
        keyPath: undefined,
        internalPath: 'content/posts/images',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should find folder by collection name and file name', () => {
      const result = getAssetFolder({
        collectionName: 'posts',
        fileName: 'about.md',
        keyPath: undefined,
      });

      expect(result).toEqual({
        collectionName: 'posts',
        fileName: 'about.md',
        keyPath: undefined,
        internalPath: 'content/posts/about/images',
        publicPath: '/about/images',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should find folder by collection name and key path', () => {
      const result = getAssetFolder({
        collectionName: 'posts',
        fileName: undefined,
        keyPath: 'gallery',
      });

      expect(result).toEqual({
        collectionName: 'posts',
        fileName: undefined,
        keyPath: 'gallery',
        internalPath: 'content/posts/gallery',
        publicPath: '/gallery',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should return undefined when no folder matches', () => {
      const result = getAssetFolder({
        collectionName: 'nonexistent',
        fileName: undefined,
        keyPath: undefined,
      });

      expect(result).toBeUndefined();
    });
  });

  describe('getAssetFoldersByPath', () => {
    /** @type {import('vitest').MockedFunction<typeof import('@sveltia/utils/file').getPathInfo>} */
    let getPathInfoMock;

    beforeEach(async () => {
      const { getPathInfo } = await import('@sveltia/utils/file');

      getPathInfoMock = vi.mocked(getPathInfo);

      const mockFolders = [
        {
          collectionName: undefined,
          internalPath: 'static/uploads',
          publicPath: '/uploads',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'posts',
          internalPath: 'content/posts/images',
          publicPath: '/posts/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'posts',
          internalPath: 'content/posts/{{slug}}',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: true,
        },
        {
          collectionName: 'pages',
          internalPath: 'pages/assets',
          publicPath: '/pages',
          entryRelative: true,
          hasTemplateTags: false,
        },
      ];

      allAssetFolders.set(mockFolders);
    });

    it('should find folders matching exact path', () => {
      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'content/posts/images',
      });

      const result = getAssetFoldersByPath('content/posts/images/image.jpg');

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.internalPath)).toContain('content/posts/images');
      expect(result.map((f) => f.internalPath)).toContain('content/posts/{{slug}}');
    });

    it('should find folders with template tags', () => {
      getPathInfoMock.mockReturnValue({
        filename: 'hero.jpg',
        basename: 'hero.jpg',
        dirname: 'content/posts/my-post',
      });

      const result = getAssetFoldersByPath('content/posts/my-post/hero.jpg');

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('content/posts/{{slug}}');
    });

    it('should match entry relative paths', () => {
      getPathInfoMock.mockReturnValue({
        filename: 'banner.jpg',
        basename: 'banner.jpg',
        dirname: 'pages/assets/subfolder',
      });

      const result = getAssetFoldersByPath('pages/assets/subfolder/banner.jpg');

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('pages/assets');
      expect(result[0].entryRelative).toBe(true);
    });

    it('should exclude Svelte page files', () => {
      getPathInfoMock.mockReturnValue({
        filename: '+page.svelte',
        basename: '+page.svelte',
        dirname: 'content/posts',
      });

      const result = getAssetFoldersByPath('content/posts/+page.svelte');

      expect(result).toEqual([]);
    });

    it('should exclude Svelte layout files', () => {
      getPathInfoMock.mockReturnValue({
        filename: '+layout.svelte',
        basename: '+layout.svelte',
        dirname: 'content',
      });

      const result = getAssetFoldersByPath('content/+layout.svelte');

      expect(result).toEqual([]);
    });

    it('should not match subfolders when matchSubFolders is false', () => {
      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'static/uploads/subfolder',
      });

      const result = getAssetFoldersByPath('static/uploads/subfolder/image.jpg', {
        matchSubFolders: false,
      });

      expect(result).toEqual([]);
    });

    it('should match subfolders when matchSubFolders is true (default)', () => {
      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'static/uploads/subfolder',
      });

      const result = getAssetFoldersByPath('static/uploads/subfolder/image.jpg');

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('static/uploads');
    });

    it('should filter out folders with undefined internalPath', () => {
      allAssetFolders.set([
        {
          collectionName: undefined,
          internalPath: undefined,
          publicPath: undefined,
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'anywhere',
      });

      const result = getAssetFoldersByPath('anywhere/image.jpg');

      expect(result).toEqual([]);
    });

    it('should sort results by internalPath in descending order', () => {
      allAssetFolders.set([
        {
          collectionName: 'a',
          internalPath: 'content',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'c',
          internalPath: 'content/posts',
          publicPath: '/c',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'b',
          internalPath: 'content/posts/images',
          publicPath: '/b',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'test.jpg',
        basename: 'test.jpg',
        dirname: 'content/posts/images',
      });

      const result = getAssetFoldersByPath('content/posts/images/test.jpg');

      expect(result.map((f) => f.internalPath)).toEqual([
        'content/posts/images',
        'content/posts',
        'content',
      ]);
    });
  });

  describe('canCreateAsset', () => {
    it('should return true for valid folder', () => {
      const folder = {
        collectionName: 'posts',
        internalPath: 'content/posts/images',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      };

      expect(canCreateAsset(folder)).toBe(true);
    });

    it('should return false when folder is undefined', () => {
      expect(canCreateAsset(undefined)).toBe(false);
    });

    it('should return false when entryRelative is true', () => {
      const folder = {
        collectionName: 'posts',
        internalPath: 'content/posts/images',
        publicPath: '/images',
        entryRelative: true,
        hasTemplateTags: false,
      };

      expect(canCreateAsset(folder)).toBe(false);
    });

    it('should return false when hasTemplateTags is true', () => {
      const folder = {
        collectionName: 'posts',
        internalPath: 'content/posts/{{slug}}',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: true,
      };

      expect(canCreateAsset(folder)).toBe(false);
    });

    it('should return false when both entryRelative and hasTemplateTags are true', () => {
      const folder = {
        collectionName: 'posts',
        internalPath: 'content/posts/{{slug}}',
        publicPath: '/images',
        entryRelative: true,
        hasTemplateTags: true,
      };

      expect(canCreateAsset(folder)).toBe(false);
    });
  });
});
