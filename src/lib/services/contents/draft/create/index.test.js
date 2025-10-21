// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('$lib/services/config', () => ({
  siteConfig: { subscribe: vi.fn() },
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
const { getIndexFile, isCollectionIndexFile } = await import(
  '$lib/services/contents/collection/index-file'
);

const { entryDraft } = await import('$lib/services/contents/draft');
const { restoreBackupIfNeeded } = await import('$lib/services/contents/draft/backup');
const { createProxy } = await import('$lib/services/contents/draft/create/proxy');
const { getDefaultValues } = await import('$lib/services/contents/draft/defaults');
const { siteConfig } = await import('$lib/services/config');
const { createDraft } = await import('./index.js');

describe('contents/draft/create/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    isCollectionIndexFile.mockReturnValue(false);
    getIndexFile.mockReturnValue(undefined);
    createProxy.mockImplementation((args) => args.target);
    getDefaultValues.mockReturnValue({});

    siteConfig.subscribe.mockImplementation((callback) => {
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

      expect(getDefaultValues).toHaveBeenCalledWith(collection.fields, 'en', dynamicValues);
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
          slugEditor: { en: true, ja: true },
        }),
      );
    });

    it('should disable slugEditor for existing entries', () => {
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

      const originalEntry = {
        id: 'entry-123',
        locales: {
          en: { content: {}, slug: 'existing-slug' },
        },
      };

      createDraft({ collection, originalEntry });

      expect(entryDraft.set).toHaveBeenCalledWith(
        expect.objectContaining({
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
          originalSlugs: { _: 'test-post' },
          currentSlugs: { _: 'test-post' },
        }),
      );
    });
  });
});
