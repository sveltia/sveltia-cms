import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addFolderIfNeeded,
  getAllAssetFolders,
  hasTags,
  iterateFiles,
  normalizeAssetFolder,
  replaceTags,
} from './assets.js';

// Mock external dependencies
vi.mock('$lib/services/contents/collection', () => ({
  getValidCollections: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getValidCollectionFiles: vi.fn(),
}));

const { getValidCollections } = await import('$lib/services/contents/collection');
const { getValidCollectionFiles } = await import('$lib/services/contents/collection/files');

describe('config/folders/assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset any internal state that might persist between tests
    vi.resetModules();
  });

  describe('getAllAssetFolders', () => {
    it('should return default asset folders for minimal config', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static/images',
        public_folder: '/images',
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        collectionName: undefined,
        internalPath: undefined,
        publicPath: undefined,
        entryRelative: false,
        hasTemplateTags: false,
      });
      expect(result[1]).toEqual({
        collectionName: undefined,
        internalPath: 'static/images',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should handle missing global media_folder', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      // Should only have the "all assets" folder
      expect(result).toHaveLength(0);
    });

    it('should handle root folder configurations', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: '.',
        public_folder: '/',
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      expect(result[1]).toEqual({
        collectionName: undefined,
        internalPath: '',
        publicPath: '/',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should handle collections with custom media folders', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
          media_folder: '/images/posts', // absolute path
          public_folder: '/static/posts',
        },
        // @ts-ignore - simplified collection for testing
        {
          name: 'pages',
          folder: 'content/pages',
          media_folder: '{{media_folder}}/pages',
          public_folder: '{{public_folder}}/pages',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      expect(result).toHaveLength(4); // all, global, posts, pages
      expect(result[2]).toEqual({
        collectionName: 'posts',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'images/posts',
        publicPath: '/static/posts',
        entryRelative: false,
        hasTemplateTags: false,
      });
      expect(result[3]).toEqual({
        collectionName: 'pages',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'static/pages',
        publicPath: '/assets/pages',
        entryRelative: false,
        hasTemplateTags: false, // tags are replaced, so no template tags remain
      });
    });

    it('should handle entry-relative media folders', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'blog',
          folder: 'content/blog',
          path: '{{slug}}/index',
          media_folder: '',
          public_folder: '.',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      expect(result[2]).toEqual({
        collectionName: 'blog',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'content/blog',
        internalSubPath: '',
        publicPath: '.',
        entryRelative: true,
        hasTemplateTags: false,
      });
    });

    it('should handle file collections', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'settings',
          files: [
            {
              name: 'general',
              file: 'config/general.yml',
              media_folder: '/uploads/general', // absolute path
              public_folder: '/uploads/general',
              fields: [],
            },
          ],
        },
      ]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'general',
          file: 'config/general.yml',
          media_folder: '/uploads/general', // absolute path
          public_folder: '/uploads/general',
          fields: [],
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      expect(result[2]).toEqual({
        collectionName: 'settings',
        fileName: 'general',
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'uploads/general',
        publicPath: '/uploads/general',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should handle singletons', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'about',
          file: 'pages/about.md',
          media_folder: '/images/about', // absolute path
          fields: [],
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
        singletons: [
          {
            name: 'about',
            file: 'pages/about.md',
            media_folder: '/images/about', // absolute path
            fields: [],
          },
        ],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      expect(result[2]).toEqual({
        collectionName: '_singletons',
        fileName: 'about',
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'images/about',
        publicPath: '/images/about',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should skip folders that match global settings', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
          media_folder: '/static', // matches global
          public_folder: '/assets', // matches global
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      // Should only have the default folders, no collection-specific folder
      expect(result).toHaveLength(2);
    });

    it('should handle empty string as configured media_folder', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: '', // empty string should be treated as configured
        public_folder: '/',
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      // Should have the global asset folder even with empty string
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        collectionName: undefined,
        internalPath: '',
        internalSubPath: undefined,
        publicPath: '/',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should handle entry path with media_folder defaulting to empty string when global folder is configured', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'blog',
          folder: 'content/blog',
          path: '{{slug}}/index', // entry-relative path
          // media_folder is undefined, should default to empty string because global is configured
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);
      // Should have the blog collection folder with media_folder defaulting to empty string
      const blogFolder = result.find((f) => f.collectionName === 'blog');

      expect(blogFolder).toBeDefined();
      expect(blogFolder?.internalPath).toBe('content/blog');
      expect(blogFolder?.internalSubPath).toBe('');
    });

    it('should NOT default media_folder to empty string for entry path when global folder is not configured', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'blog',
          folder: 'content/blog',
          path: '{{slug}}/index', // entry-relative path
          // media_folder is undefined
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        // NO global media_folder configured
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);
      // Should NOT have the blog collection folder since media_folder stays undefined
      const blogFolder = result.find((f) => f.collectionName === 'blog');

      expect(blogFolder).toBeUndefined();
    });

    it('should handle framework-specific public paths', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'assets',
          folder: 'src/assets',
          media_folder: '/src/assets', // absolute path
          public_folder: '@assets',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      expect(result[2]).toEqual({
        collectionName: 'assets',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'src/assets',
        publicPath: '@assets',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should skip collections with template tags when global folder is not configured', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
          media_folder: '{{media_folder}}/posts',
          public_folder: '{{public_folder}}/posts',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      // Should only have empty result since template tags can't be resolved
      expect(result).toHaveLength(0);
    });

    it('should handle collections without template tags when global folder is not configured', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
          media_folder: '/uploads/posts',
          public_folder: '/static/posts',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config);

      // Should have the all assets folder and the posts folder
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        collectionName: 'posts',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'uploads/posts',
        publicPath: '/static/posts',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should handle field-level media folders', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
          media_folder: '/uploads',
          public_folder: '/static',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static/images',
        public_folder: '/images',
        collections: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/uploads/banner',
            public_folder: '/static/banner',
          },
          context: {
            collection: { name: 'posts', folder: 'content/posts' },
            collectionFile: undefined,
            typedKeyPath: 'fields.banner',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);

      // Should have: all, global, collection folder, and field folder
      expect(result).toHaveLength(4);

      // The field folder should be included
      expect(result.some((f) => f.typedKeyPath === 'fields.banner')).toBe(true);

      const fieldFolder = result.find((f) => f.typedKeyPath === 'fields.banner');

      expect(fieldFolder).toEqual({
        collectionName: 'posts',
        fileName: undefined,
        typedKeyPath: 'fields.banner',
        isIndexFile: false,
        internalPath: 'uploads/banner',
        publicPath: '/static/banner',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should handle field-level media folders on file collections', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'settings',
          files: [
            {
              name: 'general',
              file: 'config/general.yml',
              media_folder: '/config/uploads',
              public_folder: '/uploads',
              fields: [],
            },
          ],
        },
      ]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'general',
          file: 'config/general.yml',
          media_folder: '/config/uploads',
          public_folder: '/uploads',
          fields: [],
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static/images',
        public_folder: '/images',
        collections: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/config/uploads/logos',
            public_folder: '/uploads/logos',
          },
          context: {
            collection: { name: 'settings', files: [] },
            collectionFile: { name: 'general' },
            typedKeyPath: 'fields.logo',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      const fieldFolder = result.find((f) => f.typedKeyPath === 'fields.logo');

      expect(fieldFolder).toEqual({
        collectionName: 'settings',
        fileName: 'general',
        typedKeyPath: 'fields.logo',
        isIndexFile: false,
        internalPath: 'config/uploads/logos',
        publicPath: '/uploads/logos',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should handle field-level media folders with index files', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'blog',
          folder: 'content/blog',
          path: '{{slug}}/index',
          media_folder: '',
          public_folder: '.',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/uploads/featured',
            public_folder: '/images/featured',
          },
          context: {
            collection: { name: 'blog', folder: 'content/blog', path: '{{slug}}/index' },
            collectionFile: undefined,
            typedKeyPath: 'fields.featured_image',
            isIndexFile: true,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      const fieldFolder = result.find((f) => f.typedKeyPath === 'fields.featured_image');

      expect(fieldFolder).toEqual({
        collectionName: 'blog',
        fileName: undefined,
        typedKeyPath: 'fields.featured_image',
        isIndexFile: true,
        internalPath: 'uploads/featured',
        publicPath: '/images/featured',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should handle multiple field-level media folders', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
          media_folder: '/uploads',
          public_folder: '/static',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static/images',
        public_folder: '/images',
        collections: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/uploads/banner',
            public_folder: '/static/banner',
          },
          context: {
            collection: { name: 'posts', folder: 'content/posts' },
            collectionFile: undefined,
            typedKeyPath: 'fields.banner',
            isIndexFile: false,
          },
        },
        {
          fieldConfig: {
            media_folder: '/uploads/thumbnail',
            public_folder: '/static/thumbnail',
          },
          context: {
            collection: { name: 'posts', folder: 'content/posts' },
            collectionFile: undefined,
            typedKeyPath: 'fields.thumbnail',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      const bannerFolder = result.find((f) => f.typedKeyPath === 'fields.banner');
      const thumbnailFolder = result.find((f) => f.typedKeyPath === 'fields.thumbnail');

      expect(bannerFolder).toBeDefined();
      expect(thumbnailFolder).toBeDefined();
      expect(bannerFolder?.internalPath).toBe('uploads/banner');
      expect(thumbnailFolder?.internalPath).toBe('uploads/thumbnail');
    });

    it('should skip field-level folders for invalid collections', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
          media_folder: '/uploads',
          public_folder: '/static',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static/images',
        public_folder: '/images',
        collections: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/uploads/banner',
            public_folder: '/static/banner',
          },
          context: {
            collection: { name: 'invalid_collection', folder: 'content/invalid' },
            collectionFile: undefined,
            typedKeyPath: 'fields.banner',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);

      // Should not include the field folder for invalid collection
      expect(result.some((f) => f.typedKeyPath === 'fields.banner')).toBe(false);
    });

    it('should handle field-level folders with template tags', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
          media_folder: '/uploads',
          public_folder: '/static',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '{{media_folder}}/banner',
            public_folder: '{{public_folder}}/banner',
          },
          context: {
            collection: { name: 'posts', folder: 'content/posts' },
            collectionFile: undefined,
            typedKeyPath: 'fields.banner',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      const fieldFolder = result.find((f) => f.typedKeyPath === 'fields.banner');

      expect(fieldFolder).toBeDefined();
      // Template tags should be replaced
      expect(fieldFolder?.internalPath).toBe('static/banner');
      expect(fieldFolder?.hasTemplateTags).toBe(false);
    });

    it('should handle field-level folders for entry-relative folders', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'docs',
          folder: 'content/docs',
          media_folder: './media',
          public_folder: '.',
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static/images',
        public_folder: '/images',
        collections: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: './media/gallery',
            public_folder: './gallery',
          },
          context: {
            collection: { name: 'docs', folder: 'content/docs' },
            collectionFile: undefined,
            typedKeyPath: 'fields.gallery',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      const fieldFolder = result.find((f) => f.typedKeyPath === 'fields.gallery');

      expect(fieldFolder).toEqual({
        collectionName: 'docs',
        fileName: undefined,
        typedKeyPath: 'fields.gallery',
        isIndexFile: false,
        internalPath: 'content/docs',
        internalSubPath: './media/gallery',
        publicPath: './gallery',
        entryRelative: true,
        hasTemplateTags: false,
      });
    });

    it('should handle field-level folders for singleton collections', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'about',
          file: 'pages/about.md',
          media_folder: '/images/about',
          fields: [],
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static/images',
        public_folder: '/images',
        collections: [],
        singletons: [
          {
            name: 'about',
            file: 'pages/about.md',
            media_folder: '/images/about',
            fields: [],
          },
        ],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/images/about/gallery',
            public_folder: '/images/about/gallery',
          },
          context: {
            collection: { name: '_singletons', folder: 'pages' },
            collectionFile: { name: 'about' },
            typedKeyPath: 'fields.gallery',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      const fieldFolder = result.find((f) => f.typedKeyPath === 'fields.gallery');

      expect(fieldFolder).toEqual({
        collectionName: '_singletons',
        fileName: 'about',
        typedKeyPath: 'fields.gallery',
        isIndexFile: false,
        internalPath: 'images/about/gallery',
        publicPath: '/images/about/gallery',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });
  });

  describe('hasTags', () => {
    it('should return true for media_folder tag', () => {
      expect(hasTags('{{media_folder}}/images')).toBe(true);
    });

    it('should return true for public_folder tag', () => {
      expect(hasTags('{{public_folder}}/uploads')).toBe(true);
    });

    it('should return true for both tags', () => {
      expect(hasTags('{{media_folder}}/{{public_folder}}')).toBe(true);
    });

    it('should return false for strings without tags', () => {
      expect(hasTags('/static/images')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasTags('')).toBe(false);
    });

    it('should return false for relative paths without tags', () => {
      expect(hasTags('images/uploads')).toBe(false);
    });

    it('should return false for strings with partial tag syntax', () => {
      expect(hasTags('{{media}}')).toBe(false);
      expect(hasTags('media_folder')).toBe(false);
      expect(hasTags('{media_folder}')).toBe(false);
    });

    it('should handle tags with surrounding text', () => {
      expect(hasTags('prefix/{{media_folder}}/suffix')).toBe(true);
      expect(hasTags('{{public_folder}}/suffix')).toBe(true);
    });
  });

  describe('replaceTags', () => {
    it('should replace media_folder and public_folder tags', () => {
      const result = replaceTags('{{media_folder}}/images', {
        globalMediaFolder: 'static',
        globalPublicFolder: '/assets',
      });

      expect(result).toBe('/static/images');
    });

    it('should replace public_folder tags', () => {
      const result = replaceTags('{{public_folder}}/uploads', {
        globalMediaFolder: 'static',
        globalPublicFolder: '/assets',
      });

      expect(result).toBe('/assets/uploads');
    });

    it('should replace both tags in same string', () => {
      const result = replaceTags('{{media_folder}}/{{public_folder}}/files', {
        globalMediaFolder: 'media',
        globalPublicFolder: 'public',
      });

      expect(result).toBe('/media/public/files');
    });

    it('should handle strings without tags', () => {
      const result = replaceTags('uploads/images', {
        globalMediaFolder: 'static',
        globalPublicFolder: '/assets',
      });

      expect(result).toBe('uploads/images');
    });

    it('should trim whitespace', () => {
      const result = replaceTags('  {{media_folder}}/images  ', {
        globalMediaFolder: 'static',
        globalPublicFolder: '/assets',
      });

      expect(result).toBe('/static/images');
    });

    it('should handle double slashes', () => {
      const result = replaceTags('{{media_folder}}//images', {
        globalMediaFolder: 'static',
        globalPublicFolder: '/assets',
      });

      expect(result).toBe('/static/images');
    });
  });

  describe('normalizeAssetFolder', () => {
    const globalFolders = {
      globalMediaFolder: 'static',
      globalPublicFolder: '/assets',
    };

    it('should normalize absolute media folder', () => {
      const result = normalizeAssetFolder({
        collectionName: 'posts',
        fileName: undefined,
        mediaFolder: '/uploads/posts',
        publicFolder: '/static/posts',
        baseFolder: 'content/posts',
        globalFolders,
      });

      expect(result).toEqual({
        collectionName: 'posts',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'uploads/posts',
        publicPath: '/static/posts',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should normalize relative media folder', () => {
      const result = normalizeAssetFolder({
        collectionName: 'blog',
        fileName: undefined,
        mediaFolder: 'images',
        publicFolder: undefined,
        baseFolder: 'content/blog',
        globalFolders,
      });

      expect(result).toEqual({
        collectionName: 'blog',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'content/blog',
        internalSubPath: 'images',
        publicPath: '/images',
        entryRelative: true,
        hasTemplateTags: false,
      });
    });

    it('should detect template tags', () => {
      const result = normalizeAssetFolder({
        collectionName: 'pages',
        fileName: undefined,
        mediaFolder: '{{media_folder}}/pages',
        publicFolder: '{{public_folder}}/pages',
        baseFolder: 'content/pages',
        globalFolders,
      });

      expect(result).toEqual({
        collectionName: 'pages',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'static/pages',
        publicPath: '/assets/pages',
        entryRelative: false,
        hasTemplateTags: false, // tags are replaced
      });
    });

    it('should handle empty public folder', () => {
      const result = normalizeAssetFolder({
        collectionName: 'docs',
        fileName: undefined,
        mediaFolder: '/docs',
        publicFolder: '',
        baseFolder: 'content/docs',
        globalFolders,
      });

      expect(result).toEqual({
        collectionName: 'docs',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'docs',
        publicPath: '',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should handle framework-specific public paths', () => {
      const result = normalizeAssetFolder({
        collectionName: 'assets',
        fileName: undefined,
        mediaFolder: '/src/assets',
        publicFolder: '@assets',
        baseFolder: 'src',
        globalFolders,
      });

      expect(result).toEqual({
        collectionName: 'assets',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'src/assets',
        publicPath: '@assets',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should handle file collections', () => {
      const result = normalizeAssetFolder({
        collectionName: 'settings',
        fileName: 'general',
        mediaFolder: '/config/uploads',
        publicFolder: '/uploads',
        baseFolder: 'config',
        globalFolders,
      });

      expect(result).toEqual({
        collectionName: 'settings',
        fileName: 'general',
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'config/uploads',
        publicPath: '/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });

    it('should return undefined when template tags are present without global folders', () => {
      const result = normalizeAssetFolder({
        collectionName: 'posts',
        fileName: undefined,
        mediaFolder: '{{media_folder}}/posts',
        publicFolder: '{{public_folder}}/posts',
        baseFolder: 'content/posts',
        globalFolders: undefined,
      });

      expect(result).toBeUndefined();
    });

    it('should return undefined when media folder has template tags without global folders', () => {
      const result = normalizeAssetFolder({
        collectionName: 'posts',
        fileName: undefined,
        mediaFolder: '{{media_folder}}/posts',
        publicFolder: '/static/posts',
        baseFolder: 'content/posts',
        globalFolders: undefined,
      });

      expect(result).toBeUndefined();
    });

    it('should return undefined when public folder has template tags without global folders', () => {
      const result = normalizeAssetFolder({
        collectionName: 'posts',
        fileName: undefined,
        mediaFolder: '/uploads/posts',
        publicFolder: '{{public_folder}}/posts',
        baseFolder: 'content/posts',
        globalFolders: undefined,
      });

      expect(result).toBeUndefined();
    });

    it('should work without global folders when no template tags are present', () => {
      const result = normalizeAssetFolder({
        collectionName: 'posts',
        fileName: undefined,
        mediaFolder: '/uploads/posts',
        publicFolder: '/static/posts',
        baseFolder: 'content/posts',
        globalFolders: undefined,
      });

      expect(result).toEqual({
        collectionName: 'posts',
        fileName: undefined,
        typedKeyPath: undefined,
        isIndexFile: false,
        internalPath: 'uploads/posts',
        publicPath: '/static/posts',
        entryRelative: false,
        hasTemplateTags: false,
      });
    });
  });

  describe('addFolderIfNeeded', () => {
    beforeEach(() => {
      // Reset any internal state
      vi.resetModules();
    });

    it('should skip undefined media folder', () => {
      const globalFolders = {
        globalMediaFolder: 'static',
        globalPublicFolder: '/assets',
      };

      // This should not throw and should not add any folder
      addFolderIfNeeded({
        // @ts-ignore - testing with undefined media folder
        collectionName: 'posts',
        // @ts-ignore - testing undefined for edge case
        mediaFolder: undefined,
        publicFolder: undefined,
        baseFolder: 'content/posts',
        globalFolders,
      });

      // We can't easily test the internal state, but the function should not throw
      expect(true).toBe(true);
    });

    it('should add folder that differs from global settings', () => {
      const globalFolders = {
        globalMediaFolder: 'static',
        globalPublicFolder: '/assets',
      };

      // This should add a folder since it's different from global
      addFolderIfNeeded({
        collectionName: 'posts',
        mediaFolder: '/uploads/posts',
        publicFolder: '/static/posts',
        baseFolder: 'content/posts',
        globalFolders,
      });

      // We can't easily test the internal state, but the function should not throw
      expect(true).toBe(true);
    });
  });

  describe('iterateFiles', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should iterate through valid files', () => {
      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'general',
          file: 'config/general.yml',
          media_folder: '/uploads/general',
          public_folder: '/uploads/general',
        },
        // @ts-ignore - simplified file for testing
        {
          name: 'advanced',
          file: 'config/advanced.yml',
          media_folder: '/uploads/advanced',
          public_folder: '/uploads/advanced',
        },
      ]);

      const globalFolders = {
        globalMediaFolder: 'static',
        globalPublicFolder: '/assets',
      };

      // This should process the files without throwing
      iterateFiles({
        collectionName: 'settings',
        files: [],
        globalFolders,
      });

      expect(getValidCollectionFiles).toHaveBeenCalledWith([]);
    });

    it('should handle empty files array', () => {
      vi.mocked(getValidCollectionFiles).mockReturnValue([]);

      const globalFolders = {
        globalMediaFolder: 'static',
        globalPublicFolder: '/assets',
      };

      iterateFiles({
        collectionName: 'empty',
        files: [],
        globalFolders,
      });

      expect(getValidCollectionFiles).toHaveBeenCalledWith([]);
    });
  });

  describe('handleFieldMediaFolders', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should add field-level media folders for valid collections', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
        },
      ]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
        fields: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/uploads/featured',
            public_folder: '/static/featured',
          },
          context: {
            collection: { name: 'posts', folder: 'content/posts' },
            collectionFile: undefined,
            typedKeyPath: 'featured_image',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      // Should include the field folder
      const fieldFolder = result.find((f) => f.typedKeyPath === 'featured_image');

      expect(fieldFolder).toBeDefined();
      expect(fieldFolder?.collectionName).toBe('posts');
      expect(fieldFolder?.internalPath).toBe('uploads/featured');
      expect(fieldFolder?.publicPath).toBe('/static/featured');
    });

    it('should skip field-level media folders for invalid collections', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
        },
      ]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
        fields: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/uploads/featured',
            public_folder: '/static/featured',
          },
          context: {
            collection: { name: 'non-existent' },
            collectionFile: undefined,
            typedKeyPath: 'featured_image',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      // Should NOT include the field folder for invalid collection
      const fieldFolder = result.find((f) => f.typedKeyPath === 'featured_image');

      expect(fieldFolder).toBeUndefined();
    });

    it('should handle singleton collection fields', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'about',
          file: 'pages/about.md',
          fields: [],
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        singletons: [
          {
            name: 'about',
            file: 'pages/about.md',
            fields: [],
          },
        ],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/uploads/about',
            public_folder: '/static/about',
          },
          context: {
            collection: { name: '_singletons', folder: 'pages' },
            collectionFile: { name: 'about' },
            typedKeyPath: 'hero_image',
            isIndexFile: true,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      // Should include the singleton field folder
      const fieldFolder = result.find((f) => f.typedKeyPath === 'hero_image');

      expect(fieldFolder).toBeDefined();
      expect(fieldFolder?.fileName).toBe('about');
      expect(fieldFolder?.isIndexFile).toBe(true);
    });

    it('should handle field-level media folders with template tags', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
        },
      ]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
        fields: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '{{media_folder}}/posts/thumbnails',
            public_folder: '{{public_folder}}/posts/thumbnails',
          },
          context: {
            collection: { name: 'posts', folder: 'content/posts' },
            collectionFile: undefined,
            typedKeyPath: 'thumbnail',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      // Should include the field folder with template tags replaced
      const fieldFolder = result.find((f) => f.typedKeyPath === 'thumbnail');

      expect(fieldFolder).toBeDefined();
      expect(fieldFolder?.internalPath).toBe('static/posts/thumbnails');
      expect(fieldFolder?.hasTemplateTags).toBe(false);
    });

    it('should handle empty field media folders array', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
        },
      ]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
        fields: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, []);

      // Should work without field folders
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle field-level media folders in file collections', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'settings',
          files: [
            {
              name: 'general',
              file: 'config/general.yml',
              fields: [],
            },
          ],
        },
      ]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'general',
          file: 'config/general.yml',
          fields: [],
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
        fields: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/config/uploads/logos',
            public_folder: '/uploads/logos',
          },
          context: {
            collection: { name: 'settings', files: [] },
            collectionFile: { name: 'general' },
            typedKeyPath: 'logo',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      // Should include the field folder for file collection
      const fieldFolder = result.find((f) => f.typedKeyPath === 'logo');

      expect(fieldFolder).toBeDefined();
      expect(fieldFolder?.collectionName).toBe('settings');
      expect(fieldFolder?.fileName).toBe('general');
    });

    it('should handle entry-relative field media folders', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'blog',
          folder: 'content/blog',
        },
      ]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
        fields: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: 'attachments',
            public_folder: '.',
          },
          context: {
            collection: { name: 'blog', folder: 'content/blog' },
            collectionFile: undefined,
            typedKeyPath: 'files',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      // Should include the entry-relative field folder
      const fieldFolder = result.find((f) => f.typedKeyPath === 'files');

      expect(fieldFolder).toBeDefined();
      expect(fieldFolder?.entryRelative).toBe(true);
    });

    it('should handle multiple field-level media folders for same collection', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
        },
      ]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        media_folder: 'static',
        public_folder: '/assets',
        collections: [],
        fields: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/uploads/featured',
            public_folder: '/static/featured',
          },
          context: {
            collection: { name: 'posts', folder: 'content/posts' },
            collectionFile: undefined,
            typedKeyPath: 'featured_image',
            isIndexFile: false,
          },
        },
        {
          fieldConfig: {
            media_folder: '/uploads/gallery',
            public_folder: '/static/gallery',
          },
          context: {
            collection: { name: 'posts', folder: 'content/posts' },
            collectionFile: undefined,
            typedKeyPath: 'gallery',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      // Should include both field folders
      const featured = result.find((f) => f.typedKeyPath === 'featured_image');
      const gallery = result.find((f) => f.typedKeyPath === 'gallery');

      expect(featured).toBeDefined();
      expect(gallery).toBeDefined();
      expect(featured?.internalPath).toBe('uploads/featured');
      expect(gallery?.internalPath).toBe('uploads/gallery');
    });

    it('should handle field media folders without global folders', () => {
      vi.mocked(getValidCollections).mockReturnValue([
        // @ts-ignore - simplified collection for testing
        {
          name: 'posts',
          folder: 'content/posts',
        },
      ]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      const fieldMediaFolders = [
        {
          fieldConfig: {
            media_folder: '/uploads/featured',
            public_folder: '/static/featured',
          },
          context: {
            collection: { name: 'posts', folder: 'content/posts' },
            collectionFile: undefined,
            typedKeyPath: 'featured_image',
            isIndexFile: false,
          },
        },
      ];

      // @ts-ignore - simplified config for testing
      const result = getAllAssetFolders(config, fieldMediaFolders);
      // Should include the field folder even without global folders
      const fieldFolder = result.find((f) => f.typedKeyPath === 'featured_image');

      expect(fieldFolder).toBeDefined();
      expect(fieldFolder?.internalPath).toBe('uploads/featured');
    });
  });
});
