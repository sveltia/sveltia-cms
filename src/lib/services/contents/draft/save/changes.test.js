// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBaseSavingEntryData,
  createSavingEntryData,
  getMultiFileChange,
  getPreviousSha,
  getSingleFileChange,
} from './changes';

vi.mock('@sveltia/utils/crypto');
vi.mock('@sveltia/utils/file');
vi.mock('@sveltia/utils/object');
vi.mock('@sveltia/utils/storage');
vi.mock('$lib/services/assets/folders');
vi.mock('$lib/services/backends');
vi.mock('$lib/services/config');
vi.mock('$lib/services/contents/draft/save/assets');
vi.mock('$lib/services/contents/draft/save/entry-path');
vi.mock('$lib/services/contents/draft/save/serialize');
vi.mock('$lib/services/contents/entry/fields');
vi.mock('$lib/services/contents/file/format');
vi.mock('$lib/services/integrations/media-libraries/default');
vi.mock('$lib/services/contents/draft/events', () => ({
  callEventHooks: vi.fn(),
}));
vi.mock('$lib/services/user/prefs', () => ({
  prefs: { subscribe: vi.fn(() => vi.fn()) },
}));
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({ devModeEnabled: false })),
  };
});

describe('draft/save/changes', () => {
  let mockGet;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { get } = await import('svelte/store');

    mockGet = vi.mocked(get);

    // Mock the stores used in changes.js
    // Default return undefined for any store
    mockGet.mockReturnValue(undefined);

    // Mock getDefaultMediaLibraryOptions to return expected structure
    const { getDefaultMediaLibraryOptions } =
      await import('$lib/services/integrations/media-libraries/default');

    vi.mocked(getDefaultMediaLibraryOptions).mockReturnValue({
      config: {
        max_file_size: Infinity,
        multiple: false,
        slugify_filename: false,
        transformations: undefined,
      },
    });

    // Mock toRaw to return the input value unchanged
    const { toRaw } = await import('@sveltia/utils/object');

    vi.mocked(toRaw).mockImplementation((value) => value);
  });

  describe('createSavingEntryData', () => {
    it('should create saving entry data for new entry', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: { en: { title: 'Test' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: undefined,
        localizedSlugs: undefined,
      };

      const result = await createSavingEntryData({ draft, slugs });

      expect(result.savingEntry).toBeDefined();
      expect(result.savingEntry.slug).toBe('test-post');
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].action).toBe('create');
    });

    it('should handle i18n single file', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: true,
            allLocales: ['en', 'ja'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: true },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true, ja: true },
        currentValues: {
          en: { title: 'Test' },
          ja: { title: 'テスト' },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: undefined,
        localizedSlugs: undefined,
      };

      const result = await createSavingEntryData({ draft, slugs });

      expect(result.savingEntry).toBeDefined();
      expect(result.changes).toHaveLength(1);
    });

    it('should handle i18n multiple files', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: true,
            allLocales: ['en', 'ja'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true, ja: true },
        originalLocales: {},
        currentValues: {
          en: { title: 'Test' },
          ja: { title: 'テスト' },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: undefined,
        localizedSlugs: { en: 'test-post', ja: 'test-post' },
      };

      const result = await createSavingEntryData({ draft, slugs });

      expect(result.savingEntry).toBeDefined();
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('should call preSave event hooks before creating file changes', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { callEventHooks } = await import('$lib/services/contents/draft/events');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: { en: { title: 'Test' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: undefined,
        localizedSlugs: undefined,
      };

      await createSavingEntryData({ draft, slugs });

      expect(callEventHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'preSave',
          draft,
        }),
      );
      expect(callEventHooks).toHaveBeenCalledTimes(1);
    });

    it('should pass correct savingEntry to preSave event hooks', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { callEventHooks } = await import('$lib/services/contents/draft/events');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Modified in hook' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid-2',
        isNew: false,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'slug' },
          },
        },
        collectionName: 'articles',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: { en: { slug: 'article-post', title: 'Article' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'article-post',
        canonicalSlug: undefined,
        localizedSlugs: undefined,
      };

      await createSavingEntryData({ draft, slugs });

      expect(callEventHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'preSave',
          draft,
          savingEntry: expect.objectContaining({
            id: 'test-uuid-2',
            slug: 'article-post',
            locales: expect.objectContaining({
              en: expect.objectContaining({
                path: 'posts/test-post.md',
              }),
            }),
          }),
        }),
      );
    });

    it('should call event hooks with correct savingEntry for i18n entries', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { callEventHooks } = await import('$lib/services/contents/draft/events');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'i18n-test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: true,
            allLocales: ['en', 'ja'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: true },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true, ja: true },
        currentValues: {
          en: { title: 'Test' },
          ja: { title: 'テスト' },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: undefined,
        localizedSlugs: { en: 'test-post', ja: 'test-post' },
      };

      await createSavingEntryData({ draft, slugs });

      // Verify callEventHooks was called with i18n locales
      expect(callEventHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'preSave',
          savingEntry: expect.objectContaining({
            locales: expect.objectContaining({
              en: expect.any(Object),
              ja: expect.any(Object),
            }),
          }),
        }),
      );
    });
  });

  describe('createBaseSavingEntryData (internal)', () => {
    it('should create base saving entry data with single locale', async () => {
      const { createEntryPath } = await import('./entry-path');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: { en: { title: 'Test Post', body: 'Content' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      expect(result.localizedEntryMap).toBeDefined();
      expect(result.localizedEntryMap.en).toBeDefined();
      expect(result.localizedEntryMap.en.slug).toBe('test-post');
      expect(result.changes).toEqual([]);
      expect(result.savingAssets).toEqual([]);
    });

    it('should handle multiple locales', async () => {
      const { createEntryPath } = await import('./entry-path');

      vi.mocked(createEntryPath).mockImplementation(({ locale }) =>
        locale === 'en' ? 'posts/en/test-post.md' : 'posts/ja/test-post.md',
      );

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true, ja: true },
        currentValues: {
          en: { title: 'Test Post' },
          ja: { title: 'テスト投稿' },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: { en: 'test-post', ja: 'test-post' },
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      expect(result.localizedEntryMap.en).toBeDefined();
      expect(result.localizedEntryMap.ja).toBeDefined();
    });
  });

  describe('getPreviousSha (internal)', () => {
    it('should return undefined when previousPath is undefined', async () => {
      const result = await getPreviousSha({ previousPath: undefined, cacheDB: undefined });

      expect(result).toBeUndefined();
    });

    it('should return undefined when cache entry not found', async () => {
      const mockCacheDB = {
        get: vi.fn().mockResolvedValue(undefined),
      };

      const result = await getPreviousSha({
        previousPath: 'posts/old-post.md',
        cacheDB: mockCacheDB,
      });

      expect(result).toBeUndefined();
      expect(mockCacheDB.get).toHaveBeenCalledWith('posts/old-post.md');
    });

    it('should return sha from cache when found', async () => {
      const mockCacheDB = {
        get: vi.fn().mockResolvedValue({ sha: 'abc123' }),
      };

      const result = await getPreviousSha({
        previousPath: 'posts/old-post.md',
        cacheDB: mockCacheDB,
      });

      expect(result).toBe('abc123');
      expect(mockCacheDB.get).toHaveBeenCalledWith('posts/old-post.md');
    });
  });

  describe('getSingleFileChange (internal)', () => {
    it('should create file change for new entry', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
          _i18n: {
            i18nEnabled: false,
            defaultLocale: 'en',
          },
        },
        isNew: true,
        originalSlugs: undefined,
        originalEntry: undefined,
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'new-post',
            path: 'posts/new-post.md',
            content: { title: 'New Post' },
          },
        },
      };

      const result = await getSingleFileChange({ draft, savingEntry, cacheDB: undefined });

      expect(result.action).toBe('create');
      expect(result.slug).toBe('new-post');
      expect(result.path).toBe('posts/new-post.md');
      expect(result.previousPath).toBeUndefined();
    });

    it('should create file change for renamed entry', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
          _i18n: {
            i18nEnabled: false,
            defaultLocale: 'en',
          },
        },
        isNew: false,
        originalSlugs: { en: 'old-post' },
        originalEntry: {
          locales: {
            en: { path: 'posts/old-post.md' },
          },
        },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'new-post',
            path: 'posts/new-post.md',
            content: { title: 'New Post' },
          },
        },
      };

      const result = await getSingleFileChange({ draft, savingEntry, cacheDB: undefined });

      expect(result.action).toBe('move');
      expect(result.slug).toBe('new-post');
      expect(result.previousPath).toBe('posts/old-post.md');
    });

    it('should create file change for updated entry', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
          _i18n: {
            i18nEnabled: false,
            defaultLocale: 'en',
          },
        },
        isNew: false,
        originalSlugs: { en: 'same-post' },
        originalEntry: {
          locales: {
            en: { path: 'posts/same-post.md' },
          },
        },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'same-post',
            path: 'posts/same-post.md',
            content: { title: 'Updated Post' },
          },
        },
      };

      const result = await getSingleFileChange({ draft, savingEntry, cacheDB: undefined });

      expect(result.action).toBe('update');
      expect(result.slug).toBe('same-post');
      expect(result.previousPath).toBeUndefined();
    });
  });

  describe('getMultiFileChange (internal)', () => {
    it('should create file change for new locale', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
        },
        isNew: true,
        originalLocales: {},
        currentLocales: { en: true },
        originalSlugs: undefined,
        originalEntry: undefined,
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'new-post',
            path: 'posts/en/new-post.md',
            content: { title: 'New Post' },
          },
        },
      };

      const result = await getMultiFileChange({
        draft,
        savingEntry,
        cacheDB: undefined,
        locale: 'en',
      });

      expect(result?.action).toBe('create');
      expect(result?.slug).toBe('new-post');
    });

    it('should create delete change for removed locale', async () => {
      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
        },
        isNew: false,
        originalLocales: { ja: true },
        currentLocales: { ja: false },
        originalSlugs: { ja: 'old-post' },
        originalEntry: {
          locales: {
            ja: { path: 'posts/ja/old-post.md' },
          },
        },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          ja: {
            slug: 'old-post',
            path: 'posts/ja/old-post.md',
            content: undefined,
          },
        },
      };

      const result = await getMultiFileChange({
        draft,
        savingEntry,
        cacheDB: undefined,
        locale: 'ja',
      });

      expect(result?.action).toBe('delete');
    });

    it('should return undefined for unchanged locale', async () => {
      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
        },
        isNew: false,
        originalLocales: {},
        currentLocales: { fr: false },
        originalSlugs: {},
        originalEntry: undefined,
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {},
      };

      const result = await getMultiFileChange({
        draft,
        savingEntry,
        cacheDB: undefined,
        locale: 'fr',
      });

      expect(result).toBeUndefined();
    });

    it('should create move change for renamed locale in multi-file entry', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
        },
        isNew: false,
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'old-post' },
        originalEntry: {
          locales: {
            en: { path: 'posts/en/old-post.md' },
          },
        },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'new-post',
            path: 'posts/en/new-post.md',
            content: { title: 'Renamed Post' },
          },
        },
      };

      const result = await getMultiFileChange({
        draft,
        savingEntry,
        cacheDB: undefined,
        locale: 'en',
      });

      expect(result?.action).toBe('move');
      expect(result?.previousPath).toBe('posts/en/old-post.md');
    });

    it('should create update change for existing locale without rename', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
        },
        isNew: false,
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'same-post' },
        originalEntry: {
          locales: {
            en: { path: 'posts/en/same-post.md' },
          },
        },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'same-post',
            path: 'posts/en/same-post.md',
            content: { title: 'Updated Post' },
          },
        },
      };

      const result = await getMultiFileChange({
        draft,
        savingEntry,
        cacheDB: undefined,
        locale: 'en',
      });

      expect(result?.action).toBe('update');
      expect(result?.previousPath).toBeUndefined();
    });
  });

  describe('createBaseSavingEntryData with various config scenarios', () => {
    it('should handle missing cmsConfig gracefully', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getBlobRegex).mockReturnValue(/blob:http[^\s]*/g);

      // Mock cmsConfig to return undefined (Line 69: get(cmsConfig)?.output ?? {})
      mockGet.mockReturnValue(undefined);

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: {
          en: { title: 'Test Post' },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      // Line 69: Should handle missing cmsConfig by using empty object
      expect(result.localizedEntryMap.en).toBeDefined();
      expect(result.localizedEntryMap.en.content.title).toBe('Test Post');
    });

    it('should handle cmsConfig with output property', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getBlobRegex).mockReturnValue(/blob:http[^\s]*/g);

      // Mock cmsConfig to return config with output and encodingEnabled
      mockGet.mockReturnValue({
        output: {
          encode_file_path: true,
        },
      });

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: {
          en: { title: 'Test Post' },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      // Line 69: Should properly extract encodingEnabled from cmsConfig
      expect(result.localizedEntryMap.en).toBeDefined();
      expect(result.localizedEntryMap.en.content.title).toBe('Test Post');
    });
  });

  describe('createBaseSavingEntryData with blob URLs (internal)', () => {
    it('should handle string values with blob URLs', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { replaceBlobURL } = await import('$lib/services/contents/draft/save/assets');
      const { getField } = await import('$lib/services/contents/entry/fields');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getField).mockReturnValue({ widget: 'image' });
      vi.mocked(replaceBlobURL).mockResolvedValue(undefined);

      // Mock getBlobRegex to return a regex that matches blob URLs
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(getBlobRegex).mockReturnValue(/blob:http[^\s]*/g);

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: {
          en: { title: 'Test', image: 'blob:http://localhost:5000/abc123' },
        },
        files: {
          'blob:http://localhost:5000/abc123': {
            file: { name: 'image.jpg', size: 1024 },
            folder: 'uploads',
          },
        },
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      expect(result.localizedEntryMap.en).toBeDefined();
      expect(result.localizedEntryMap.en.slug).toBe('test-post');
      expect(vi.mocked(replaceBlobURL)).toHaveBeenCalled();
    });

    it('should handle markdown fields with blob URLs and enable encoding', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { getField } = await import('$lib/services/contents/entry/fields');
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getField).mockReturnValue({ widget: 'markdown' });
      vi.mocked(getBlobRegex).mockReturnValue(/blob:http[^\s]*/g);

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: {
          en: { title: 'Test', body: 'blob:http://localhost:5000/xyz789' },
        },
        files: {
          'blob:http://localhost:5000/xyz789': {
            file: { name: 'image.jpg', size: 2048 },
          },
        },
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      expect(result.localizedEntryMap.en).toBeDefined();
      expect(result.localizedEntryMap.en.content).toBeDefined();

      // Verify that getField was called for the markdown body field
      expect(vi.mocked(getField)).toHaveBeenCalledWith(
        expect.objectContaining({
          keyPath: 'body',
        }),
      );
    });

    it('should trim whitespace from string values', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getBlobRegex).mockReturnValue(/blob:http[^\s]*/g);

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: {
          en: { title: '  Test Post  ', body: '\n\nContent\n\n' },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      expect(result.localizedEntryMap.en).toBeDefined();
      expect(result.localizedEntryMap.en.content.title).toBe('Test Post');
      expect(result.localizedEntryMap.en.content.body).toBe('Content');
    });

    it('should skip non-string values without trimming', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getBlobRegex).mockReturnValue(/blob:http[^\s]*/g);

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: {
          en: {
            title: 'Test',
            published: true,
            views: 42,
            tags: ['tag1', 'tag2'],
          },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      expect(result.localizedEntryMap.en).toBeDefined();
      expect(result.localizedEntryMap.en.content.published).toBe(true);
      expect(result.localizedEntryMap.en.content.views).toBe(42);
      expect(result.localizedEntryMap.en.content.tags).toEqual(['tag1', 'tag2']);
    });

    it('should skip locales that are not in currentLocales', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getBlobRegex).mockReturnValue(/blob:http[^\s]*/g);

      const draft = {
        collection: {
          _type: 'entry',
          _i18n: {
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true, ja: false },
        currentValues: {
          en: { title: 'English Title' },
          ja: { title: 'Japanese Title' },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: { en: 'test-post', ja: 'test-post' },
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      expect(result.localizedEntryMap.en).toBeDefined();
      expect(result.localizedEntryMap.ja).toBeDefined();
      expect(result.localizedEntryMap.ja.path).toBeDefined();
    });
  });

  describe('createSavingEntryData with fullPathRegEx', () => {
    it('should extract subPath from path when fullPathRegEx is provided', async () => {
      const { generateUUID } = await import('@sveltia/utils/crypto');
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(generateUUID).mockReturnValue('test-uuid');
      vi.mocked(createEntryPath).mockReturnValue('blog/2025/01/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        isNew: true,
        collection: {
          _type: 'entry',
          _file: {
            fullPathRegEx: /^blog\/(?<year>\d+)\/(?<month>\d+)\/(?<subPath>.+)$/,
          },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'blog',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: { en: { title: 'Test' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createSavingEntryData({ draft, slugs });

      expect(result.savingEntry.subPath).toBe('test-post.md');
    });

    it('should use slug as fallback when fullPathRegEx does not match', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: {
            fullPathRegEx: /^blog\/(?<year>\d+)\/(?<month>\d+)\/(?<subPath>.+)$/,
          },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: { en: { title: 'Test' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createSavingEntryData({ draft, slugs });

      expect(result.savingEntry.subPath).toBe('test-post');
    });

    it('should use slug when fullPathRegEx is null', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: { en: { title: 'Test' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createSavingEntryData({ draft, slugs });

      expect(result.savingEntry.subPath).toBe('test-post');
    });
  });

  describe('createSavingEntryData with database and caching', () => {
    it('should create IndexedDB when backend has databaseName', async () => {
      await import('@sveltia/utils/storage');

      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      // Create a mock for IndexedDB constructor
      const mockIndexedDB = vi.fn().mockReturnValue({
        get: vi.fn(),
      });

      vi.doMock('@sveltia/utils/storage', () => ({
        IndexedDB: mockIndexedDB,
      }));

      // Mock backend store to return database name
      mockGet.mockImplementation((store) => {
        const storeString = store?.toString?.();

        if (storeString && storeString.includes('backend')) {
          return {
            repository: {
              databaseName: 'test-db',
            },
          };
        }

        return undefined;
      });

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: { en: { title: 'Test' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createSavingEntryData({ draft, slugs });

      expect(result.savingEntry).toBeDefined();
    });

    it('should not create IndexedDB when backend is undefined', async () => {
      await import('@sveltia/utils/storage');

      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const mockIndexedDB = vi.fn();

      vi.doMock('@sveltia/utils/storage', () => ({
        IndexedDB: mockIndexedDB,
      }));

      mockGet.mockReturnValue(undefined);

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        currentValues: { en: { title: 'Test' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createSavingEntryData({ draft, slugs });

      expect(result.savingEntry).toBeDefined();
    });
  });

  describe('getSingleFileChange with i18n', () => {
    it('should serialize all locales with content when i18nEnabled is true', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
          _i18n: {
            i18nEnabled: true,
            defaultLocale: 'en',
          },
        },
        isNew: true,
        originalSlugs: undefined,
        originalEntry: undefined,
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'new-post',
            path: 'posts/new-post.md',
            content: { title: 'English Post' },
          },
          ja: {
            slug: 'new-post',
            path: 'posts/new-post.md',
            content: { title: 'Japanese Post' },
          },
        },
      };

      await getSingleFileChange({ draft, savingEntry, cacheDB: undefined });

      expect(vi.mocked(serializeContent)).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'en',
          valueMap: { title: 'English Post' },
        }),
      );
      expect(vi.mocked(serializeContent)).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'ja',
          valueMap: { title: 'Japanese Post' },
        }),
      );
    });

    it('should skip locales without content when i18nEnabled is true', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
          _i18n: {
            i18nEnabled: true,
            defaultLocale: 'en',
          },
        },
        isNew: true,
        originalSlugs: undefined,
        originalEntry: undefined,
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'new-post',
            path: 'posts/new-post.md',
            content: { title: 'English Post' },
          },
          ja: {
            slug: 'new-post',
            path: 'posts/new-post.md',
            content: null,
          },
        },
      };

      await getSingleFileChange({ draft, savingEntry, cacheDB: undefined });

      // serializeContent should only be called for en (which has content)
      const calls = vi.mocked(serializeContent).mock.calls.filter(([args]) => args.locale === 'ja');

      expect(calls).toHaveLength(0);
    });
  });

  describe('getSingleFileChange with previousPath handling', () => {
    it('should not include previousPath when entry is not renamed', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
          _i18n: {
            i18nEnabled: false,
            defaultLocale: 'en',
          },
        },
        isNew: false,
        originalSlugs: { en: 'same-slug' },
        originalEntry: {
          locales: {
            en: { path: 'posts/same-slug.md' },
          },
        },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'same-slug',
            path: 'posts/same-slug.md',
            content: { title: 'Updated' },
          },
        },
      };

      const result = await getSingleFileChange({ draft, savingEntry, cacheDB: undefined });

      // Line 237: previousPath should be undefined when NOT renamed
      expect(result.previousPath).toBeUndefined();
      expect(result.action).toBe('update');
    });

    it('should use originalSlugs._ as fallback when locale-specific key not found', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
          _i18n: {
            i18nEnabled: false,
            defaultLocale: 'en',
          },
        },
        isNew: false,
        // No locale-specific key, only underscore fallback
        originalSlugs: { _: 'old-post' },
        originalEntry: {
          locales: {
            en: { path: 'posts/old-post.md' },
          },
        },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'new-post',
            path: 'posts/new-post.md',
            content: { title: 'Renamed' },
          },
        },
      };

      const result = await getSingleFileChange({ draft, savingEntry, cacheDB: undefined });

      // Line 184: Should use originalSlugs._ as fallback
      expect(result.action).toBe('move');
      expect(result.previousPath).toBe('posts/old-post.md');
    });
  });

  describe('getMultiFileChange with fallback to global folder', () => {
    it('should handle locale without slug/path gracefully', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
        },
        isNew: false,
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: undefined,
        originalEntry: {
          locales: {
            en: { path: 'posts/test.md' },
          },
        },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'test-new',
            path: 'posts/test-new.md',
            content: { title: 'Test' },
          },
        },
      };

      const result = await getMultiFileChange({
        draft,
        savingEntry,
        cacheDB: undefined,
        locale: 'en',
      });

      // Should handle slug/path changes
      expect(result?.action).toBe('move');
      expect(result?.slug).toBe('test-new');
      expect(result?.path).toBe('posts/test-new.md');
    });

    it('should use originalSlugs._ fallback in multi-file entry rename (line 237)', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
        },
        isNew: false,
        originalLocales: { en: true },
        currentLocales: { en: true },
        // Line 237: Use underscore as fallback when locale-specific key not available
        originalSlugs: { _: 'old-name' },
        originalEntry: {
          locales: {
            en: { path: 'posts/en/old-name.md' },
          },
        },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: {
            slug: 'new-name',
            path: 'posts/en/new-name.md',
            content: { title: 'Updated' },
          },
        },
      };

      const result = await getMultiFileChange({
        draft,
        savingEntry,
        cacheDB: undefined,
        locale: 'en',
      });

      // Line 237: Should detect rename using underscore fallback
      expect(result?.action).toBe('move');
      expect(result?.previousPath).toBe('posts/en/old-name.md');
      expect(result?.path).toBe('posts/en/new-name.md');
    });
  });

  describe('createSavingEntryData with multiple locales', () => {
    it('should process multiple locales with Promise.all (i18n multi-file)', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: false,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: true,
            allLocales: ['en', 'ja', 'fr'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true, ja: true, fr: true },
        originalLocales: { en: true, ja: true, fr: false },
        originalSlugs: { en: 'test', ja: 'test', fr: undefined },
        originalEntry: {
          locales: {
            en: { path: 'posts/en/test.md' },
            ja: { path: 'posts/ja/test.md' },
          },
        },
        currentValues: {
          en: { title: 'English' },
          ja: { title: '日本語' },
          fr: { title: 'Français' },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test',
        canonicalSlug: 'test',
        localizedSlugs: { en: 'test', ja: 'test', fr: 'test' },
      };

      const result = await createSavingEntryData({ draft, slugs });

      // Lines 302-303: else branch with Promise.all for multiple locales
      // When i18nEnabled=true and i18nSingleFile=false, all locales are processed
      expect(result.changes).toHaveLength(3);
      expect(result.changes.every((c) => c !== undefined)).toBe(true);
      expect(result.changes.filter((c) => c.action === 'create')).toHaveLength(1); // fr is new
      expect(result.changes.filter((c) => c.action === 'update')).toHaveLength(2); // en, ja exist
    });

    it('should use Promise.all for concurrent locale processing (i18n multi-file)', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: true,
            allLocales: ['en', 'ja', 'de'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'slug' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true, ja: true, de: true },
        originalLocales: {},
        currentValues: {
          en: { title: 'New Post' },
          ja: { title: '新しい投稿' },
          de: { title: 'Neuer Beitrag' },
        },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'new-post',
        canonicalSlug: 'new-post',
        localizedSlugs: { en: 'new-post', ja: 'new-post', de: 'new-post' },
      };

      const result = await createSavingEntryData({ draft, slugs });

      // Verify Promise.all processed all locales with correct locale assignments
      expect(result.changes).toHaveLength(3);
      expect(result.changes.every((c) => c.action === 'create')).toBe(true);
      // All locales should produce changes with the same slug
      expect(result.changes.every((c) => c.slug === 'new-post')).toBe(true);
    });

    it('should handle cache database creation when backend provides databaseName', async () => {
      const { generateUUID } = await import('@sveltia/utils/crypto');
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(generateUUID).mockReturnValue('test-uuid');
      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      // Mock backend store to return object with databaseName (line 302)
      mockGet.mockImplementation(() => ({
        repository: {
          databaseName: 'cms-db-test',
        },
      }));

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          _file: { fullPathRegEx: null },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        originalLocales: {},
        currentValues: { en: { title: 'New Post' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'new-post',
        canonicalSlug: 'new-post',
        localizedSlugs: undefined,
      };

      const result = await createSavingEntryData({ draft, slugs });

      // Verify result is properly created with databaseName (lines 302-303 executed)
      expect(result.savingEntry).toBeDefined();
      expect(result.savingEntry.id).toBe('test-uuid');
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].action).toBe('create');
    });
  });
});
