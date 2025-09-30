// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSavingEntryData } from './changes';

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
});
