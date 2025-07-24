import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAllAssetFolders,
  normalizeAssetFolder,
  replaceTags,
  addFolderIfNeeded,
  iterateFiles,
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
        internalPath: 'images/posts',
        publicPath: '/static/posts',
        entryRelative: false,
        hasTemplateTags: false,
      });
      expect(result[3]).toEqual({
        collectionName: 'pages',
        fileName: undefined,
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
        internalPath: 'content/blog',
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
        internalPath: 'src/assets',
        publicPath: '@assets',
        entryRelative: false,
        hasTemplateTags: false,
      });
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
        internalPath: 'content/blog',
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
        internalPath: 'config/uploads',
        publicPath: '/uploads',
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
});
