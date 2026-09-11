// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { isEntryCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { entryDraft } from '$lib/services/contents/draft';
import { getSlugs, hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
import { validatePath } from '$lib/services/contents/draft/validate/path';
import { getUnpublishedEntriesByCollection } from '$lib/services/workflow';

vi.mock('$lib/services/contents/collection', () => ({
  isEntryCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/workflow', () => ({
  getUnpublishedEntriesByCollection: vi.fn(() => []),
  mergeUnpublishedEntries: vi.fn((entries) => entries),
  unpublishedEntries: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/draft/slugs', () => ({
  getSlugs: vi.fn(() => ({ defaultLocaleSlug: 'new-page' })),
  hasLocalizedSlugs: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/draft');

vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return { ...actual, get: vi.fn() };
});

/**
 * Create a nested collection with the path editor enabled.
 * @param {object} [options] Options.
 * @param {boolean} [options.subfolders] Whether the collection uses the `subfolders` mode.
 * @param {boolean} [options.metaPath] Whether the path editor is enabled.
 * @param {string} [options.indexFile] Shared index file name.
 * @returns {any} Collection.
 */
const createCollection = ({ subfolders = true, metaPath = true, indexFile } = {}) => ({
  name: 'pages',
  folder: 'content/pages',
  nested: { subfolders },
  meta: metaPath ? { path: { widget: 'string', index_file: indexFile } } : undefined,
  _i18n: { defaultLocale: 'en', structureMap: {} },
});

/**
 * Make {@link validatePath} read the given draft.
 * @param {any} draft Entry draft.
 */
const setDraft = async (draft) => {
  const { get } = await import('svelte/store');

  vi.mocked(get).mockImplementation((store) => (store === entryDraft ? draft : []));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isEntryCollection).mockImplementation(
    (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
  );
  vi.mocked(getEntriesByCollection).mockReturnValue([]);
  vi.mocked(getUnpublishedEntriesByCollection).mockReturnValue([]);
});

describe('validatePath()', () => {
  test('skips validation when the path editor is disabled', async () => {
    await setDraft({
      collection: createCollection({ metaPath: false }),
      currentLocales: { en: true },
      currentPath: '../escape',
    });

    expect(validatePath()).toEqual({ valid: true, validities: {} });
  });

  test('accepts a plain folder path', async () => {
    await setDraft({
      collection: createCollection(),
      currentLocales: { en: true, fr: true },
      originalPath: 'docs',
      currentPath: '/guides/manual/',
    });

    expect(validatePath()).toEqual({
      valid: true,
      validities: {
        en: {
          _path: {
            patternMismatch: false,
            customError: false,
            duplicateError: false,
            valid: true,
          },
        },
        fr: {
          _path: {
            patternMismatch: false,
            customError: false,
            duplicateError: false,
            valid: true,
          },
        },
      },
    });
  });

  test('accepts the collection’s root folder', async () => {
    await setDraft({
      collection: createCollection(),
      currentLocales: { en: true },
      originalPath: 'docs',
      currentPath: '',
    });

    expect(validatePath().valid).toBe(true);
  });

  test('treats an unset path as the root folder', async () => {
    await setDraft({
      collection: createCollection(),
      currentLocales: { en: true },
      originalPath: undefined,
      currentPath: undefined,
    });

    expect(validatePath().valid).toBe(true);
  });

  test.each(['..', '../escape', 'docs/../escape', 'docs/.', './docs'])(
    'rejects the relative path %s',
    async (currentPath) => {
      await setDraft({
        collection: createCollection(),
        currentLocales: { en: true },
        originalPath: 'docs',
        currentPath,
      });

      const { valid, validities } = validatePath();

      expect(valid).toBe(false);
      expect(validities.en._path.patternMismatch).toBe(true);
    },
  );

  test('rejects a path with a backslash', async () => {
    await setDraft({
      collection: createCollection(),
      currentLocales: { en: true },
      originalPath: 'docs',
      currentPath: 'docs\\guides',
    });

    expect(validatePath().validities.en._path.patternMismatch).toBe(true);
  });

  test('rejects moving a folder into one of its own subfolders', async () => {
    await setDraft({
      collection: createCollection(),
      currentLocales: { en: true },
      originalPath: 'docs',
      currentPath: 'docs/guides',
    });

    const { valid, validities } = validatePath();

    expect(valid).toBe(false);
    expect(validities.en._path.customError).toBe(true);
  });

  test('allows the same move without the `subfolders` mode', async () => {
    await setDraft({
      collection: createCollection({ subfolders: false }),
      currentLocales: { en: true },
      originalPath: 'docs',
      currentPath: 'docs/guides',
    });

    expect(validatePath().valid).toBe(true);
  });

  test('allows a new entry in any folder', async () => {
    await setDraft({
      collection: createCollection(),
      currentLocales: { en: true },
      originalPath: '',
      currentPath: 'docs/guides',
    });

    expect(validatePath().valid).toBe(true);
  });
  describe('duplicate destinations', () => {
    test('rejects moving an entry onto a folder that another entry owns', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue(
        /** @type {any} */ ([{ id: 'other', subPath: 'docs/_index' }]),
      );

      await setDraft({
        collection: createCollection({ indexFile: '_index' }),
        currentLocales: { en: true },
        isNew: false,
        originalEntry: { id: 'self', subPath: 'guides/_index' },
        originalPath: 'guides',
        currentPath: 'docs',
      });

      const { valid, validities } = validatePath();

      expect(valid).toBe(false);
      expect(validities.en._path.duplicateError).toBe(true);
    });

    test('rejects a new entry whose own folder is already taken', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue(
        /** @type {any} */ ([{ id: 'other', subPath: 'docs/new-page/_index' }]),
      );

      await setDraft({
        collection: createCollection({ indexFile: '_index' }),
        currentLocales: { en: true },
        isNew: true,
        originalEntry: undefined,
        originalPath: 'docs',
        currentPath: 'docs',
      });

      expect(validatePath().validities.en._path.duplicateError).toBe(true);
    });

    test('accepts a new entry in a folder that already holds an entry of its own', async () => {
      // The chosen folder is where the entry is created, so the folder’s own entry is no conflict
      vi.mocked(getEntriesByCollection).mockReturnValue(
        /** @type {any} */ ([{ id: 'other', subPath: 'docs/_index' }]),
      );

      await setDraft({
        collection: createCollection({ indexFile: '_index' }),
        currentLocales: { en: true },
        isNew: true,
        originalEntry: undefined,
        originalPath: 'docs',
        currentPath: 'docs',
      });

      expect(validatePath().valid).toBe(true);
    });

    test('rejects a destination already claimed by an unpublished entry', async () => {
      // The published tree is still clear, but a draft awaiting review has taken the folder
      vi.mocked(getEntriesByCollection).mockReturnValue([]);
      vi.mocked(getUnpublishedEntriesByCollection).mockReturnValue(
        /** @type {any} */ ([{ id: 'other', subPath: 'docs/_index' }]),
      );

      await setDraft({
        collection: createCollection({ indexFile: '_index' }),
        currentLocales: { en: true },
        isNew: false,
        originalEntry: { id: 'self', subPath: 'guides/_index' },
        originalPath: 'guides',
        currentPath: 'docs',
      });

      expect(validatePath().validities.en._path.duplicateError).toBe(true);
    });

    test('ignores the entry being edited', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue(
        /** @type {any} */ ([{ id: 'self', subPath: 'docs/_index' }]),
      );

      await setDraft({
        id: 'self',
        collection: createCollection({ indexFile: '_index' }),
        currentLocales: { en: true },
        isNew: false,
        originalEntry: { id: 'self', subPath: 'docs/_index' },
        originalPath: 'docs',
        currentPath: 'docs',
      });

      expect(validatePath().valid).toBe(true);
    });

    test('ignores a new entry that has just been saved as a draft', async () => {
      // With Editorial Workflow the entry lands in the unpublished list under the draft’s ID as
      // soon as it’s saved, and the draft — still marked new, with no original entry — is validated
      // once more to decide whether to offer sending it for review
      vi.mocked(getUnpublishedEntriesByCollection).mockReturnValue(
        /** @type {any} */ ([{ id: 'self', subPath: 'docs/new-page/_index' }]),
      );

      await setDraft({
        id: 'self',
        collection: createCollection({ indexFile: '_index' }),
        currentLocales: { en: true },
        isNew: true,
        originalEntry: undefined,
        originalPath: '',
        currentPath: 'docs',
      });

      expect(validatePath().valid).toBe(true);
    });

    test('checks every locale’s destination when the folders are localized', async () => {
      // @see https://github.com/sveltia/sveltia-cms/issues/962
      vi.mocked(hasLocalizedSlugs).mockReturnValue(true);
      vi.mocked(getSlugs).mockReturnValue({
        defaultLocaleSlug: 'history',
        localizedSlugs: { en: 'history', fr: 'equipe' },
      });
      vi.mocked(getEntriesByCollection).mockReturnValue(
        /** @type {any} */ ([
          {
            id: 'parent',
            subPath: 'about/_index',
            locales: { en: { slug: 'about/_index' }, fr: { slug: 'a-propos/_index' } },
          },
          {
            id: 'other',
            subPath: 'about/team/_index',
            locales: { en: { slug: 'about/team/_index' }, fr: { slug: 'a-propos/equipe/_index' } },
          },
        ]),
      );

      await setDraft({
        collection: createCollection({ indexFile: '_index' }),
        currentLocales: { en: true, fr: true },
        isNew: true,
        originalEntry: undefined,
        originalPath: 'about',
        currentPath: 'about',
      });

      // `about/history` is free, but `a-propos/equipe` is taken
      expect(validatePath().validities.fr._path.duplicateError).toBe(true);
    });

    test('skips the check when each entry has a file name of its own', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue(
        /** @type {any} */ ([{ id: 'other', subPath: 'docs/_index' }]),
      );

      await setDraft({
        collection: createCollection({ subfolders: false, indexFile: '_index' }),
        currentLocales: { en: true },
        isNew: true,
        originalEntry: undefined,
        originalPath: '',
        currentPath: 'docs',
      });

      expect(validatePath().valid).toBe(true);
    });
  });
});
