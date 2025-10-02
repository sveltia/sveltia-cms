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
    const { getDefaultMediaLibraryOptions } = await import(
      '$lib/services/integrations/media-libraries/default'
    );

    vi.mocked(getDefaultMediaLibraryOptions).mockReturnValue({
      config: {
        max_file_size: Infinity,
        multiple: false,
        slugify_filename: false,
        transformations: undefined,
      },
    });
  });

  describe('createSavingEntryData', () => {
    it('should create saving entry data for new entry', async () => {
      const { generateUUID } = await import('@sveltia/utils/crypto');
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(generateUUID).mockReturnValue('test-uuid');
      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
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
      const { generateUUID } = await import('@sveltia/utils/crypto');
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(generateUUID).mockReturnValue('test-uuid');
      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
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
      const { generateUUID } = await import('@sveltia/utils/crypto');
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(generateUUID).mockReturnValue('test-uuid');
      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
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
  });
});
