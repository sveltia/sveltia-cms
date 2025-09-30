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

describe('contents/draft/create/index', () => {
  /** @type {any} */
  let mockEntryDraftSet;
  /** @type {any} */
  let mockGetIndexFile;
  /** @type {any} */
  let mockIsCollectionIndexFile;
  /** @type {any} */
  let mockRestoreBackupIfNeeded;
  /** @type {any} */
  let mockCreateProxy;
  /** @type {any} */
  let mockGetDefaultValues;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked modules
    const { getIndexFile, isCollectionIndexFile } = await import(
      '$lib/services/contents/collection/index-file'
    );

    const { entryDraft } = await import('$lib/services/contents/draft');
    const { restoreBackupIfNeeded } = await import('$lib/services/contents/draft/backup');
    const { createProxy } = await import('$lib/services/contents/draft/create/proxy');
    const { getDefaultValues } = await import('$lib/services/contents/draft/defaults');
    const { siteConfig } = await import('$lib/services/config');

    mockEntryDraftSet = entryDraft.set;
    mockGetIndexFile = getIndexFile;
    mockIsCollectionIndexFile = isCollectionIndexFile;
    mockRestoreBackupIfNeeded = restoreBackupIfNeeded;
    mockCreateProxy = createProxy;
    mockGetDefaultValues = getDefaultValues;

    // Setup default mocks
    mockIsCollectionIndexFile.mockReturnValue(false);
    mockGetIndexFile.mockReturnValue(undefined);
    mockCreateProxy.mockImplementation((/** @type {any} */ args) => args.target);
    mockGetDefaultValues.mockReturnValue({});

    siteConfig.subscribe.mockImplementation((/** @type {any} */ callback) => {
      callback({ editor: { preview: true } });

      return vi.fn();
    });
  });

  describe('createDraft', () => {
    it('should create a new entry draft', async () => {
      const { createDraft } = await import('./index.js');

      /** @type {any} */
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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'posts',
          isNew: true,
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

    it('should create draft for existing entry', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'posts',
          isNew: false,
          originalEntry,
          originalLocales: { en: true, ja: true },
          currentLocales: { en: true, ja: true },
          originalSlugs: { en: 'test-post', ja: 'test-post' },
          currentSlugs: { en: 'test-post', ja: 'test-post' },
        }),
      );
    });

    it('should handle file collection', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'pages',
          fileName: 'about',
          fields: collectionFile.fields,
        }),
      );
    });

    it('should set canPreview from collection config', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          canPreview: false,
        }),
      );
    });

    it('should set canPreview from collectionFile config', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          canPreview: false,
        }),
      );
    });

    it('should use initial locales for new entry', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          originalLocales: { en: true, fr: true, ja: false },
          currentLocales: { en: true, fr: true, ja: false },
        }),
      );
    });

    it('should create proxies for currentValues', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockCreateProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
          locale: 'en',
        }),
      );
    });

    it('should handle dynamic default values', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockGetDefaultValues).toHaveBeenCalledWith(collection.fields, 'en', dynamicValues);
    });

    it('should set slugEditor for entry collection with {{fields._slug}} template', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          slugEditor: { en: true, ja: 'readonly' },
        }),
      );
    });

    it('should set slugEditor for localized slug template', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          slugEditor: { en: true, ja: true },
        }),
      );
    });

    it('should disable slugEditor for existing entries', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          slugEditor: { en: false },
        }),
      );
    });

    it('should disable slugEditor for file collections', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          slugEditor: { en: false },
        }),
      );
    });

    it('should handle index file', async () => {
      const { createDraft } = await import('./index.js');

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

      mockGetIndexFile.mockReturnValue(indexFile);

      createDraft({ collection, isIndexFile: true });

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isIndexFile: true,
          fields: indexFile.fields,
          canPreview: false,
        }),
      );
    });

    it('should restore backup if needed', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockRestoreBackupIfNeeded).toHaveBeenCalledWith({
        collectionName: 'posts',
        fileName: undefined,
        slug: 'test-slug',
      });
    });

    it('should handle expander states', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          expanderStates,
        }),
      );
    });

    it('should use default expander states when not provided', async () => {
      const { createDraft } = await import('./index.js');

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

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          expanderStates: { _: {} },
        }),
      );
    });

    it('should handle non-canonical slug entries', async () => {
      const { createDraft } = await import('./index.js');

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
            content: { title: 'Test Post' }, // No translationKey
            slug: 'test-post',
          },
        },
      };

      createDraft({ collection, originalEntry });

      expect(mockEntryDraftSet).toHaveBeenCalledWith(
        expect.objectContaining({
          originalSlugs: { _: 'test-post' },
          currentSlugs: { _: 'test-post' },
        }),
      );
    });
  });
});
