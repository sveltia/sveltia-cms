// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('$lib/services/config', () => ({
  cmsConfig: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/collection/index-file', () => ({
  getIndexFile: vi.fn(),
  isCollectionIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/draft', () => ({
  entryDraft: { set: vi.fn(), subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/draft/backup', () => ({
  restoreBackupIfNeeded: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/create/proxy', () => ({
  createProxy: vi.fn((args) => args.target),
}));

vi.mock('$lib/services/contents/draft/defaults', () => ({
  getDefaultValues: vi.fn(),
}));

// Import mocked modules once at the top level
const { getIndexFile, isCollectionIndexFile } =
  await import('$lib/services/contents/collection/index-file');

const { entryDraft } = await import('$lib/services/contents/draft');
const { restoreBackupIfNeeded } = await import('$lib/services/contents/draft/backup');
const { createProxy } = await import('$lib/services/contents/draft/create/proxy');
const { getDefaultValues } = await import('$lib/services/contents/draft/defaults');
const { cmsConfig } = await import('$lib/services/config');
const { createDraft, getSlugEditorProp } = await import('.');

describe('contents/draft/create/index', () => {
  describe('getSlugEditorProp', () => {
    const baseI18n = {
      allLocales: ['en', 'ja'],
      defaultLocale: 'en',
    };

    it('should return all false for a non-entry (file) collection', () => {
      const collection = {
        _type: 'file',
        _i18n: baseI18n,
      };

      expect(getSlugEditorProp({ collection, originalSlugs: {} })).toEqual({
        en: false,
        ja: false,
      });
    });

    it('should return all false when the slug template has no slug editor tag', () => {
      const collection = {
        _type: 'entry',
        identifier_field: 'title',
        slug: '{{title}}',
        _i18n: baseI18n,
      };

      expect(getSlugEditorProp({ collection, originalSlugs: {} })).toEqual({
        en: false,
        ja: false,
      });
    });

    it('should return true for default locale and readonly for others with {{fields._slug}} and empty originalSlugs', () => {
      const collection = {
        _type: 'entry',
        slug: '{{fields._slug}}',
        _i18n: baseI18n,
      };

      expect(getSlugEditorProp({ collection, originalSlugs: {} })).toEqual({
        en: true,
        ja: 'readonly',
      });
    });

    it('should return all true with {{fields._slug | localize}} and empty originalSlugs', () => {
      const collection = {
        _type: 'entry',
        slug: '{{fields._slug | localize}}',
        _i18n: baseI18n,
      };

      expect(getSlugEditorProp({ collection, originalSlugs: {} })).toEqual({
        en: true,
        ja: true,
      });
    });

    it('should return false for locales whose slug is already set', () => {
      const collection = {
        _type: 'entry',
        slug: '{{fields._slug}}',
        _i18n: baseI18n,
      };

      // Both locales have existing slugs → hidden
      expect(
        getSlugEditorProp({ collection, originalSlugs: { en: 'my-post', ja: 'my-post-ja' } }),
      ).toEqual({ en: false, ja: false });
    });

    it('should return true for locales without a slug and false for those with one when using localized tag', () => {
      const collection = {
        _type: 'entry',
        slug: '{{fields._slug | localize}}',
        _i18n: baseI18n,
      };

      // en already has a slug → hidden; ja does not → editable
      expect(getSlugEditorProp({ collection, originalSlugs: { en: 'my-post' } })).toEqual({
        en: false,
        ja: true,
      });
    });

    it('should use collectionFile i18n when provided', () => {
      const collection = {
        _type: 'entry',
        slug: '{{fields._slug}}',
        _i18n: { allLocales: ['en', 'ja', 'fr'], defaultLocale: 'en' },
      };

      const collectionFile = {
        _i18n: { allLocales: ['en', 'de'], defaultLocale: 'en' },
      };

      expect(getSlugEditorProp({ collection, collectionFile, originalSlugs: {} })).toEqual({
        en: true,
        de: 'readonly',
      });
    });

    it('should return false for all locales when originalSlugs has a locale-agnostic slug', () => {
      const collection = {
        _type: 'entry',
        slug: '{{fields._slug}}',
        _i18n: baseI18n,
      };

      expect(getSlugEditorProp({ collection, originalSlugs: { _: 'my-post' } })).toEqual({
        en: false,
        ja: false,
      });
    });

    it('should return false for all locales when originalSlugs has a locale-agnostic slug with localized tag', () => {
      const collection = {
        _type: 'entry',
        slug: '{{fields._slug | localize}}',
        _i18n: baseI18n,
      };

      expect(getSlugEditorProp({ collection, originalSlugs: { _: 'my-post' } })).toEqual({
        en: false,
        ja: false,
      });
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    isCollectionIndexFile.mockReturnValue(false);
    getIndexFile.mockReturnValue(undefined);
    createProxy.mockImplementation((args) => args.target);
    getDefaultValues.mockReturnValue({});

    cmsConfig.subscribe.mockImplementation((callback) => {
      callback({ editor: { preview: true } });

      return vi.fn();
    });
  });

  describe('createDraft', () => {
    it('should create a new entry draft', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'body', widget: 'markdown' },
        ],
        _i18n: {
          allLocales: ['en', 'ja'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'posts',
          isNew: true,
          id: expect.any(String),
          canPreview: true,
          fields: collection.fields,
          originalEntry: undefined,
          defaultLocale: 'en',
          originalLocales: { en: true, ja: false },
          currentLocales: { en: true, ja: false },
          originalSlugs: {},
          currentSlugs: {},
        }),
      );
    });

    it('should create draft for existing entry', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [{ name: 'title', widget: 'string' }],
        _i18n: {
          allLocales: ['en', 'ja'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const originalEntry = {
        id: 'entry-123',
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test Post', translationKey: 'abc123' },
            slug: 'test-post',
          },
          ja: {
            content: { title: 'テスト記事', translationKey: 'abc123' },
            slug: 'test-post',
          },
        },
      };

      createDraft({ collection, originalEntry });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'posts',
          isNew: false,
          id: 'entry-123',
          originalEntry,
          defaultLocale: 'en',
          originalLocales: { en: true, ja: true },
          currentLocales: { en: true, ja: true },
          originalSlugs: { en: 'test-post', ja: 'test-post' },
          currentSlugs: { en: 'test-post', ja: 'test-post' },
        }),
      );
    });

    it('should handle file collection', () => {
      const collection = {
        name: 'pages',
        _type: 'file',
        files: [],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const collectionFile = {
        name: 'about',
        fields: [{ name: 'title', widget: 'string' }],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection, collectionFile });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'pages',
          fileName: 'about',
          fields: collectionFile.fields,
          defaultLocale: 'en',
        }),
      );
    });

    it('should set canPreview from collection config', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        editor: { preview: false },
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          canPreview: false,
        }),
      );
    });

    it('should set canPreview from collectionFile config', () => {
      const collection = {
        name: 'pages',
        _type: 'file',
        files: [],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const collectionFile = {
        name: 'about',
        fields: [],
        editor: { preview: false },
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection, collectionFile });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          canPreview: false,
        }),
      );
    });

    it('should use true fallback when no editor.preview is set anywhere (line 120)', () => {
      // Covers the `true` fallback: when none of indexFile/collectionFile/collection/cmsConfig
      // define editor.preview, the ?? chain falls all the way to `true`.
      cmsConfig.subscribe.mockImplementation((callback) => {
        callback({}); // no editor property → cmsConfig?.editor?.preview = undefined
        return vi.fn();
      });

      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
        // no editor property → collection.editor?.preview = undefined
      };

      createDraft({ collection });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          canPreview: true, // falls through to the literal `true` at line 120
        }),
      );
    });

    it('should use initial locales for new entry', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          allLocales: ['en', 'fr', 'ja'],
          initialLocales: ['en', 'fr'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultLocale: 'en',
          originalLocales: { en: true, fr: true, ja: false },
          currentLocales: { en: true, fr: true, ja: false },
        }),
      );
    });

    it('should create proxies for currentValues', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection });

      expect(createProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
          locale: 'en',
          target: expect.any(Object),
        }),
      );
    });

    it('should handle dynamic default values', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [{ name: 'title', widget: 'string' }],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const dynamicValues = { title: 'Dynamic Title' };

      createDraft({ collection, dynamicValues });

      expect(getDefaultValues).toHaveBeenCalledWith({
        fields: collection.fields,
        locale: 'en',
        defaultLocale: 'en',
        dynamicValues,
      });
    });

    it('should set slugEditor for entry collection with {{fields._slug}} template', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        identifier_field: 'title',
        slug: '{{fields._slug}}',
        _i18n: {
          allLocales: ['en', 'ja'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultLocale: 'en',
          slugEditor: { en: true, ja: 'readonly' },
        }),
      );
    });

    it('should set slugEditor for localized slug template', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        identifier_field: 'title',
        slug: '{{fields._slug | localize}}',
        _i18n: {
          allLocales: ['en', 'ja'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultLocale: 'en',
          slugEditor: { en: true, ja: true },
        }),
      );
    });

    it('should hide slugEditor for existing entries with canonical slug set', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        slug: '{{fields._slug}}',
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      // Entry has translationKey in content → canonicalSlug path → originalSlugs = { en: '...' }
      const originalEntry = {
        id: 'entry-123',
        locales: {
          en: { content: { translationKey: 'abc123' }, slug: 'existing-slug' },
        },
      };

      createDraft({ collection, originalEntry });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultLocale: 'en',
          slugEditor: { en: false },
        }),
      );
    });

    it('should hide slugEditor for existing entries without canonical slug key', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        slug: '{{fields._slug}}',
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      // Entry does NOT have translationKey → locale-agnostic originalSlugs = { _: 'existing-slug' }
      const originalEntry = {
        id: 'entry-456',
        locales: {
          en: { content: {}, slug: 'existing-slug' },
        },
      };

      createDraft({ collection, originalEntry });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultLocale: 'en',
          slugEditor: { en: false },
        }),
      );
    });

    it('should disable slugEditor for file collections', () => {
      const collection = {
        name: 'pages',
        _type: 'file',
        files: [],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const collectionFile = {
        name: 'about',
        fields: [],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection, collectionFile });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultLocale: 'en',
          slugEditor: { en: false },
        }),
      );
    });

    it('should handle index file', () => {
      const collection = {
        name: 'docs',
        _type: 'entry',
        fields: [{ name: 'title', widget: 'string' }],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const indexFile = {
        fields: [{ name: 'description', widget: 'text' }],
        editor: { preview: false },
      };

      getIndexFile.mockReturnValue(indexFile);

      createDraft({ collection, isIndexFile: true });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isIndexFile: true,
          fields: indexFile.fields,
          defaultLocale: 'en',
          canPreview: false,
        }),
      );
    });

    it('should restore backup if needed', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const originalEntry = {
        id: 'entry-123',
        slug: 'test-slug',
        locales: {
          en: { content: {}, slug: 'test-slug' },
        },
      };

      createDraft({ collection, originalEntry });

      expect(restoreBackupIfNeeded).toHaveBeenCalledWith({
        collectionName: 'posts',
        fileName: undefined,
        slug: 'test-slug',
      });
    });

    it('should handle extra values', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          allLocales: ['en', 'ja'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const extraValues = {
        en: { richTextField: '<p>Rich content</p>' },
        ja: { richTextField: '<p>リッチコンテンツ</p>' },
      };

      createDraft({ collection, extraValues });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          extraValues,
        }),
      );
    });

    it('should use default extra values when not provided', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          allLocales: ['en', 'ja'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          extraValues: { en: {}, ja: {} },
        }),
      );
    });

    it('should handle expander states', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const expanderStates = { en: { section1: true }, _: {} };

      createDraft({ collection, expanderStates });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          expanderStates,
        }),
      );
    });

    it('should use default expander states when not provided', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      createDraft({ collection });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          expanderStates: { _: {} },
        }),
      );
    });

    it('should handle non-canonical slug entries', () => {
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          allLocales: ['en', 'ja'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const originalEntry = {
        id: 'entry-123',
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test Post' },
            slug: 'test-post',
          },
        },
      };

      createDraft({ collection, originalEntry });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultLocale: 'en',
          originalSlugs: { _: 'test-post' },
          currentSlugs: { _: 'test-post' },
        }),
      );
    });

    it('should use ?? {} fallback when default locale content is undefined (line 139)', () => {
      // Covers the `locales?.[defaultLocale]?.content ?? {}` false branch:
      // when the entry exists but the default locale has no content yet.
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          allLocales: ['en', 'ja'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const originalEntry = {
        id: 'entry-456',
        slug: 'test-post',
        locales: {
          // 'en' locale exists but has no 'content' → triggers ?? {} fallback
          en: { slug: 'test-post' },
          ja: { content: { translationKey: 'abc' }, slug: 'test-post' },
        },
      };

      createDraft({ collection, originalEntry });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultLocale: 'en',
          // 'translationKey' not in {} → takes { _: slug } path
          originalSlugs: { _: 'test-post' },
        }),
      );
    });
  });
});
