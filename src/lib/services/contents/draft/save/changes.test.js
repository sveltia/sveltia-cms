// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';

import {
  createBaseSavingEntryData,
  createSavingEntryData,
  getArrayItemTarget,
  planMultiFileChange,
  planSingleFileChange,
} from './changes';
import { buildEntryFileChanges } from './file-changes';

vi.mock('@sveltia/utils/crypto');
vi.mock('@sveltia/utils/file');
vi.mock('@sveltia/utils/object');
vi.mock('@sveltia/utils/storage');
vi.mock('$lib/services/assets/folders', () => ({
  globalAssetFolder: { current: undefined },
}));
vi.mock('$lib/services/backends', () => ({
  backend: { current: undefined },
}));
vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));
vi.mock('$lib/services/contents/draft/save/assets');
vi.mock('$lib/services/contents/draft/save/entry-path');
vi.mock('$lib/services/contents/draft/save/serialize');
vi.mock('$lib/services/contents/entry/fields');
vi.mock('$lib/services/contents/file/format');
vi.mock('$lib/services/integrations/media-libraries/default');
vi.mock('$lib/services/api/events', () => ({
  callEventHooks: vi.fn(),
}));
vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: {},
}));

/**
 * Build the file changes for an entry draft from the plans, as `createSavingEntryData` does.
 * @param {object} args Arguments.
 * @param {any} args.draft Entry draft.
 * @param {any} args.savingEntry Entry to be saved.
 * @returns {Promise<any[]>} File changes.
 */
const buildChanges = ({ draft, savingEntry }) =>
  buildEntryFileChanges({
    draft,
    config: draft.collectionFile ?? draft.collection,
    _file: draft.collection._file,
    entry: savingEntry,
    cacheDB: undefined,
    /**
     * Plan the change to a file of the entry.
     * @param {string} [locale] Locale of the file, or `undefined` for the single file.
     * @returns {any} Planned change.
     */
    planChange: (locale) =>
      locale === undefined
        ? planSingleFileChange({ draft, savingEntry })
        : planMultiFileChange({ draft, savingEntry, locale }),
  });

describe('draft/save/changes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    cmsConfig.current = undefined;
    backend.current = undefined;

    // Mock getDefaultMediaLibraryOptions to return expected structure
    const { getDefaultMediaLibraryOptions } =
      await import('$lib/services/integrations/media-libraries/default');

    vi.mocked(getDefaultMediaLibraryOptions).mockReturnValue({
      enabled: true,
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

    it('should keep the position of an existing entry stored in an array file', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('data/members.json');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const originalEntry = {
        id: 'test-uuid',
        slug: 'test-post',
        arrayIndex: 2,
        locales: { en: { slug: 'test-post', path: 'data/members.json', content: {} } },
      };

      const draft = {
        id: 'test-uuid',
        isNew: false,
        originalEntry,
        collection: {
          _type: 'entry',
          file: 'data/members.json',
          _file: { fullPathRegEx: null, arrayFile: true, fullPath: 'data/members.json' },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'members',
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

      expect(result.savingEntry.arrayIndex).toBe(2);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toMatchObject({
        action: 'update',
        path: 'data/members.json',
        arrayItem: { index: 2, locales: originalEntry.locales },
      });
    });

    it('should read the file configuration from the collection file for a singleton', async () => {
      // A file/singleton collection has no `_file` of its own; it’s on the collection file
      // @see https://github.com/sveltia/sveltia-cms/issues/964
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('src/data/home.mdx');
      vi.mocked(serializeContent).mockReturnValue({ body: 'Hello' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const _i18n = {
        i18nEnabled: false,
        allLocales: ['_default'],
        defaultLocale: '_default',
        structureMap: { i18nSingleFile: false },
        canonicalSlug: { key: 'translationKey' },
      };

      const draft = {
        id: 'test-uuid',
        isNew: false,
        collection: {
          name: '_singletons',
          _type: 'file',
          files: [{ name: 'home', file: 'src/data/home.mdx' }],
          _i18n,
        },
        collectionName: '_singletons',
        collectionFile: {
          name: 'home',
          file: 'src/data/home.mdx',
          _file: { fullPathRegEx: /^src\/data\/(?<subPath>home)\.mdx$/ },
          _i18n,
        },
        fileName: 'home',
        isIndexFile: false,
        originalEntry: { locales: { _default: { path: 'src/data/home.mdx' } } },
        currentLocales: { _default: true },
        currentValues: { _default: { body: 'Hello' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'home',
        canonicalSlug: undefined,
        localizedSlugs: undefined,
      };

      const result = await createSavingEntryData({ draft, slugs });

      expect(result.savingEntry.slug).toBe('home');
      expect(result.savingEntry.subPath).toBe('home');
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toMatchObject({ action: 'update', path: 'src/data/home.mdx' });
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
      const { callEventHooks } = await import('$lib/services/api/events');

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
          collection: draft.collection,
        }),
      );
      expect(callEventHooks).toHaveBeenCalledTimes(1);
    });

    it('should pass correct savingEntry to preSave event hooks', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { callEventHooks } = await import('$lib/services/api/events');

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
          entry: expect.objectContaining({
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
      const { callEventHooks } = await import('$lib/services/api/events');

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
          entry: expect.objectContaining({
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

    it('should strip keys with undefined values during normalization', async () => {
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
        currentValues: { en: { title: 'Test Post', draft: undefined } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      expect(result.localizedEntryMap.en.content).not.toHaveProperty('draft');
      expect(result.localizedEntryMap.en.content.title).toBe('Test Post');
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

    it('should not wipe a user-defined field that shares the canonical slug key when canonicalSlug is undefined', async () => {
      const { createEntryPath } = await import('./entry-path');

      vi.mocked(createEntryPath).mockReturnValue('posts/en/test-post.md');

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
        // The user has a field named `translationKey` with an existing value.
        currentValues: { en: { title: 'Test Post', translationKey: 'my-custom-key' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        // canonicalSlug is undefined because the slug template has no `| localize` filter.
        canonicalSlug: undefined,
        localizedSlugs: undefined,
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      // The user's `translationKey` value must be preserved, not wiped.
      expect(result.localizedEntryMap.en.content.translationKey).toBe('my-custom-key');
    });
  });

  describe('getArrayItemTarget', () => {
    it('should return nothing for a new entry or an entry not stored in an array file', () => {
      expect(getArrayItemTarget(undefined)).toEqual({});
      expect(getArrayItemTarget({ locales: {} })).toEqual({});
    });

    it('should return the position and content of an entry stored in an array file', () => {
      const locales = { _default: { path: 'data/members.json', content: { name: 'A' } } };

      allEntries.current = [];

      // Without the entry in the store, the given entry stands in
      expect(getArrayItemTarget({ id: 'a', arrayIndex: 0, locales })).toEqual({
        arrayItem: { index: 0, locales },
      });
    });

    it('should take the content from the entry in the store rather than a changed copy', () => {
      const storedLocales = {
        _default: { path: 'data/members.json', content: { photo: 'a.png' } },
      };

      const changedLocales = {
        _default: { path: 'data/members.json', content: { photo: 'b.png' } },
      };

      // A copy with the reference to a renamed asset already replaced
      allEntries.current = [
        /** @type {any} */ ({ id: 'b', arrayIndex: 0, locales: {} }),
        /** @type {any} */ ({ id: 'a', arrayIndex: 1, locales: storedLocales }),
      ];

      expect(getArrayItemTarget({ id: 'a', arrayIndex: 1, locales: changedLocales })).toEqual({
        arrayItem: { index: 1, locales: storedLocales },
      });

      allEntries.current = [];
    });
  });

  describe('planSingleFileChange (internal)', () => {
    it('should plan a file creation for new entry', () => {
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

      expect(planSingleFileChange({ draft, savingEntry })).toEqual({
        action: 'create',
        slug: 'new-post',
        path: 'posts/new-post.md',
        previousPath: undefined,
        currentPath: undefined,
      });
    });

    it('should target the item of an existing entry stored in an array file', () => {
      const locales = { en: { slug: 'a', path: 'data/members.json', content: { title: 'A' } } };

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'json', arrayFile: true, fullPath: 'data/members.json' },
          _i18n: { i18nEnabled: false, defaultLocale: 'en' },
        },
        isNew: false,
        originalEntry: { arrayIndex: 1, locales },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: { en: { slug: 'a', path: 'data/members.json', content: { title: 'B' } } },
      };

      expect(planSingleFileChange({ draft, savingEntry })).toEqual({
        action: 'update',
        slug: 'a',
        path: 'data/members.json',
        previousPath: undefined,
        currentPath: 'data/members.json',
        arrayItem: { index: 1, locales },
      });
    });

    it('should not target an item for a new entry stored in an array file', () => {
      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'json', arrayFile: true, fullPath: 'data/members.json' },
          _i18n: { i18nEnabled: false, defaultLocale: 'en' },
        },
        isNew: true,
        originalEntry: undefined,
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: { en: { slug: 'a', path: 'data/members.json', content: { title: 'A' } } },
      };

      const result = planSingleFileChange({ draft, savingEntry });

      expect(result.action).toBe('create');
      expect(result).not.toHaveProperty('arrayItem');
    });

    it('should take the default locale from the collection file', () => {
      const draft = {
        collection: { _type: 'file', _i18n: { i18nEnabled: false, defaultLocale: 'en' } },
        collectionFile: {
          name: 'about',
          _file: { format: 'yaml' },
          _i18n: { i18nEnabled: true, defaultLocale: 'ja' },
        },
        isNew: false,
        originalEntry: { locales: { ja: { path: 'data/about.yaml' } } },
      };

      const savingEntry = {
        locales: {
          en: { slug: 'about-en', path: 'data/about-en.yaml', content: {} },
          ja: { slug: 'about', path: 'data/about.yaml', content: {} },
        },
      };

      expect(planSingleFileChange({ draft, savingEntry })).toEqual({
        action: 'update',
        slug: 'about',
        path: 'data/about.yaml',
        previousPath: undefined,
        currentPath: 'data/about.yaml',
      });
    });

    it('should plan a move for renamed entry', () => {
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

      expect(planSingleFileChange({ draft, savingEntry })).toEqual({
        action: 'move',
        slug: 'new-post',
        path: 'posts/new-post.md',
        previousPath: 'posts/old-post.md',
        currentPath: 'posts/old-post.md',
      });
    });

    it('should plan an update for updated entry', () => {
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

      expect(planSingleFileChange({ draft, savingEntry })).toEqual({
        action: 'update',
        slug: 'same-post',
        path: 'posts/same-post.md',
        previousPath: undefined,
        currentPath: 'posts/same-post.md',
      });
    });
  });

  describe('planMultiFileChange (internal)', () => {
    it('should plan a file creation for new locale', () => {
      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
        },
        fields: [{ name: 'title', widget: 'string', comment: 'Page title' }],
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

      expect(planMultiFileChange({ draft, savingEntry, locale: 'en' })).toEqual({
        action: 'create',
        slug: 'new-post',
        path: 'posts/en/new-post.md',
        previousPath: undefined,
        currentPath: undefined,
      });
    });

    it('should plan a file creation for a locale added to an existing entry', () => {
      const draft = {
        collection: { _type: 'entry', _file: { format: 'yaml-frontmatter' } },
        isNew: false,
        originalLocales: { en: true },
        currentLocales: { en: true, fr: true },
        originalEntry: { locales: { en: { path: 'posts/en/post.md' } } },
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: { fr: { slug: 'post', path: 'posts/fr/post.md', content: { title: 'Post' } } },
      };

      expect(planMultiFileChange({ draft, savingEntry, locale: 'fr' })).toEqual({
        action: 'create',
        slug: 'post',
        path: 'posts/fr/post.md',
        previousPath: undefined,
        currentPath: undefined,
      });
    });

    it('should plan a deletion for removed locale', () => {
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

      // Without a slug in the original entry, the one of the saving entry is used
      expect(planMultiFileChange({ draft, savingEntry, locale: 'ja' })).toEqual({
        action: 'delete',
        slug: 'old-post',
        path: 'posts/ja/old-post.md',
        currentPath: 'posts/ja/old-post.md',
      });
    });

    it('should delete the original file of a removed locale when the entry is renamed', () => {
      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
        },
        isNew: false,
        originalLocales: { ja: true },
        currentLocales: { ja: false },
        originalEntry: {
          locales: {
            ja: { slug: 'old-post', path: 'posts/ja/old-post.md' },
          },
        },
        collectionFile: undefined,
      };

      // A disabled locale only gets a path, built from the new slug
      const savingEntry = { locales: { ja: { path: 'posts/ja/new-post.md' } } };

      expect(planMultiFileChange({ draft, savingEntry, locale: 'ja' })).toEqual({
        action: 'delete',
        slug: 'old-post',
        path: 'posts/ja/old-post.md',
        currentPath: 'posts/ja/old-post.md',
      });
    });

    it('should return undefined for unchanged locale', () => {
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

      expect(planMultiFileChange({ draft, savingEntry, locale: 'fr' })).toBeUndefined();
    });

    it('should plan a move for renamed locale in multi-file entry', () => {
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

      expect(planMultiFileChange({ draft, savingEntry, locale: 'en' })).toEqual({
        action: 'move',
        slug: 'new-post',
        path: 'posts/en/new-post.md',
        previousPath: 'posts/en/old-post.md',
        currentPath: 'posts/en/old-post.md',
      });
    });

    it('should plan an update for existing locale without rename', () => {
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

      expect(planMultiFileChange({ draft, savingEntry, locale: 'en' })).toEqual({
        action: 'update',
        slug: 'same-post',
        path: 'posts/en/same-post.md',
        previousPath: undefined,
        currentPath: 'posts/en/same-post.md',
      });
    });
  });

  describe('file changes built from the plans', () => {
    it('should format each locale file with the field comments', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
          _i18n: { i18nEnabled: true, allLocales: ['en'], defaultLocale: 'en', structureMap: {} },
        },
        fields: [{ name: 'title', widget: 'string', comment: 'Page title' }],
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

      expect(await buildChanges({ draft, savingEntry })).toEqual([
        {
          action: 'create',
          slug: 'new-post',
          path: 'posts/en/new-post.md',
          previousPath: undefined,
          previousSha: undefined,
          data: 'formatted content',
        },
      ]);
      expect(vi.mocked(serializeContent)).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'en', valueMap: { title: 'New Post' } }),
      );
      expect(vi.mocked(formatEntryFile).mock.calls[0][0].comments).toEqual({
        title: 'Page title',
      });
    });

    it('should not format the file of a removed locale', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml-frontmatter' },
          _i18n: { i18nEnabled: true, allLocales: ['ja'], defaultLocale: 'ja', structureMap: {} },
        },
        isNew: false,
        originalLocales: { ja: true },
        currentLocales: { ja: false },
        originalEntry: { locales: { ja: { slug: 'old-post', path: 'posts/ja/old-post.md' } } },
        collectionFile: undefined,
      };

      const savingEntry = { locales: { ja: { path: 'posts/ja/new-post.md' } } };

      expect(await buildChanges({ draft, savingEntry })).toEqual([
        {
          action: 'delete',
          slug: 'old-post',
          path: 'posts/ja/old-post.md',
          previousSha: undefined,
        },
      ]);
      expect(formatEntryFile).not.toHaveBeenCalled();
    });

    it('should format the index file with its own configuration', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(createEntryPath).mockReturnValue('posts/posts.json');
      vi.mocked(formatEntryFile).mockResolvedValue('{}');
      vi.mocked(serializeContent).mockReturnValue({ layout: 'post' });

      const indexFile = { format: 'json', extension: 'json' };

      const draft = {
        id: 'test-uuid',
        collection: {
          _type: 'entry',
          _file: { format: 'frontmatter', extension: 'md', fullPathRegEx: null, indexFile },
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: {},
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'posts',
        isNew: false,
        originalEntry: { locales: { en: { path: 'posts/posts.json' } } },
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: true,
        currentLocales: { en: true },
        currentValues: { en: { layout: 'post' } },
        files: {},
      };

      const slugs = { defaultLocaleSlug: 'posts', canonicalSlug: undefined };
      const { changes } = await createSavingEntryData({ draft, slugs });

      expect(changes).toHaveLength(1);
      expect(changes[0].action).toBe('update');
      expect(formatEntryFile).toHaveBeenCalledWith(expect.objectContaining({ _file: indexFile }));
    });
  });

  describe('createBaseSavingEntryData with aliases (internal)', () => {
    /**
     * Create a mock entry draft for a renamed entry.
     * @param {string} [previewPath] The `preview_path` option for the collection.
     * @returns {object} Mock draft.
     */
    const createRenamedDraft = (previewPath = '/posts/{{slug}}') => ({
      isNew: false,
      isIndexFile: false,
      collection: {
        name: 'posts',
        _type: 'entry',
        preview_path: previewPath,
        _i18n: {
          canonicalSlug: { key: 'translationKey' },
          defaultLocale: 'en',
          omitDefaultLocaleFromPreviewPath: false,
        },
      },
      collectionName: 'posts',
      collectionFile: undefined,
      fileName: undefined,
      currentLocales: { en: true },
      currentValues: { en: { title: 'New Title' } },
      originalEntry: {
        id: 'posts/old-post',
        slug: 'old-post',
        subPath: 'old-post',
        locales: {
          en: { slug: 'old-post', path: 'posts/old-post.md', content: { title: 'Old Title' } },
        },
      },
      files: {},
    });

    const slugs = {
      defaultLocaleSlug: 'new-post',
      canonicalSlug: undefined,
      localizedSlugs: undefined,
    };

    it('should add the previous path to the content when the slug is edited', async () => {
      const { createEntryPath } = await import('./entry-path');

      vi.mocked(createEntryPath).mockReturnValue('posts/new-post.md');

      const result = await createBaseSavingEntryData({ draft: createRenamedDraft(), slugs });

      expect(result.localizedEntryMap.en.content).toEqual({
        title: 'New Title',
        'aliases.0': '/posts/old-post',
      });
    });

    it('should not add the previous path when `preview_path` is not defined', async () => {
      const { createEntryPath } = await import('./entry-path');

      vi.mocked(createEntryPath).mockReturnValue('posts/new-post.md');

      const draft = createRenamedDraft();

      delete draft.collection.preview_path;

      const result = await createBaseSavingEntryData({ draft, slugs });

      expect(result.localizedEntryMap.en.content).toEqual({ title: 'New Title' });
    });
  });

  describe('createBaseSavingEntryData with various config scenarios', () => {
    it('should handle missing cmsConfig gracefully', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getBlobRegex).mockReturnValue(/blob:http[^\s]*/g);

      // Mock cmsConfig to return undefined
      cmsConfig.current = undefined;

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
      cmsConfig.current = /** @type {any} */ ({
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

    it('should fail with a clear error when a file has no folder to be saved to', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { replaceBlobURL } = await import('$lib/services/contents/draft/save/assets');
      const { getField } = await import('$lib/services/contents/entry/fields');
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getField).mockReturnValue({ widget: 'image' });
      vi.mocked(getBlobRegex).mockReturnValue(/blob:http[^\s]*/g);

      // Neither the file nor the site has a folder, as with only a cloud media library configured
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
          },
        },
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      await expect(createBaseSavingEntryData({ draft, slugs })).rejects.toThrow(
        'There is no asset folder to save the file "image.jpg" to',
      );
      expect(vi.mocked(replaceBlobURL)).not.toHaveBeenCalled();
    });

    it('should leave the blob URLs in the draft, so a failed save can be retried', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { replaceBlobURL } = await import('$lib/services/contents/draft/save/assets');
      const { getField } = await import('$lib/services/contents/entry/fields');
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getField).mockReturnValue({ widget: 'image' });
      vi.mocked(getBlobRegex).mockReturnValue(/blob:http[^\s]*/g);
      vi.mocked(replaceBlobURL).mockImplementation(async ({ content, keyPath, blobURL }) => {
        content[keyPath] = /** @type {string} */ (content[keyPath]).replace(blobURL, '/image.jpg');
      });

      const blobURL = 'blob:http://localhost:5000/abc123';

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
          en: { title: ' Test ', image: blobURL },
        },
        files: {
          [blobURL]: { file: { name: 'image.jpg', size: 1024 }, folder: 'uploads' },
        },
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: 'test-post',
        localizedSlugs: undefined,
      };

      const result = await createBaseSavingEntryData({ draft, slugs });

      expect(result.localizedEntryMap.en.content).toEqual({
        title: 'Test',
        image: '/image.jpg',
        translationKey: 'test-post',
      });
      // The draft itself is untouched
      expect(draft.currentValues.en).toEqual({ title: ' Test ', image: blobURL });
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
      expect(result.localizedEntryMap.en.content).toBeDefined();

      // Verify that getField was called for the markdown body field
      expect(vi.mocked(getField)).toHaveBeenCalledWith(
        expect.objectContaining({
          keyPath: 'body',
        }),
      );
    });

    it('should handle richtext fields with blob URLs and enable encoding', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { getField } = await import('$lib/services/contents/entry/fields');
      const { getBlobRegex } = await import('@sveltia/utils/file');

      vi.mocked(createEntryPath).mockReturnValue('posts/test-post.md');
      vi.mocked(getField).mockReturnValue({ widget: 'richtext' });
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
      expect(result.localizedEntryMap.en.content).toBeDefined();

      // Verify that getField was called for the richtext body field
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

  describe('createSavingEntryData for a nested collection', () => {
    it('should use the sub path as the entry slug', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockImplementation(({ locale }) =>
        locale === 'en'
          ? 'content/pages/docs/guides/_index.md'
          : `content/pages/docs/guides/_index.${locale}.md`,
      );
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: true,
        collection: {
          _type: 'entry',
          name: 'pages',
          folder: 'content/pages',
          fields: [],
          nested: {},
          _file: {
            fullPathRegEx:
              /^content\/pages\/(?<subPath>[^/]+?(?:\/[^/]+?)*)(?:\.(?<locale>fr))?\.md$/,
          },
          _i18n: {
            i18nEnabled: true,
            allLocales: ['en', 'fr'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: false },
            canonicalSlug: { key: 'translationKey' },
          },
        },
        collectionName: 'pages',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true, fr: true },
        originalLocales: { en: false, fr: false },
        currentValues: { en: { title: 'Test' }, fr: { title: 'Test' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test',
        canonicalSlug: 'test',
        localizedSlugs: undefined,
      };

      const { savingEntry } = await createSavingEntryData({ draft, slugs });

      expect(savingEntry.subPath).toBe('docs/guides/_index');
      expect(savingEntry.slug).toBe('docs/guides/_index');
      expect(savingEntry.locales.en.slug).toBe('docs/guides/_index');
      expect(savingEntry.locales.fr.slug).toBe('docs/guides/_index');
    });

    it('should link the localized files by the default locale’s sub path', async () => {
      // @see https://github.com/sveltia/sveltia-cms/issues/962
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockImplementation(({ locale }) =>
        locale === 'en'
          ? 'content/pages/en/about/team/_index.md'
          : 'content/pages/fr/a-propos/equipe/_index.md',
      );
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: true,
        defaultLocale: 'en',
        collection: {
          _type: 'entry',
          name: 'pages',
          folder: 'content/pages',
          fields: [],
          slug: '{{title | localize}}',
          nested: {},
          _file: {
            fullPathRegEx:
              /^content\/pages\/(?<locale>en|fr)\/(?<subPath>[^/]+?(?:\/[^/]+?)*)\.md$/,
          },
          _i18n: {
            i18nEnabled: true,
            allLocales: ['en', 'fr'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: false },
            canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
          },
        },
        collectionName: 'pages',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true, fr: true },
        originalLocales: { en: false, fr: false },
        currentValues: { en: { title: 'Team' }, fr: { title: 'Équipe' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'team',
        // What the slug template alone would give, which another entry in a different folder
        // could share
        canonicalSlug: 'team',
        localizedSlugs: { en: 'team', fr: 'equipe' },
      };

      const { savingEntry } = await createSavingEntryData({ draft, slugs });

      expect(savingEntry.locales.en.content.translationKey).toBe('about/team/_index');
      expect(savingEntry.locales.fr.content.translationKey).toBe('about/team/_index');
      expect(savingEntry.locales.fr.slug).toBe('a-propos/equipe/_index');
    });

    it('should keep the regular canonical slug when the slugs are not localized', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      vi.mocked(createEntryPath).mockReturnValue('content/pages/about/team/_index.md');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Test' });
      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');

      const draft = {
        id: 'test-uuid',
        isNew: true,
        defaultLocale: 'en',
        collection: {
          _type: 'entry',
          name: 'pages',
          folder: 'content/pages',
          fields: [],
          nested: {},
          _file: {},
          _i18n: {
            i18nEnabled: false,
            allLocales: ['en'],
            defaultLocale: 'en',
            structureMap: {},
            canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
          },
        },
        collectionName: 'pages',
        collectionFile: undefined,
        fileName: undefined,
        isIndexFile: false,
        currentLocales: { en: true },
        originalLocales: { en: false },
        currentValues: { en: { title: 'Team' } },
        files: {},
      };

      const { savingEntry } = await createSavingEntryData({
        draft,
        slugs: { defaultLocaleSlug: 'team', canonicalSlug: undefined, localizedSlugs: undefined },
      });

      expect(savingEntry.locales.en.content.translationKey).toBeUndefined();
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

      // Mock backend state to return database name
      backend.current = /** @type {any} */ ({
        repository: {
          databaseName: 'test-db',
        },
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

  describe('single-file changes with i18n', () => {
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
            allLocales: ['en', 'ja'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: true },
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

      await buildChanges({ draft, savingEntry });

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
            allLocales: ['en', 'ja'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: true },
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

      await buildChanges({ draft, savingEntry });

      // serializeContent should only be called for en (which has content)
      const calls = vi.mocked(serializeContent).mock.calls.filter(([args]) => args.locale === 'ja');

      expect(calls).toHaveLength(0);
    });
  });

  describe('single-file changes with single_file_default_root', () => {
    it('should spread default locale content at root and nest non-default locales under their key', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockImplementation(({ locale }) =>
        locale === 'de'
          ? { title: 'Über uns', content: 'Deutsche Version.' }
          : { title: 'About Us', content: 'English version.' },
      );

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml' },
          _i18n: {
            i18nEnabled: true,
            allLocales: ['de', 'en'],
            defaultLocale: 'de',
            structureMap: { i18nSingleFileDefaultRoot: true },
          },
        },
        fields: [{ name: 'title', widget: 'string', comment: 'Page title' }],
        isNew: true,
        originalSlugs: undefined,
        originalEntry: undefined,
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          de: { slug: 'about', path: 'about.yaml', content: { title: 'Über uns' } },
          en: { slug: 'about', path: 'about.yaml', content: { title: 'About Us' } },
        },
      };

      await buildChanges({ draft, savingEntry });

      const [formatArgs] = vi.mocked(formatEntryFile).mock.calls[0];

      expect(formatArgs.content).toEqual({
        lang: ['de', 'en'],
        title: 'Über uns',
        content: 'Deutsche Version.',
        en: { title: 'About Us', content: 'English version.' },
      });
      // The comments follow the same structure as the content
      expect(formatArgs.comments).toEqual({ title: 'Page title', 'en.title': 'Page title' });
    });

    it('should omit non-default locales without content', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'Default' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml' },
          _i18n: {
            i18nEnabled: true,
            allLocales: ['en', 'fr'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFileDefaultRoot: true },
          },
        },
        isNew: true,
        originalSlugs: undefined,
        originalEntry: undefined,
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          en: { slug: 'post', path: 'post.yaml', content: { title: 'Hello' } },
          fr: { slug: 'post', path: 'post.yaml', content: null },
        },
      };

      await buildChanges({ draft, savingEntry });

      const [formatArgs] = vi.mocked(formatEntryFile).mock.calls[0];

      // fr has no content so it's excluded from lang and from root fields
      expect(formatArgs.content).toEqual({ lang: ['en'], title: 'Default' });
    });

    it('should fall back to empty object when default locale has no content', async () => {
      const { formatEntryFile } = await import('$lib/services/contents/file/format');
      const { serializeContent } = await import('./serialize');

      vi.mocked(formatEntryFile).mockResolvedValue('formatted content');
      vi.mocked(serializeContent).mockReturnValue({ title: 'French' });

      const draft = {
        collection: {
          _type: 'entry',
          _file: { format: 'yaml' },
          _i18n: {
            i18nEnabled: true,
            allLocales: ['en', 'fr'],
            defaultLocale: 'en',
            structureMap: { i18nSingleFileDefaultRoot: true },
          },
        },
        isNew: true,
        originalSlugs: undefined,
        originalEntry: undefined,
        collectionFile: undefined,
      };

      const savingEntry = {
        locales: {
          // en locale has no content (falsy), so it won't appear in localeContents
          en: { slug: 'post', path: 'post.yaml', content: null },
          fr: { slug: 'post', path: 'post.yaml', content: { title: 'French' } },
        },
      };

      await buildChanges({ draft, savingEntry });

      const [formatArgs] = vi.mocked(formatEntryFile).mock.calls[0];

      // defaultContent should fall back to {} since en has no content
      expect(formatArgs.content).toEqual({ lang: ['en', 'fr'], fr: { title: 'French' } });
    });
  });

  describe('planSingleFileChange with previousPath handling', () => {
    it('should not include previousPath when entry is not renamed', () => {
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

      const result = planSingleFileChange({ draft, savingEntry });

      // Line 237: previousPath should be undefined when NOT renamed
      expect(result.previousPath).toBeUndefined();
      expect(result.action).toBe('update');
      expect(result.currentPath).toBe('posts/same-slug.md');
    });

    it('should use originalSlugs._ as fallback when locale-specific key not found', () => {
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

      const result = planSingleFileChange({ draft, savingEntry });

      // Line 184: Should use originalSlugs._ as fallback
      expect(result.action).toBe('move');
      expect(result.previousPath).toBe('posts/old-post.md');
      expect(result.currentPath).toBe('posts/old-post.md');
    });
  });

  describe('planMultiFileChange with fallback to global folder', () => {
    it('should handle locale without slug/path gracefully', () => {
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

      const result = planMultiFileChange({ draft, savingEntry, locale: 'en' });

      // Should handle slug/path changes
      expect(result?.action).toBe('move');
      expect(result?.slug).toBe('test-new');
      expect(result?.path).toBe('posts/test-new.md');
      expect(result?.currentPath).toBe('posts/test.md');
    });

    it('should use originalSlugs._ fallback in multi-file entry rename (line 237)', () => {
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

      const result = planMultiFileChange({ draft, savingEntry, locale: 'en' });

      // Line 237: Should detect rename using underscore fallback
      expect(result?.action).toBe('move');
      expect(result?.previousPath).toBe('posts/en/old-name.md');
      expect(result?.path).toBe('posts/en/new-name.md');
      expect(result?.currentPath).toBe('posts/en/old-name.md');
    });
  });

  describe('createSavingEntryData with multiple locales', () => {
    it('should process multiple locales with Promise.all (i18n multi-file)', async () => {
      const { createEntryPath } = await import('./entry-path');
      const { serializeContent } = await import('./serialize');
      const { formatEntryFile } = await import('$lib/services/contents/file/format');

      // Keep each locale at the path it already has, so the changes are updates rather than moves
      vi.mocked(createEntryPath).mockImplementation(({ locale }) => `posts/${locale}/test.md`);
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
      // The changes follow the order of the locales
      expect(result.changes.map((c) => c.path)).toEqual([
        'posts/en/test.md',
        'posts/ja/test.md',
        'posts/fr/test.md',
      ]);
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

      // Mock backend state to return object with databaseName (line 302)
      backend.current = /** @type {any} */ ({
        repository: {
          databaseName: 'cms-db-test',
        },
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

    it('should skip undefined changes when a locale is disabled in a new i18n multi-file entry (line 318)', async () => {
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
        currentLocales: { en: true, ja: false }, // 'ja' is disabled
        originalLocales: {},
        currentValues: { en: { title: 'Test' } },
        files: {},
      };

      const slugs = {
        defaultLocaleSlug: 'test-post',
        canonicalSlug: undefined,
        localizedSlugs: { en: 'test-post', ja: 'test-post' },
      };

      const result = await createSavingEntryData({ draft, slugs });

      // For 'ja': currentLocales['ja']=false AND isNew=true → planMultiFileChange returns undefined
      // `buildEntryFileChanges` leaves out the undefined plan for 'ja'
      // Only 'en' produces a file change
      expect(result.savingEntry).toBeDefined();
      expect(result.changes).toHaveLength(1);
    });
  });
});
