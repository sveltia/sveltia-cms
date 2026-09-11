// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  getIndexFile: vi.fn(),
  isCollectionIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/draft', () => ({
  revokeDraftFileURLs: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/backup', () => ({
  restoreBackupIfNeeded: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/create/proxy.svelte', () => ({
  createProxy: vi.fn((args) => args.target),
}));

// `populateDefaultValue` is kept intact because `normalizeContentMap()` relies on it to fill in the
// values missing from an existing entry
vi.mock('$lib/services/contents/draft/defaults', async (importOriginal) => ({
  ...(await importOriginal()),
  getDefaultValues: vi.fn(),
}));

// Import mocked modules once at the top level
const { getIndexFile, isCollectionIndexFile } =
  await import('$lib/services/contents/collection/entries/index-file');

const { revokeDraftFileURLs } = await import('$lib/services/contents/draft');
const { restoreBackupIfNeeded } = await import('$lib/services/contents/draft/backup');
const { createProxy } = await import('$lib/services/contents/draft/create/proxy.svelte');
const { getDefaultValues } = await import('$lib/services/contents/draft/defaults');
const { cmsConfig } = await import('$lib/services/config');
const { nestedFilterPath } = await import('$lib/services/contents/collection/nested');
const { createDraft, getOriginalPath, getSlugEditorProp } = await import('.');
/**
 * Fake entry draft state.
 * @type {{ current: any }}
 */
let entryDraft;

describe('contents/draft/create/index', () => {
  describe('getOriginalPath', () => {
    /**
     * Create an entry collection with the `meta.path` option enabled.
     * @param {boolean} [metaPath] Whether the path editor is enabled.
     * @returns {any} Collection.
     */
    const createCollection = (metaPath = true) => ({
      _type: 'entry',
      name: 'pages',
      folder: 'content/pages',
      nested: {},
      meta: metaPath ? { path: { widget: 'string' } } : undefined,
    });

    beforeEach(() => {
      nestedFilterPath.current = '';
    });

    it('should return undefined when the path editor is disabled', () => {
      expect(
        getOriginalPath({ collection: createCollection(false), originalEntry: {} }),
      ).toBeUndefined();
    });

    it('should return the folder of an existing entry', () => {
      expect(
        getOriginalPath({
          collection: createCollection(),
          originalEntry: { subPath: 'docs/guides/_index' },
        }),
      ).toBe('docs/guides');
    });

    it('should use the given initial path for a new entry', () => {
      expect(
        getOriginalPath({
          collection: createCollection(),
          originalEntry: {},
          initialPath: '/docs/guides/',
        }),
      ).toBe('docs/guides');
    });

    it('should fall back to the folder being browsed', () => {
      nestedFilterPath.current = 'docs';

      expect(getOriginalPath({ collection: createCollection(), originalEntry: {} })).toBe('docs');
    });
  });

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

    entryDraft = { current: undefined };

    // Setup default mocks
    isCollectionIndexFile.mockReturnValue(false);
    getIndexFile.mockReturnValue(undefined);
    createProxy.mockImplementation((args) => args.target);
    getDefaultValues.mockReturnValue({});

    cmsConfig.current = /** @type {any} */ ({ editor: { preview: true } });
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

      createDraft({ entryDraft, collection });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection, originalEntry });

      expect(entryDraft.current).toEqual(
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

    it('should fill in the values missing from an existing entry', () => {
      // https://github.com/sveltia/sveltia-cms/issues/395
      // https://github.com/sveltia/sveltia-cms/issues/650
      const collection = {
        name: 'posts',
        _type: 'entry',
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'chargeSpeed', widget: 'select', options: ['slow', 'fast'] },
          { name: 'aBoolean', widget: 'boolean', required: false, default: true },
        ],
        _i18n: {
          allLocales: ['en'],
          initialLocales: ['en'],
          defaultLocale: 'en',
          canonicalSlug: { key: 'translationKey' },
        },
      };

      const originalEntry = {
        id: 'entry-123',
        slug: 'test-post',
        locales: { en: { content: { title: 'Test Post' }, slug: 'test-post' } },
      };

      createDraft({ entryDraft, collection, originalEntry });

      const expectedValues = { title: 'Test Post', chargeSpeed: '', aBoolean: true };

      expect(entryDraft.current).toEqual(
        expect.objectContaining({
          originalValues: { en: expectedValues },
          currentValues: { en: expectedValues },
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

      createDraft({ entryDraft, collection, collectionFile });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection, collectionFile });

      expect(entryDraft.current).toEqual(
        expect.objectContaining({
          canPreview: false,
        }),
      );
    });

    it('should use true fallback when no editor.preview is set anywhere (line 120)', () => {
      // Covers the `true` fallback: when none of indexFile/collectionFile/collection/cmsConfig
      // define editor.preview, the ?? chain falls all the way to `true`.
      // No editor property → cmsConfig?.editor?.preview = undefined
      cmsConfig.current = /** @type {any} */ ({});

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

      createDraft({ entryDraft, collection });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection });

      expect(createProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: entryDraft.current,
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

      createDraft({ entryDraft, collection, dynamicValues });

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

      createDraft({ entryDraft, collection });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection, originalEntry });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection, originalEntry });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection, collectionFile });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection, isIndexFile: true });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection, originalEntry });

      expect(restoreBackupIfNeeded).toHaveBeenCalledWith({ draft: entryDraft.current });
    });

    it('should replace the outgoing draft, releasing its file URLs', () => {
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

      const outgoingDraft = { files: { 'blob:one': {} } };

      entryDraft.current = outgoingDraft;

      const draft = createDraft({ entryDraft, collection });

      expect(revokeDraftFileURLs).toHaveBeenCalledWith(outgoingDraft);
      expect(entryDraft.current).toBe(draft);
      expect(draft.interacted).toBe(false);
    });

    it('should not restore a backup for an entry awaiting deletion', () => {
      const collection = /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        fields: [],
        _i18n: {
          i18nEnabled: false,
          allLocales: ['_default'],
          initialLocales: ['_default'],
          defaultLocale: '_default',
          canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
        },
      });

      const originalEntry = /** @type {any} */ ({
        id: 'entry-123',
        slug: 'test-slug',
        locales: { _default: { content: {}, slug: 'test-slug' } },
        // The entry is read-only, so a cached draft could neither be restored nor saved
        workflow: { status: 'pending_deletion' },
      });

      createDraft({ entryDraft, collection, originalEntry });

      expect(restoreBackupIfNeeded).not.toHaveBeenCalled();
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

      createDraft({ entryDraft, collection, extraValues });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection, expanderStates });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection, originalEntry });

      expect(entryDraft.current).toEqual(
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

      createDraft({ entryDraft, collection, originalEntry });

      expect(entryDraft.current).toEqual(
        expect.objectContaining({
          defaultLocale: 'en',
          // 'translationKey' not in {} → takes { _: slug } path
          originalSlugs: { _: 'test-post' },
        }),
      );
    });
  });
});
