// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/services/common/template', () => ({
  fillTemplate: vi.fn((template) => template),
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  getIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/i18n', () => ({
  getLocalePath: vi.fn(),
}));

vi.mock('$lib/services/contents/collection', () => ({
  isEntryCollection: vi.fn(
    (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
  ),
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/workflow', () => ({
  mergeUnpublishedEntries: vi.fn((entries) => entries),
  unpublishedEntries: { subscribe: vi.fn() },
}));

vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return { ...actual, get: vi.fn(() => []) };
});

describe('contents/draft/save/entry-path', () => {
  let mockFillTemplate;
  let mockGetIndexFile;
  let mockGetLocalePath;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { fillTemplate } = await import('$lib/services/common/template');
    const { getIndexFile } = await import('$lib/services/contents/collection/entries/index-file');
    const { getLocalePath } = await import('$lib/services/contents/i18n');

    mockFillTemplate = fillTemplate;
    mockGetIndexFile = getIndexFile;
    mockGetLocalePath = getLocalePath;

    mockFillTemplate.mockImplementation((template) => template);
    mockGetIndexFile.mockReturnValue(undefined);
    mockGetLocalePath.mockImplementation(({ path }) => path);
  });

  describe('buildPathByStructure', () => {
    it('should handle multiple_folders structure with omitLocale=false', async () => {
      const { buildPathByStructure } = await import('./entry-path.js');

      const result = buildPathByStructure({
        basePath: 'content',
        path: 'products',
        extension: 'md',
        locale: 'fr',
        omitLocale: false,
        structure: 'multiple_folders',
      });

      expect(result).toBe('content/fr/products.md');
    });

    it('should handle multiple_folders structure with omitLocale=true', async () => {
      const { buildPathByStructure } = await import('./entry-path.js');

      const result = buildPathByStructure({
        basePath: 'content',
        path: 'products',
        extension: 'md',
        locale: 'en',
        omitLocale: true,
        structure: 'multiple_folders',
      });

      expect(result).toBe('content/products.md');
    });

    it('should handle multiple_folders_i18n_root structure (deprecated) with omitLocale=false', async () => {
      const { buildPathByStructure } = await import('./entry-path.js');

      const result = buildPathByStructure({
        basePath: 'content',
        path: 'settings',
        extension: 'yaml',
        locale: 'fr',
        omitLocale: false,
        structure: 'multiple_folders_i18n_root',
      });

      expect(result).toBe('fr/content/settings.yaml');
    });

    it('should handle multiple_folders_i18n_root structure (deprecated) with omitLocale=true', async () => {
      const { buildPathByStructure } = await import('./entry-path.js');

      const result = buildPathByStructure({
        basePath: 'content',
        path: 'settings',
        extension: 'yaml',
        locale: 'en',
        omitLocale: true,
        structure: 'multiple_folders_i18n_root',
      });

      expect(result).toBe('content/settings.yaml');
    });

    it('should handle multiple_root_folders structure with omitLocale=false', async () => {
      const { buildPathByStructure } = await import('./entry-path.js');

      const result = buildPathByStructure({
        basePath: 'content',
        path: 'settings',
        extension: 'yaml',
        locale: 'fr',
        omitLocale: false,
        structure: 'multiple_root_folders',
      });

      expect(result).toBe('fr/content/settings.yaml');
    });

    it('should handle multiple_root_folders structure with omitLocale=true', async () => {
      const { buildPathByStructure } = await import('./entry-path.js');

      const result = buildPathByStructure({
        basePath: 'content',
        path: 'settings',
        extension: 'yaml',
        locale: 'en',
        omitLocale: true,
        structure: 'multiple_root_folders',
      });

      expect(result).toBe('content/settings.yaml');
    });

    it('should handle multiple_files structure with omitLocale=false', async () => {
      const { buildPathByStructure } = await import('./entry-path.js');

      const result = buildPathByStructure({
        basePath: 'posts',
        path: 'hello',
        extension: 'md',
        locale: 'fr',
        omitLocale: false,
        structure: 'multiple_files',
      });

      expect(result).toBe('posts/hello.fr.md');
    });

    it('should handle multiple_files structure with omitLocale=true', async () => {
      const { buildPathByStructure } = await import('./entry-path.js');

      const result = buildPathByStructure({
        basePath: 'posts',
        path: 'hello',
        extension: 'md',
        locale: 'en',
        omitLocale: true,
        structure: 'multiple_files',
      });

      expect(result).toBe('posts/hello.md');
    });

    it('should handle default structure (single_file)', async () => {
      const { buildPathByStructure } = await import('./entry-path.js');

      const result = buildPathByStructure({
        basePath: 'content',
        path: 'about',
        extension: 'md',
        locale: 'en',
        omitLocale: false,
        structure: 'single_file',
      });

      expect(result).toBe('content/about.md');
    });

    it('should handle empty basePath', async () => {
      const { buildPathByStructure } = await import('./entry-path.js');

      const result = buildPathByStructure({
        basePath: '',
        path: 'settings',
        extension: 'yaml',
        locale: 'en',
        omitLocale: true,
        structure: 'multiple_folders',
      });

      expect(result).toBe('/settings.yaml');
    });
  });

  describe('createEntryPath', () => {
    it('should create path for file collection', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _i18n: {
            defaultLocale: 'en',
            structure: 'single_file',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
        },
        collectionFile: {
          file: 'about.md',
          _i18n: {
            defaultLocale: 'en',
            structure: 'single_file',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
        },
        originalEntry: undefined,
        currentValues: {},
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'about' });

      expect(mockGetLocalePath).toHaveBeenCalledWith({
        _i18n: draft.collectionFile._i18n,
        locale: 'en',
        path: 'about.md',
      });
      expect(result).toBeDefined();
    });

    it('should return existing path when slug matches original entry', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _i18n: {
            defaultLocale: 'en',
            structure: 'single_file',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
        },
        collectionFile: undefined,
        originalEntry: {
          locales: {
            en: { slug: 'test-post', path: 'posts/test-post.md' },
          },
        },
        currentValues: {},
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'test-post' });

      expect(result).toBe('posts/test-post.md');
    });

    it('should create path for single_file structure', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'single_file',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: 'posts',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('posts/my-post.md');
    });

    it('should create path for multiple_folders structure', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'multiple_folders',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: 'posts',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('posts/en/my-post.md');
    });

    it('should create path for multiple_folders_i18n_root structure', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'multiple_folders_i18n_root',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: 'posts',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('en/posts/my-post.md');
    });

    it('should create path for multiple_root_folders structure', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'multiple_root_folders',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: 'posts',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('en/posts/my-post.md');
    });

    it('should create path for multiple_files structure', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'multiple_files',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: 'posts',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('posts/my-post.en.md');
    });

    it('should omit default locale from filename when configured', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'multiple_files',
            omitDefaultLocaleFromFilePath: true,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: 'posts',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('posts/my-post.md');

      const resultJa = createEntryPath({ draft, locale: 'ja', slug: 'my-post' });

      expect(resultJa).toBe('posts/my-post.ja.md');
    });

    it('should handle entry collections path with subPath', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      mockFillTemplate.mockImplementation((template) => {
        if (template === '{{year}}/{{slug}}') {
          return '2024/my-post';
        }

        return template;
      });

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'single_file',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: 'posts',
            subPath: '{{year}}/{{slug}}',
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: { year: '2024' } },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(mockFillTemplate).toHaveBeenCalledWith(
        '{{year}}/{{slug}}',
        expect.objectContaining({
          collection: draft.collection,
          locale: 'en',
          currentSlug: 'my-post',
        }),
      );
      expect(result).toBe('posts/2024/my-post.md');
    });

    it('should handle index file', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      mockGetIndexFile.mockReturnValue({ name: 'index.md' });

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'single_file',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: 'posts',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: true,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(mockGetIndexFile).toHaveBeenCalledWith(draft.collection);
      expect(result).toBe('posts/index.md');
    });

    it('should use fallback to single_file structure if unknown', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'unknown_structure',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: 'posts',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('posts/my-post.md');
    });

    it('should strip leading slash when basePath is empty for single_file structure', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'single_file',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: '',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('my-post.md');
    });

    it('should strip leading slash when basePath is empty for multiple_folders structure', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'multiple_folders',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: '',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('en/my-post.md');
    });

    it('should strip leading slash when basePath is empty for multiple_files structure', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'multiple_files',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: '',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('my-post.en.md');
    });

    it('should strip leading slash when basePath is empty for multiple_folders_i18n_root structure', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'multiple_folders_i18n_root',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: '',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('en/my-post.md');
    });

    it('should strip leading slash when basePath is empty for multiple_root_folders structure', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            defaultLocale: 'en',
            structure: 'multiple_root_folders',
            omitDefaultLocaleFromFilePath: false,
            omitDefaultLocaleFromPreviewPath: false,
          },
          _file: {
            basePath: '',
            subPath: undefined,
            extension: 'md',
          },
        },
        collectionFile: undefined,
        originalEntry: undefined,
        currentValues: { en: {} },
        isIndexFile: false,
      };

      const result = createEntryPath({ draft, locale: 'en', slug: 'my-post' });

      expect(result).toBe('en/my-post.md');
    });
  });
  describe('buildCustomEntryPath', () => {
    /** Collection whose slugs aren’t localized. */
    const collection = { _type: 'entry', _i18n: { defaultLocale: 'en', structureMap: {} } };

    it('should use the configured index file name', async () => {
      const { buildCustomEntryPath } = await import('./entry-path.js');

      const result = buildCustomEntryPath({
        draft: { collection, originalEntry: undefined, currentPath: '/docs/guides/' },
        slug: 'my-post',
        indexFileName: '_index',
        locale: 'en',
      });

      expect(result).toBe('docs/guides/_index');
    });

    it('should keep the file name of an existing entry', async () => {
      const { buildCustomEntryPath } = await import('./entry-path.js');

      const result = buildCustomEntryPath({
        draft: {
          collection,
          originalEntry: { subPath: 'docs/my-post', locales: {} },
          currentPath: 'guides',
        },
        slug: 'renamed',
        indexFileName: undefined,
        locale: 'en',
      });

      expect(result).toBe('guides/my-post');
    });

    it('should use the slug for a new entry', async () => {
      const { buildCustomEntryPath } = await import('./entry-path.js');

      const result = buildCustomEntryPath({
        draft: { collection, originalEntry: undefined, currentPath: 'guides' },
        slug: 'my-post',
        indexFileName: undefined,
        locale: 'en',
      });

      expect(result).toBe('guides/my-post');
    });

    it('should place the entry in the collection folder when the path is empty', async () => {
      const { buildCustomEntryPath } = await import('./entry-path.js');

      const result = buildCustomEntryPath({
        draft: { collection, originalEntry: undefined, currentPath: undefined },
        slug: 'my-post',
        indexFileName: undefined,
        locale: 'en',
      });

      expect(result).toBe('my-post');
    });
  });

  describe('createEntryPath with the path editor', () => {
    /**
     * Create an entry collection with the `meta.path` option enabled.
     * @returns {any} Collection.
     */
    const createCollection = () => ({
      _type: 'entry',
      name: 'pages',
      folder: 'content/pages',
      nested: {},
      meta: { path: { widget: 'string', index_file: '_index' } },
      _i18n: {
        defaultLocale: 'en',
        structure: 'single_file',
        structureMap: { i18nSingleFile: true },
        omitDefaultLocaleFromFilePath: false,
        omitDefaultLocaleFromPreviewPath: false,
      },
      _file: { basePath: 'content/pages', subPath: undefined, extension: 'md' },
    });

    it('should give a new entry a folder of its own within the chosen folder', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: createCollection(),
        collectionFile: undefined,
        isNew: true,
        originalEntry: undefined,
        currentValues: { en: {} },
        originalPath: 'docs/guides',
        currentPath: 'docs/guides',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'my-post' })).toBe(
        'content/pages/docs/guides/my-post/_index.md',
      );
    });

    it('should give a new entry a folder of its own at the collection root', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: createCollection(),
        collectionFile: undefined,
        isNew: true,
        originalEntry: undefined,
        currentValues: { en: {} },
        originalPath: '',
        currentPath: '',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'my-post' })).toBe(
        'content/pages/my-post/_index.md',
      );
    });

    it('should keep an existing entry’s folder as the one the editor points at', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: createCollection(),
        collectionFile: undefined,
        isNew: false,
        originalEntry: {
          subPath: 'docs/_index',
          locales: { en: { slug: 'docs/_index', path: 'content/pages/docs/_index.md' } },
        },
        currentValues: { en: {} },
        originalPath: 'docs',
        currentPath: 'docs/guides',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'docs/_index' })).toBe(
        'content/pages/docs/guides/_index.md',
      );
    });

    it('should keep each entry’s own file name without the subfolders mode', async () => {
      // @see https://github.com/decaporg/decap-cms/issues/7606
      const { createEntryPath } = await import('./entry-path.js');
      const collection = createCollection();

      collection.nested = { subfolders: false };

      const draft = {
        collection,
        collectionFile: undefined,
        isNew: true,
        originalEntry: undefined,
        currentValues: { en: {} },
        currentPath: 'docs/guides',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'my-post' })).toBe(
        'content/pages/docs/guides/my-post.md',
      );
    });

    it('should fall back to the collection path template when the folder is blank', async () => {
      // @see https://github.com/decaporg/decap-cms/issues/7094
      const { createEntryPath } = await import('./entry-path.js');
      const { fillTemplate } = await import('$lib/services/common/template');

      vi.mocked(fillTemplate).mockReturnValue('my-post/_index');

      const collection = createCollection();

      // Without a shared file name, a blank folder hands the path back to the collection options
      collection.meta = { path: { widget: 'string' } };
      collection._file.subPath = '{{slug}}/_index';

      const draft = {
        collection,
        collectionFile: undefined,
        isNew: true,
        originalEntry: undefined,
        currentValues: { en: {} },
        originalPath: '',
        currentPath: '',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'my-post' })).toBe(
        'content/pages/my-post/_index.md',
      );
    });

    it('should fall back to the slug when the folder is blank and no path is configured', async () => {
      const { createEntryPath } = await import('./entry-path.js');
      const collection = createCollection();

      collection.meta = { path: { widget: 'string' } };

      const draft = {
        collection,
        collectionFile: undefined,
        isNew: true,
        originalEntry: undefined,
        currentValues: { en: {} },
        originalPath: '',
        currentPath: '',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'my-post' })).toBe(
        'content/pages/my-post.md',
      );
    });

    it('should move an entry up to the collection folder when the folder is cleared', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: createCollection(),
        collectionFile: undefined,
        isNew: false,
        originalEntry: {
          subPath: 'docs/_index',
          locales: { en: { slug: 'docs/_index', path: 'content/pages/docs/_index.md' } },
        },
        currentValues: { en: {} },
        originalPath: 'docs',
        currentPath: '',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'docs/_index' })).toBe(
        'content/pages/_index.md',
      );
    });

    it('should move an existing entry even though the slug is unchanged', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: createCollection(),
        collectionFile: undefined,
        isNew: false,
        originalEntry: {
          subPath: 'docs/_index',
          locales: { en: { slug: 'docs/_index', path: 'content/pages/docs/_index.md' } },
        },
        currentValues: { en: {} },
        currentPath: 'guides',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'docs/_index' })).toBe(
        'content/pages/guides/_index.md',
      );
    });
  });

  describe('keepsOriginalPath', () => {
    const collection = {
      _type: 'entry',
      name: 'pages',
      folder: 'content/pages',
      nested: {},
      meta: { path: { index_file: '_index' } },
      _i18n: { defaultLocale: 'en', structureMap: {} },
    };

    const originalEntry = {
      subPath: 'docs/_index',
      locales: { en: { slug: 'docs/_index', path: 'content/pages/docs/_index.md' } },
    };

    it('should be false for a new entry', async () => {
      const { keepsOriginalPath } = await import('./entry-path.js');

      expect(
        keepsOriginalPath({
          draft: { collection, isNew: true, originalEntry: undefined, currentPath: 'docs' },
          locale: 'en',
          slug: 'docs/_index',
        }),
      ).toBe(false);
    });

    it('should be false when the slug has changed', async () => {
      const { keepsOriginalPath } = await import('./entry-path.js');

      expect(
        keepsOriginalPath({
          draft: { collection, originalEntry, originalPath: 'docs', currentPath: 'docs' },
          locale: 'en',
          slug: 'guides/_index',
        }),
      ).toBe(false);
    });

    it('should be false when the folder has changed', async () => {
      const { keepsOriginalPath } = await import('./entry-path.js');

      expect(
        keepsOriginalPath({
          draft: { collection, originalEntry, originalPath: 'docs', currentPath: 'guides' },
          locale: 'en',
          slug: 'docs/_index',
        }),
      ).toBe(false);
    });

    it('should be true when neither the slug nor the folder has changed', async () => {
      const { keepsOriginalPath } = await import('./entry-path.js');

      expect(
        keepsOriginalPath({
          draft: { collection, originalEntry, originalPath: 'docs', currentPath: '/docs/' },
          locale: 'en',
          slug: 'docs/_index',
        }),
      ).toBe(true);
    });

    it('should be false when a folder is chosen where none was recorded', async () => {
      const { keepsOriginalPath } = await import('./entry-path.js');

      expect(
        keepsOriginalPath({
          draft: { collection, originalEntry, originalPath: undefined, currentPath: 'docs' },
          locale: 'en',
          slug: 'docs/_index',
        }),
      ).toBe(false);
    });

    it('should be true for an unchanged slug without the path editor', async () => {
      const { keepsOriginalPath } = await import('./entry-path.js');

      expect(
        keepsOriginalPath({
          draft: { collection, originalEntry, originalPath: undefined, currentPath: undefined },
          locale: 'en',
          slug: 'docs/_index',
        }),
      ).toBe(true);
    });
  });

  describe('createEntryPath with localized folders', () => {
    // @see https://github.com/sveltia/sveltia-cms/issues/962

    /**
     * Create a nested collection with localized slugs and the path editor enabled.
     * @param {object} [overrides] Property overrides.
     * @returns {any} Collection.
     */
    const createCollection = (overrides = {}) => ({
      _type: 'entry',
      name: 'pages',
      folder: 'content/pages',
      slug: '{{title | localize}}',
      nested: {},
      meta: { path: { index_file: '_index' } },
      _i18n: {
        defaultLocale: 'en',
        structure: 'multiple_folders',
        structureMap: {},
        omitDefaultLocaleFromFilePath: false,
        omitDefaultLocaleFromPreviewPath: false,
      },
      _file: { basePath: 'content/pages', subPath: undefined, extension: 'md' },
      ...overrides,
    });

    /**
     * Create an entry stored at the given sub path in each locale.
     * @param {string} id Entry ID.
     * @param {Record<string, string>} subPaths Sub path per locale.
     * @returns {any} Entry.
     */
    const entry = (id, subPaths) => ({
      id,
      slug: subPaths.en,
      subPath: subPaths.en,
      locales: Object.fromEntries(
        Object.entries(subPaths).map(([locale, subPath]) => [
          locale,
          { slug: subPath, path: `content/pages/${locale}/${subPath}.md`, content: {} },
        ]),
      ),
    });

    beforeEach(async () => {
      const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

      getEntriesByCollection.mockReturnValue([
        entry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        entry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' }),
      ]);
    });

    it('should file a new entry below the localized folder chain', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: createCollection(),
        isNew: true,
        currentValues: { en: {}, fr: {} },
        originalPath: 'about/team',
        currentPath: 'about/team',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'history' })).toBe(
        'content/pages/en/about/team/history/_index.md',
      );
      expect(createEntryPath({ draft, locale: 'fr', slug: 'histoire' })).toBe(
        'content/pages/fr/a-propos/equipe/histoire/_index.md',
      );
    });

    it('should leave an untouched entry where it is in every locale', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: createCollection(),
        isNew: false,
        originalEntry: entry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' }),
        currentValues: { en: {}, fr: {} },
        originalPath: 'about/team',
        currentPath: 'about/team',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'about/team/_index' })).toBe(
        'content/pages/en/about/team/_index.md',
      );
      expect(createEntryPath({ draft, locale: 'fr', slug: 'a-propos/equipe/_index' })).toBe(
        'content/pages/fr/a-propos/equipe/_index.md',
      );
    });

    it('should move an existing entry along with its localized folder', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: createCollection(),
        isNew: false,
        originalEntry: entry('3', { en: 'products/team/_index', fr: 'produits/equipe/_index' }),
        currentValues: { en: {}, fr: {} },
        originalPath: 'products/team',
        currentPath: 'about/team',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'products/team/_index' })).toBe(
        'content/pages/en/about/team/_index.md',
      );
      expect(createEntryPath({ draft, locale: 'fr', slug: 'produits/equipe/_index' })).toBe(
        'content/pages/fr/a-propos/equipe/_index.md',
      );
    });

    it('should rename the folder in one locale only', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: createCollection(),
        isNew: false,
        originalEntry: entry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' }),
        currentValues: { en: {}, fr: {} },
        originalPath: 'about/team',
        currentPath: 'about/team',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'about/team/_index' })).toBe(
        'content/pages/en/about/team/_index.md',
      );
      expect(createEntryPath({ draft, locale: 'fr', slug: 'a-propos/notre-equipe/_index' })).toBe(
        'content/pages/fr/a-propos/notre-equipe/_index.md',
      );
    });

    it('should name the folder after a bare slug for a locale that has just been enabled', async () => {
      const { createEntryPath } = await import('./entry-path.js');

      const draft = {
        collection: createCollection(),
        isNew: false,
        originalEntry: entry('2', { en: 'about/team/_index' }),
        currentValues: { en: {}, fr: {} },
        originalPath: 'about/team',
        currentPath: 'about/team',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'fr', slug: 'equipe' })).toBe(
        'content/pages/fr/a-propos/equipe/_index.md',
      );
    });

    it('should keep the localized file name without the subfolders mode', async () => {
      const { createEntryPath } = await import('./entry-path.js');
      const collection = createCollection({ nested: { subfolders: false } });

      const draft = {
        collection,
        isNew: false,
        originalEntry: entry('4', { en: 'about/history', fr: 'a-propos/histoire' }),
        currentValues: { en: {}, fr: {} },
        originalPath: 'about',
        currentPath: 'about/team',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'en', slug: 'about/history' })).toBe(
        'content/pages/en/about/team/history.md',
      );
      expect(createEntryPath({ draft, locale: 'fr', slug: 'a-propos/histoire' })).toBe(
        'content/pages/fr/a-propos/equipe/histoire.md',
      );
    });

    it('should use the localized slug for a new locale without the subfolders mode', async () => {
      const { createEntryPath } = await import('./entry-path.js');
      const collection = createCollection({ nested: { subfolders: false } });

      const draft = {
        collection,
        isNew: false,
        originalEntry: entry('4', { en: 'about/history' }),
        currentValues: { en: {}, fr: {} },
        originalPath: 'about',
        currentPath: 'about/team',
        isIndexFile: false,
      };

      expect(createEntryPath({ draft, locale: 'fr', slug: 'histoire' })).toBe(
        'content/pages/fr/a-propos/equipe/histoire.md',
      );
    });
  });
});
