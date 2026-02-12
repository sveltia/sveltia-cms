import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  compareFilePath,
  getAllEntryFolders,
  getCollectionFileFolder,
  getEntryCollectionFolders,
  getFileCollectionFolders,
  getFilePathMap,
  getSingletonCollectionFolders,
} from './entries.js';

// Mock external dependencies
vi.mock('$lib/services/contents/collection', () => ({
  getValidCollections: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getValidCollectionFiles: vi.fn(),
  isValidCollectionFile: vi.fn(),
}));

vi.mock('$lib/services/contents/i18n', () => ({
  getLocalePath: vi.fn((args) => args.path.replace('{{locale}}', args.locale)),
}));

vi.mock('$lib/services/contents/i18n/config', () => ({
  normalizeI18nConfig: vi.fn(),
}));

const { getValidCollections } = await import('$lib/services/contents/collection');

const { getValidCollectionFiles, isValidCollectionFile } =
  await import('$lib/services/contents/collection/files');

const { normalizeI18nConfig } = await import('$lib/services/contents/i18n/config');

describe('config/folders/entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    // @ts-ignore - simplified config for testing
    vi.mocked(normalizeI18nConfig).mockReturnValue({
      allLocales: ['_default'],
      structureMap: {
        i18nMultiRootFolder: false,
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
      },
    });
    vi.mocked(isValidCollectionFile).mockReturnValue(true);
  });

  describe('getAllEntryFolders', () => {
    it('should return entry folders for entry collections', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(getValidCollections).mockImplementation((args) => {
        if (args?.type === 'entry') {
          return [
            // @ts-ignore - simplified collection for testing
            {
              name: 'posts',
              folder: 'content/posts',
            },
            // @ts-ignore - simplified collection for testing
            {
              name: 'pages',
              folder: 'content/pages',
            },
          ];
        }

        return [];
      });

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllEntryFolders(config);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        collectionName: 'pages',
        folderPath: 'content/pages',
        folderPathMap: { _default: 'content/pages' },
      });
      expect(result[1]).toEqual({
        collectionName: 'posts',
        folderPath: 'content/posts',
        folderPathMap: { _default: 'content/posts' },
      });
    });

    it('should handle i18n root multi-folder structure', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(getValidCollections).mockImplementation((args) => {
        if (args?.type === 'entry') {
          return [
            // @ts-ignore - simplified collection for testing
            {
              name: 'blog',
              folder: 'content/blog',
            },
          ];
        }

        return [];
      });

      // @ts-ignore - simplified config for testing
      vi.mocked(normalizeI18nConfig).mockReturnValue({
        allLocales: ['en', 'fr'],
        structureMap: {
          i18nMultiRootFolder: true,
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
        },
      });

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllEntryFolders(config);

      expect(result[0]).toEqual({
        collectionName: 'blog',
        folderPath: 'content/blog',
        folderPathMap: {
          en: 'en/content/blog',
          fr: 'fr/content/blog',
        },
      });
    });

    it('should return file collection folders', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(getValidCollections).mockImplementation((args) => {
        if (args?.type === 'file') {
          return [
            // @ts-ignore - simplified collection for testing
            {
              name: 'settings',
              files: [
                {
                  name: 'general',
                  file: 'config/general.yml',
                  fields: [],
                },
                {
                  name: 'advanced',
                  file: 'config/advanced.yml',
                  fields: [],
                },
              ],
            },
          ];
        }

        return [];
      });

      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'general',
          file: 'config/general.yml',
          fields: [],
        },
        // @ts-ignore - simplified file for testing
        {
          name: 'advanced',
          file: 'config/advanced.yml',
          fields: [],
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllEntryFolders(config);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        collectionName: 'settings',
        fileName: 'advanced',
        filePathMap: { _default: 'config/advanced.yml' },
      });
      expect(result[1]).toEqual({
        collectionName: 'settings',
        fileName: 'general',
        filePathMap: { _default: 'config/general.yml' },
      });
    });

    it('should handle singletons', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'about',
          file: 'pages/about.md',
          fields: [],
        },
        // @ts-ignore - simplified file for testing
        {
          name: 'contact',
          file: 'pages/contact.md',
          fields: [],
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
        singletons: [
          {
            name: 'about',
            file: 'pages/about.md',
            fields: [],
          },
          {
            name: 'contact',
            file: 'pages/contact.md',
            fields: [],
          },
        ],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllEntryFolders(config);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        collectionName: '_singletons',
        fileName: 'about',
        filePathMap: { _default: 'pages/about.md' },
      });
      expect(result[1]).toEqual({
        collectionName: '_singletons',
        fileName: 'contact',
        filePathMap: { _default: 'pages/contact.md' },
      });
    });

    it('should handle files with locale placeholders', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(getValidCollections).mockImplementation((args) => {
        if (args?.type === 'file') {
          return [
            // @ts-ignore - simplified collection for testing
            {
              name: 'i18n-pages',
              files: [
                {
                  name: 'home',
                  file: '{{locale}}/home.md',
                  fields: [],
                },
              ],
            },
          ];
        }

        return [];
      });

      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'home',
          file: '{{locale}}/home.md',
          fields: [],
        },
      ]);

      // @ts-ignore - simplified config for testing
      vi.mocked(normalizeI18nConfig).mockReturnValue({
        allLocales: ['en', 'fr'],
        // @ts-ignore - simplified structure map for testing
        structureMap: { i18nMultiRootFolder: false },
      });

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllEntryFolders(config);

      expect(result[0]).toEqual({
        collectionName: 'i18n-pages',
        fileName: 'home',
        filePathMap: {
          en: 'en/home.md',
          fr: 'fr/home.md',
        },
      });
    });

    it('should filter out invalid files', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(getValidCollections).mockImplementation((args) => {
        if (args?.type === 'file') {
          return [
            // @ts-ignore - simplified collection for testing
            {
              name: 'mixed',
              files: [
                {
                  name: 'valid',
                  file: 'valid.md',
                  fields: [],
                },
                {
                  name: 'invalid',
                  file: 'invalid.md',
                  fields: [],
                },
              ],
            },
          ];
        }

        return [];
      });

      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        {
          name: 'valid',
          file: 'valid.md',
          fields: [],
        },
        // @ts-ignore - simplified file for testing
        {
          name: 'invalid',
          file: 'invalid.md',
          fields: [],
        },
      ]);

      vi.mocked(isValidCollectionFile).mockImplementation((file) => file.name === 'valid');

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllEntryFolders(config);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid');
    });

    it('should return empty array when no collections exist', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);
      vi.mocked(getValidCollectionFiles).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllEntryFolders(config);

      expect(result).toHaveLength(0);
    });

    it('should combine all folder types in correct order', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(getValidCollections).mockImplementation((args) => {
        if (args?.type === 'entry') {
          return [
            // @ts-ignore - simplified collection for testing
            {
              name: 'posts',
              folder: 'content/posts',
            },
          ];
        }

        if (args?.type === 'file') {
          return [
            // @ts-ignore - simplified collection for testing
            {
              name: 'config',
              files: [
                {
                  name: 'site',
                  file: 'config/site.yml',
                  fields: [],
                },
              ],
            },
          ];
        }

        return [];
      });

      // Mock different responses for different calls
      vi.mocked(getValidCollectionFiles)
        .mockReturnValueOnce([
          // First call - for file collection
          // @ts-ignore - simplified file for testing
          {
            name: 'site',
            file: 'config/site.yml',
            fields: [],
          },
        ])
        .mockReturnValueOnce([
          // Second call - for singletons
          // @ts-ignore - simplified file for testing
          {
            name: 'about',
            file: 'pages/about.md',
            fields: [],
          },
        ]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
        singletons: [
          {
            name: 'about',
            file: 'pages/about.md',
            fields: [],
          },
        ],
      };

      // @ts-ignore - simplified config for testing
      const result = getAllEntryFolders(config);

      expect(result).toHaveLength(3);
      expect(result[0].collectionName).toBe('posts'); // entry collection
      expect(result[1].collectionName).toBe('config'); // file collection
      expect(result[2].collectionName).toBe('_singletons'); // singleton
    });
  });

  describe('getFilePathMap', () => {
    it('should return default path for files without locale placeholder', () => {
      const collection = { name: 'settings' };
      const file = { name: 'general', file: 'config/general.yml' };
      // @ts-ignore - simplified inputs for testing
      const result = getFilePathMap({ collection, file });

      expect(result).toEqual({
        _default: 'config/general.yml',
      });
    });

    it('should return locale-specific paths for files with locale placeholder', () => {
      const collection = { name: 'i18n-pages' };
      const file = { name: 'home', file: '{{locale}}/home.md' };

      // @ts-ignore - simplified inputs for testing
      vi.mocked(normalizeI18nConfig).mockReturnValue({
        allLocales: ['en', 'fr', 'es'],
        structureMap: {
          i18nMultiRootFolder: false,
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
        },
      });

      // @ts-ignore - simplified inputs for testing
      const result = getFilePathMap({ collection, file });

      expect(result).toEqual({
        en: 'en/home.md',
        fr: 'fr/home.md',
        es: 'es/home.md',
      });
    });

    it('should handle nested paths with locale placeholder', () => {
      const collection = { name: 'content' };
      const file = { name: 'about', file: 'pages/{{locale}}/about.md' };

      // @ts-ignore - simplified inputs for testing
      vi.mocked(normalizeI18nConfig).mockReturnValue({
        allLocales: ['en', 'de'],
        structureMap: {
          i18nMultiRootFolder: false,
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
        },
      });

      // @ts-ignore - simplified inputs for testing
      const result = getFilePathMap({ collection, file });

      expect(result).toEqual({
        en: 'pages/en/about.md',
        de: 'pages/de/about.md',
      });
    });
  });

  describe('getCollectionFileFolder', () => {
    beforeEach(() => {
      vi.mocked(isValidCollectionFile).mockReturnValue(true);
      // @ts-ignore - simplified mock for testing
      vi.mocked(normalizeI18nConfig).mockReturnValue({
        allLocales: ['_default'],
        structureMap: {
          i18nMultiRootFolder: false,
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
        },
      });
    });

    it('should return folder info for valid file', () => {
      const collection = { name: 'settings' };
      const file = { name: 'general', file: 'config/general.yml' };
      // @ts-ignore - simplified inputs for testing
      const result = getCollectionFileFolder(collection, file);

      expect(result).toEqual({
        collectionName: 'settings',
        fileName: 'general',
        filePathMap: { _default: 'config/general.yml' },
      });
    });

    it('should return undefined for invalid file', () => {
      vi.mocked(isValidCollectionFile).mockReturnValue(false);

      const collection = { name: 'settings' };
      const file = { name: 'invalid', file: 'invalid.yml' };
      // @ts-ignore - simplified inputs for testing
      const result = getCollectionFileFolder(collection, file);

      expect(result).toBeUndefined();
    });

    it('should handle files with locale placeholders', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(normalizeI18nConfig).mockReturnValue({
        allLocales: ['en', 'fr'],
        structureMap: {
          i18nMultiRootFolder: false,
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
        },
      });

      const collection = { name: 'i18n' };
      const file = { name: 'home', file: '{{locale}}/home.md' };
      // @ts-ignore - simplified inputs for testing
      const result = getCollectionFileFolder(collection, file);

      expect(result).toEqual({
        collectionName: 'i18n',
        fileName: 'home',
        filePathMap: {
          en: 'en/home.md',
          fr: 'fr/home.md',
        },
      });
    });
  });

  describe('compareFilePath', () => {
    it('should compare file paths correctly', () => {
      const folderA = {
        collectionName: 'a',
        fileName: 'first',
        filePathMap: { _default: 'a/first.md' },
      };

      const folderB = {
        collectionName: 'b',
        fileName: 'second',
        filePathMap: { _default: 'b/second.md' },
      };

      // @ts-ignore - simplified inputs for testing
      const result = compareFilePath(folderA, folderB);

      expect(result).toBeLessThan(0); // 'a/first.md' < 'b/second.md'
    });

    it('should handle equal paths', () => {
      const folderA = {
        collectionName: 'same',
        fileName: 'file',
        filePathMap: { _default: 'same/file.md' },
      };

      const folderB = {
        collectionName: 'same',
        fileName: 'file',
        filePathMap: { _default: 'same/file.md' },
      };

      // @ts-ignore - simplified inputs for testing
      const result = compareFilePath(folderA, folderB);

      expect(result).toBe(0);
    });

    it('should handle empty filePathMap', () => {
      const folderA = {
        collectionName: 'a',
        fileName: 'empty',
        filePathMap: {},
      };

      const folderB = {
        collectionName: 'b',
        fileName: 'file',
        filePathMap: { _default: 'b/file.md' },
      };

      // @ts-ignore - simplified inputs for testing
      const result = compareFilePath(folderA, folderB);

      expect(typeof result).toBe('number');
    });
  });

  describe('getEntryCollectionFolders', () => {
    beforeEach(() => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(normalizeI18nConfig).mockReturnValue({
        allLocales: ['_default'],
        // @ts-ignore - simplified structure map for testing
        structureMap: { i18nMultiRootFolder: false },
      });
    });

    it('should return sorted entry collection folders', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(getValidCollections).mockReturnValue([
        { name: 'posts', folder: 'content/posts', fields: [] },
        { name: 'pages', folder: 'content/pages', fields: [] },
        { name: 'blog', folder: 'blog', fields: [] },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getEntryCollectionFolders(config);

      expect(result).toHaveLength(3);
      expect(result[0].collectionName).toBe('blog'); // 'blog' comes before 'content/pages'
      expect(result[1].collectionName).toBe('pages');
      expect(result[2].collectionName).toBe('posts');

      // Verify getValidCollections is called without 'visible' parameter
      expect(getValidCollections).toHaveBeenCalledWith({ collections: [], type: 'entry' });
    });

    it('should handle i18n multi-folder structure', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(getValidCollections).mockReturnValue([{ name: 'content', folder: 'content' }]);

      // @ts-ignore - simplified mock for testing
      vi.mocked(normalizeI18nConfig).mockReturnValue({
        allLocales: ['en', 'fr'],
        // @ts-ignore - simplified structure map for testing
        structureMap: { i18nMultiRootFolder: true },
      });

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getEntryCollectionFolders(config);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        collectionName: 'content',
        folderPath: 'content',
        folderPathMap: {
          en: 'en/content',
          fr: 'fr/content',
        },
      });

      // Verify getValidCollections is called without 'visible' parameter
      expect(getValidCollections).toHaveBeenCalledWith({ collections: [], type: 'entry' });
    });

    it('should return empty array when no entry collections', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getEntryCollectionFolders(config);

      expect(result).toHaveLength(0);

      // Verify getValidCollections is called without 'visible' parameter
      expect(getValidCollections).toHaveBeenCalledWith({ collections: [], type: 'entry' });
    });
  });

  describe('getFileCollectionFolders', () => {
    beforeEach(() => {
      vi.mocked(isValidCollectionFile).mockReturnValue(true);
      // @ts-ignore - simplified mock for testing
      vi.mocked(normalizeI18nConfig).mockReturnValue({
        allLocales: ['_default'],
        // @ts-ignore - simplified structure map for testing
        structureMap: { i18nMultiRootFolder: false },
      });
    });

    it('should return file collection folders', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(getValidCollections).mockReturnValue([
        {
          name: 'settings',
          files: [
            { name: 'general', file: 'config/general.yml', fields: [] },
            { name: 'advanced', file: 'config/advanced.yml', fields: [] },
          ],
        },
      ]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getFileCollectionFolders(config);

      expect(result).toHaveLength(2);
      expect(result[0].fileName).toBe('advanced'); // sorted by file path
      expect(result[1].fileName).toBe('general');

      // Verify getValidCollections is called without 'visible' parameter
      expect(getValidCollections).toHaveBeenCalledWith({ collections: [], type: 'file' });
    });

    it('should filter out invalid files', () => {
      // @ts-ignore - simplified mock for testing
      vi.mocked(getValidCollections).mockReturnValue([
        {
          name: 'mixed',
          files: [
            { name: 'valid', file: 'valid.yml', fields: [] },
            { name: 'invalid', file: 'invalid.yml', fields: [] },
          ],
        },
      ]);

      vi.mocked(isValidCollectionFile).mockImplementation((file) => file.name === 'valid');

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getFileCollectionFolders(config);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid');

      // Verify getValidCollections is called without 'visible' parameter
      expect(getValidCollections).toHaveBeenCalledWith({ collections: [], type: 'file' });
    });

    it('should return empty array when no file collections', () => {
      vi.mocked(getValidCollections).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        collections: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getFileCollectionFolders(config);

      expect(result).toHaveLength(0);

      // Verify getValidCollections is called without 'visible' parameter
      expect(getValidCollections).toHaveBeenCalledWith({ collections: [], type: 'file' });
    });
  });

  describe('getSingletonCollectionFolders', () => {
    beforeEach(() => {
      vi.mocked(isValidCollectionFile).mockReturnValue(true);
      // @ts-ignore - simplified mock for testing
      vi.mocked(normalizeI18nConfig).mockReturnValue({
        allLocales: ['_default'],
        // @ts-ignore - simplified structure map for testing
        structureMap: { i18nMultiRootFolder: false },
      });
    });

    it('should return singleton collection folders', () => {
      const singletons = [
        { name: 'about', file: 'pages/about.md', fields: [] },
        { name: 'contact', file: 'pages/contact.md', fields: [] },
      ];

      // Mock getValidCollectionFiles to return one of the files (simulating filtering)
      // @ts-ignore - simplified for testing
      vi.mocked(getValidCollectionFiles).mockReturnValue([singletons[0]]);

      const config = {
        backend: { name: 'git-gateway' },
        singletons,
      };

      // @ts-ignore - simplified config for testing
      const result = getSingletonCollectionFolders(config);

      expect(result).toHaveLength(1);
      expect(result[0].collectionName).toBe('_singletons');
      expect(result[0].fileName).toBe('about');
    });

    it('should return empty array when no singletons', () => {
      vi.mocked(getValidCollectionFiles).mockReturnValue([]);

      const config = {
        backend: { name: 'git-gateway' },
        singletons: [],
      };

      // @ts-ignore - simplified config for testing
      const result = getSingletonCollectionFolders(config);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when singletons is not array', () => {
      const config = {
        backend: { name: 'git-gateway' },
        singletons: undefined,
      };

      // @ts-ignore - simplified config for testing
      const result = getSingletonCollectionFolders(config);

      expect(result).toHaveLength(0);
    });

    it('should filter out invalid files', () => {
      vi.mocked(getValidCollectionFiles).mockReturnValue([
        // @ts-ignore - simplified file for testing
        { name: 'valid', file: 'valid.md' },
        // @ts-ignore - simplified file for testing
        { name: 'invalid', file: 'invalid.md' },
      ]);

      vi.mocked(isValidCollectionFile).mockImplementation((file) => file.name === 'valid');

      const config = {
        backend: { name: 'git-gateway' },
        singletons: [
          { name: 'valid', file: 'valid.md' },
          { name: 'invalid', file: 'invalid.md' },
        ],
      };

      // @ts-ignore - simplified config for testing
      const result = getSingletonCollectionFolders(config);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid');
    });
  });
});
