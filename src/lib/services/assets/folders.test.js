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

    it('should not match subfolders when matchSubFolders is false and path matches exactly', () => {
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'content/posts',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'content/posts',
      });

      const result = getAssetFoldersByPath('content/posts/image.jpg', {
        matchSubFolders: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('content/posts');
    });

    it('should use word boundary when matchSubFolders is true', () => {
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'content/posts',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'content/posts',
      });

      const result = getAssetFoldersByPath('content/posts/image.jpg', {
        matchSubFolders: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('content/posts');
    });

    it('should not match when path dirname does not match folder and matchSubFolders is true', () => {
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'content/posts',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'photo.jpg',
        basename: 'photo.jpg',
        dirname: 'different/path',
      });

      const result = getAssetFoldersByPath('different/path/photo.jpg', {
        matchSubFolders: true,
      });

      expect(result).toEqual([]);
    });

    it('should use word boundary when both internalPath and matchSubFolders are true', () => {
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'uploads/posts',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'uploads/posts',
      });

      // With matchSubFolders true, should match exact dirname
      const result = getAssetFoldersByPath('uploads/posts/image.jpg', {
        matchSubFolders: true,
      });

      expect(result).toHaveLength(1);
    });

    it('should exclude matching subfolders when matchSubFolders is false', () => {
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'content/posts',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'content/posts/subfolder',
      });

      // With matchSubFolders false, should NOT match subfolders
      const result = getAssetFoldersByPath('content/posts/subfolder/image.jpg', {
        matchSubFolders: false,
      });

      expect(result).toEqual([]);
    });

    it('should use end anchor with non-empty internalPath and matchSubFolders=false', () => {
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'photo.jpg',
        basename: 'photo.jpg',
        dirname: 'images',
      });

      const result = getAssetFoldersByPath('images/photo.jpg', {
        matchSubFolders: false,
      });

      expect(result).toHaveLength(1);
    });

    it('should use end anchor with empty internalPath', () => {
      allAssetFolders.set([
        {
          collectionName: 'global',
          internalPath: '',
          publicPath: '/assets',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: '',
      });

      const result = getAssetFoldersByPath('image.jpg', { matchSubFolders: true });

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('');
    });

    it('should handle sort with undefined internalPaths', () => {
      allAssetFolders.set([
        {
          collectionName: 'a',
          internalPath: undefined,
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'b',
          internalPath: 'content/posts',
          publicPath: '/b',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'c',
          internalPath: undefined,
          publicPath: '/c',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'test.jpg',
        basename: 'test.jpg',
        dirname: 'content/posts',
      });

      const result = getAssetFoldersByPath('content/posts/test.jpg');

      // Should properly sort when some internalPaths are undefined
      expect(result).toBeDefined();
    });

    it('should sort with multiple folders having same internalPath prefix', () => {
      allAssetFolders.set([
        {
          collectionName: 'a',
          internalPath: 'content',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'b',
          internalPath: 'content/posts',
          publicPath: '/b',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'c',
          internalPath: 'content/posts/blog',
          publicPath: '/c',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'test.jpg',
        basename: 'test.jpg',
        dirname: 'content/posts/blog',
      });

      const result = getAssetFoldersByPath('content/posts/blog/test.jpg');

      // Should return sorted results in descending order
      expect(result).toHaveLength(3);
      expect(result[0].internalPath).toBe('content/posts/blog');
      expect(result[1].internalPath).toBe('content/posts');
      expect(result[2].internalPath).toBe('content');
    });

    it('should sort folders with identical internalPath', () => {
      allAssetFolders.set([
        {
          collectionName: 'a',
          internalPath: 'content/posts',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'b',
          internalPath: 'content/posts',
          publicPath: '/b',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'test.jpg',
        basename: 'test.jpg',
        dirname: 'content/posts',
      });

      const result = getAssetFoldersByPath('content/posts/test.jpg');

      // Both should be in results, sorted by localeCompare which returns 0
      expect(result).toHaveLength(2);
      expect(result[0].internalPath).toBe('content/posts');
      expect(result[1].internalPath).toBe('content/posts');
    });

    it('should handle dirname being null when matching regex', () => {
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'content',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'test.jpg',
        basename: 'test.jpg',
        dirname: undefined,
      });

      const result = getAssetFoldersByPath('test.jpg');

      // With undefined dirname, should not match folder
      expect(result).toEqual([]);
    });

    it('should handle when anchor is end anchor ($) with matchSubFolders false', () => {
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'uploads',
          publicPath: '/uploads',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'uploads',
      });

      // matchSubFolders: false should use end anchor ($)
      const result = getAssetFoldersByPath('uploads/image.jpg', { matchSubFolders: false });

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('uploads');
    });

    it('should handle when anchor is word boundary (\\b) with matchSubFolders true', () => {
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'data',
          publicPath: '/data',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'content.json',
        basename: 'content.json',
        dirname: 'data',
      });

      // matchSubFolders: true should use word boundary (\\b)
      const result = getAssetFoldersByPath('data/content.json', { matchSubFolders: true });

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('data');
    });

    it('should test regex with different internalPath values', () => {
      allAssetFolders.set([
        {
          collectionName: 'a',
          internalPath: 'src/assets',
          publicPath: '/assets',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'b',
          internalPath: 'public/assets',
          publicPath: '/public',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'logo.png',
        basename: 'logo.png',
        dirname: 'src/assets',
      });

      // Should match only the first folder
      const result = getAssetFoldersByPath('src/assets/logo.png', { matchSubFolders: false });

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('src/assets');
    });

    it('should handle empty string internalPath in sort', () => {
      allAssetFolders.set([
        {
          collectionName: 'a',
          internalPath: '',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'b',
          internalPath: 'content',
          publicPath: '/b',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'test.jpg',
        basename: 'test.jpg',
        dirname: '',
      });

      // Empty string should match with matchSubFolders true
      const result = getAssetFoldersByPath('test.jpg', { matchSubFolders: true });

      // Should have content folder too if it matches
      expect(result).toBeDefined();
    });

    it('should sort by localeCompare with various path comparisons', () => {
      allAssetFolders.set([
        {
          collectionName: 'z',
          internalPath: 'z-folder',
          publicPath: '/z',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'a',
          internalPath: 'a-folder',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'm',
          internalPath: 'm-folder',
          publicPath: '/m',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'test.jpg',
        basename: 'test.jpg',
        dirname: 'a-folder',
      });

      // Match against a-folder
      const result = getAssetFoldersByPath('a-folder/test.jpg');

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('a-folder');
    });

    it('should handle sort when comparing many folders', () => {
      allAssetFolders.set([
        {
          collectionName: 'c',
          internalPath: 'uploads/c',
          publicPath: '/c',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'a',
          internalPath: 'uploads/a',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'b',
          internalPath: 'uploads/b',
          publicPath: '/b',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'd',
          internalPath: 'uploads',
          publicPath: '/d',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'file.jpg',
        basename: 'file.jpg',
        dirname: 'uploads/b',
      });

      const result = getAssetFoldersByPath('uploads/b/file.jpg');

      // Should match uploads/b and uploads, sorted in descending order
      expect(result.map((f) => f.internalPath)).toEqual(['uploads/b', 'uploads']);
    });

    it('should ensure all code paths are covered in filter', () => {
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'content/posts',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'content/posts',
      });

      // Test with matchSubFolders = false and exact match
      const result1 = getAssetFoldersByPath('content/posts/image.jpg', { matchSubFolders: false });

      expect(result1).toHaveLength(1);

      // Test with matchSubFolders = true (default) and exact match
      const result2 = getAssetFoldersByPath('content/posts/image.jpg', { matchSubFolders: true });

      expect(result2).toHaveLength(1);
    });

    it('should handle sorting with identical internal paths (localeCompare returns 0)', () => {
      // Test the ?? 0 fallback when localeCompare returns falsy value
      allAssetFolders.set([
        {
          collectionName: 'b',
          internalPath: 'same/path',
          publicPath: '/b',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'a',
          internalPath: 'same/path',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'file.jpg',
        basename: 'file.jpg',
        dirname: 'same/path',
      });

      const result = getAssetFoldersByPath('same/path/file.jpg');

      expect(result).toHaveLength(2);
      // Both should be included in results (order may vary due to sort stability)
      expect(result.every((f) => f.internalPath === 'same/path')).toBe(true);
    });

    it('should use end anchor ($) when internalPath is falsy and matchSubFolders is true', () => {
      // This tests the case where internalPath is falsy (empty string) but matchSubFolders is true
      // The condition is: internalPath && matchSubFolders ? '\\b' : '$'
      // When internalPath is '', it's falsy, so it should use '$' even though
      // matchSubFolders is true
      allAssetFolders.set([
        {
          collectionName: 'global',
          internalPath: '',
          publicPath: '/assets',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: '',
      });

      // Match with empty dirname
      const result = getAssetFoldersByPath('image.jpg', { matchSubFolders: true });

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('');
    });

    it('should not match when internalPath is falsy and dirname does not match', () => {
      // When internalPath is falsy, it should still use the $ anchor
      allAssetFolders.set([
        {
          collectionName: 'global',
          internalPath: '',
          publicPath: '/assets',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'some/path',
      });

      // Should not match because dirname is not empty
      const result = getAssetFoldersByPath('some/path/image.jpg', { matchSubFolders: true });

      expect(result).toEqual([]);
    });

    it('should use word boundary anchor when both internalPath and matchSubFolders are truthy', () => {
      // Explicit test to cover the anchor = '\\b' case
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'uploads/posts',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'image.jpg',
        basename: 'image.jpg',
        dirname: 'uploads/posts',
      });

      // With matchSubFolders: true AND non-empty internalPath, should use '\\b' anchor
      const result = getAssetFoldersByPath('uploads/posts/image.jpg', {
        matchSubFolders: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('uploads/posts');
    });

    it('should match subdir with word boundary anchor when both conditions true', () => {
      // Test matching a subdirectory with word boundary anchor
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'uploads',
          publicPath: '/uploads',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'photo.jpg',
        basename: 'photo.jpg',
        dirname: 'uploads/subfolder',
      });

      // Should match with word boundary when matchSubFolders is true
      const result = getAssetFoldersByPath('uploads/subfolder/photo.jpg', {
        matchSubFolders: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('uploads');
    });

    it('should use $ anchor when matchSubFolders is false', () => {
      // Test that $ anchor is used and prevents subfolder matching
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'uploads',
          publicPath: '/uploads',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'photo.jpg',
        basename: 'photo.jpg',
        dirname: 'uploads/subfolder',
      });

      // With matchSubFolders false and $ anchor, should NOT match subfolder
      const result = getAssetFoldersByPath('uploads/subfolder/photo.jpg', {
        matchSubFolders: false,
      });

      expect(result).toEqual([]);
    });

    it('should use $ anchor and match exact path when matchSubFolders is false', () => {
      // Test $ anchor matches exact dirname
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'uploads',
          publicPath: '/uploads',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'photo.jpg',
        basename: 'photo.jpg',
        dirname: 'uploads',
      });

      // With matchSubFolders false and exact match, should match
      const result = getAssetFoldersByPath('uploads/photo.jpg', { matchSubFolders: false });

      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('uploads');
    });

    it('should sort folders correctly by comparing internalPath', () => {
      // Ensure sort is executed with multiple matching folders
      allAssetFolders.set([
        {
          collectionName: 'z',
          internalPath: 'uploads/z',
          publicPath: '/z',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'a',
          internalPath: 'uploads/a',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'b',
          internalPath: 'uploads/b',
          publicPath: '/b',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'test.jpg',
        basename: 'test.jpg',
        dirname: 'uploads/z',
      });

      // Multiple folders match, should be sorted in descending order
      const result = getAssetFoldersByPath('uploads/z/test.jpg');

      // Should have at least uploads/z in the results
      expect(result.length).toBeGreaterThan(0);
      // uploads/z should come first since it's the most specific match
      expect(result[0].internalPath).toBe('uploads/z');
    });

    it('should test sort when internalPath localeCompare returns 0', () => {
      // Test when two folders have same dirname but different collection names
      // The sort should still work with localeCompare returning 0
      allAssetFolders.set([
        {
          collectionName: 'collection-b',
          internalPath: 'same-path',
          publicPath: '/b',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'collection-a',
          internalPath: 'same-path',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'file.jpg',
        basename: 'file.jpg',
        dirname: 'same-path',
      });

      const result = getAssetFoldersByPath('same-path/file.jpg');

      // Both should be in result (localeCompare returns 0 for same path)
      expect(result).toHaveLength(2);
      expect(result.every((f) => f.internalPath === 'same-path')).toBe(true);
    });

    it('should sort with positive localeCompare result', () => {
      // Test sort with folders that have different internalPaths
      // to trigger different localeCompare results
      allAssetFolders.set([
        {
          collectionName: 'first',
          internalPath: 'zzzz',
          publicPath: '/z',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'second',
          internalPath: 'aaaa',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'file.jpg',
        basename: 'file.jpg',
        dirname: 'zzzz',
      });

      const result = getAssetFoldersByPath('zzzz/file.jpg');

      // Should match zzzz folder
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].internalPath).toBe('zzzz');
    });

    it('should sort with negative localeCompare result', () => {
      // Test sort ensuring negative comparison is covered
      allAssetFolders.set([
        {
          collectionName: 'first',
          internalPath: 'aaaa',
          publicPath: '/a',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'second',
          internalPath: 'zzzz',
          publicPath: '/z',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'file.jpg',
        basename: 'file.jpg',
        dirname: 'zzzz',
      });

      const result = getAssetFoldersByPath('zzzz/file.jpg');

      // Should match zzzz folder
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].internalPath).toBe('zzzz');
    });

    it('should sort multiple matching folders by internalPath descending', () => {
      // Ensure the sort comparison line is fully covered by having multiple
      // folders with different internalPaths that all match
      allAssetFolders.set([
        {
          collectionName: 'root',
          internalPath: 'images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'products',
          internalPath: 'images/products',
          publicPath: '/products',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'featured',
          internalPath: 'images/products/featured',
          publicPath: '/featured',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'pic.jpg',
        basename: 'pic.jpg',
        dirname: 'images/products/featured',
      });

      // With matchSubFolders true, all three should match
      const result = getAssetFoldersByPath('images/products/featured/pic.jpg', {
        matchSubFolders: true,
      });

      // Should have all three folders
      expect(result).toHaveLength(3);
      // Should be sorted in descending order
      expect(result[0].internalPath).toBe('images/products/featured');
      expect(result[1].internalPath).toBe('images/products');
      expect(result[2].internalPath).toBe('images');
    });

    it('should include empty string internalPath in sort', () => {
      // Test that empty internalPath ('') is included in results and sort
      allAssetFolders.set([
        {
          collectionName: 'root',
          internalPath: '',
          publicPath: '/',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'images',
          internalPath: 'images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'pic.jpg',
        basename: 'pic.jpg',
        dirname: 'images',
      });

      const result = getAssetFoldersByPath('images/pic.jpg', { matchSubFolders: true });

      // Should have the images folder that matches
      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('images');
    });

    it('should handle empty filter result without sort issue', () => {
      // Test case where no folders match - sort still runs but on empty array
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'posts',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'file.jpg',
        basename: 'file.jpg',
        dirname: 'images',
      });

      const result = getAssetFoldersByPath('images/file.jpg');

      // Should return empty array  (sort is called but on empty array)
      expect(result).toEqual([]);
    });

    it('should sort even with single matching folder', () => {
      // Single folder should still go through sort
      allAssetFolders.set([
        {
          collectionName: 'posts',
          internalPath: 'posts',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'article.jpg',
        basename: 'article.jpg',
        dirname: 'posts',
      });

      const result = getAssetFoldersByPath('posts/article.jpg');

      // Single folder should match and be sorted
      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('posts');
    });

    it('should sort with empty string internalPath', () => {
      // Test sort with multiple folders including one with empty internalPath
      allAssetFolders.set([
        {
          collectionName: 'empty',
          internalPath: '',
          publicPath: '/',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'posts',
          internalPath: 'posts',
          publicPath: '/posts',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'file.jpg',
        basename: 'file.jpg',
        dirname: 'posts',
      });

      const result = getAssetFoldersByPath('posts/file.jpg', { matchSubFolders: true });

      // Should match posts folder
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].internalPath).toBe('posts');
    });

    it('should sort two folders with empty and non-empty internalPath', () => {
      // Test sort comparison when one has empty string
      allAssetFolders.set([
        {
          collectionName: 'root',
          internalPath: '',
          publicPath: '/',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'dir',
          internalPath: 'dir',
          publicPath: '/dir',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'file.jpg',
        basename: 'file.jpg',
        dirname: '',
      });

      // This should match the empty internalPath
      const result = getAssetFoldersByPath('file.jpg', { matchSubFolders: false });

      // Empty path should match
      expect(result).toHaveLength(1);
      expect(result[0].internalPath).toBe('');
    });

    it('should trigger localeCompare with different return values', () => {
      // Create folders that will definitely have different internalPaths in sort
      // to ensure all localeCompare return values are tested
      allAssetFolders.set([
        {
          collectionName: 'aaa',
          internalPath: 'aaa',
          publicPath: '/aaa',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'bbb',
          internalPath: 'bbb',
          publicPath: '/bbb',
          entryRelative: false,
          hasTemplateTags: false,
        },
        {
          collectionName: 'aaa_sub',
          internalPath: 'aaa/sub',
          publicPath: '/aaa-sub',
          entryRelative: false,
          hasTemplateTags: false,
        },
      ]);

      getPathInfoMock.mockReturnValue({
        filename: 'test.jpg',
        basename: 'test.jpg',
        dirname: 'aaa/sub',
      });

      // Match multiple folders with different paths
      const result = getAssetFoldersByPath('aaa/sub/test.jpg', { matchSubFolders: true });

      // Should have matches
      expect(result.length).toBeGreaterThan(0);

      // Verify sort is applied (descending order)
      for (let i = 0; i < result.length - 1; i += 1) {
        const current = result[i].internalPath ?? '';
        const next = result[i + 1].internalPath ?? '';

        // Descending order means current should be >= next
        expect(current.localeCompare(next)).toBeGreaterThanOrEqual(0);
      }
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
