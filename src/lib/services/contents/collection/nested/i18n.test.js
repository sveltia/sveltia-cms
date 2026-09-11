// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { isEntryCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import {
  getFolderName,
  getOwnFolderName,
  hasLocalizedFolders,
  localizeDirPath,
} from '$lib/services/contents/collection/nested/i18n';
import { mergeUnpublishedEntries } from '$lib/services/workflow';

vi.mock('$lib/services/contents/collection', () => ({
  isEntryCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/workflow', () => ({
  mergeUnpublishedEntries: vi.fn((entries, drafts) => [...entries, ...drafts]),
  unpublishedEntries: { subscribe: vi.fn() },
}));

vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return { ...actual, get: vi.fn(() => []) };
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

/**
 * Create a nested collection with localized slugs.
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
  },
  ...overrides,
});

const entries = [
  entry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
  entry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' }),
  entry('3', { en: 'products/_index' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isEntryCollection).mockImplementation(
    (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
  );
  vi.mocked(getEntriesByCollection).mockReturnValue(entries);
  vi.mocked(mergeUnpublishedEntries).mockImplementation((_entries, drafts) => [
    ..._entries,
    ...drafts,
  ]);
});

describe('getFolderName()', () => {
  test('returns the last segment', () => {
    expect(getFolderName('about/team')).toBe('team');
    expect(getFolderName('about')).toBe('about');
    expect(getFolderName('')).toBe('');
  });
});

describe('getOwnFolderName()', () => {
  test('returns the folder the index file is in', () => {
    expect(getOwnFolderName('about/team/_index')).toBe('team');
    expect(getOwnFolderName('about/_index')).toBe('about');
  });

  test('returns nothing for a file in the collection folder', () => {
    expect(getOwnFolderName('_index')).toBe('');
  });
});

describe('hasLocalizedFolders()', () => {
  test('is true for a nested collection with an index file and localized slugs', () => {
    expect(hasLocalizedFolders(createCollection())).toBe(true);
  });

  test('is false without the nested option', () => {
    expect(hasLocalizedFolders(createCollection({ nested: undefined }))).toBe(false);
  });

  test('is false without an index file name', () => {
    expect(hasLocalizedFolders(createCollection({ meta: { path: {} } }))).toBe(false);
    expect(hasLocalizedFolders(createCollection({ meta: undefined }))).toBe(false);
  });

  test('is false when the slugs are not localized', () => {
    expect(hasLocalizedFolders(createCollection({ slug: '{{title}}' }))).toBe(false);
    expect(
      hasLocalizedFolders(
        createCollection({
          _i18n: { defaultLocale: 'en', structureMap: { i18nSingleFile: true } },
        }),
      ),
    ).toBe(false);
  });
});

describe('localizeDirPath()', () => {
  test('swaps each folder for the one its entry has in the locale', () => {
    expect(
      localizeDirPath({ collection: createCollection(), dirPath: 'about', locale: 'fr' }),
    ).toBe('a-propos');
    expect(
      localizeDirPath({ collection: createCollection(), dirPath: '/about/team/', locale: 'fr' }),
    ).toBe('a-propos/equipe');
  });

  test('keeps a folder whose entry lacks the locale', () => {
    expect(
      localizeDirPath({ collection: createCollection(), dirPath: 'products', locale: 'fr' }),
    ).toBe('products');
  });

  test('keeps a folder that has no entry', () => {
    expect(
      localizeDirPath({ collection: createCollection(), dirPath: 'about/news', locale: 'fr' }),
    ).toBe('a-propos/news');
  });

  test('keeps the path for the default locale', () => {
    expect(
      localizeDirPath({ collection: createCollection(), dirPath: '/about/', locale: 'en' }),
    ).toBe('about');
  });

  test('keeps the path when the folders are not localized', () => {
    expect(
      localizeDirPath({
        collection: createCollection({ slug: '{{title}}' }),
        dirPath: 'about',
        locale: 'fr',
      }),
    ).toBe('about');
  });

  test('returns an empty string for the collection folder', () => {
    expect(localizeDirPath({ collection: createCollection(), dirPath: '', locale: 'fr' })).toBe('');
  });

  test('looks the folders up in the given entries', () => {
    expect(
      localizeDirPath({
        collection: createCollection(),
        dirPath: 'about',
        locale: 'fr',
        entries: [entry('9', { en: 'about/_index', fr: 'qui-sommes-nous/_index' })],
      }),
    ).toBe('qui-sommes-nous');
    expect(getEntriesByCollection).not.toHaveBeenCalled();
  });

  test('counts the unpublished entries', async () => {
    const { get } = await import('svelte/store');

    vi.mocked(getEntriesByCollection).mockReturnValue([]);
    vi.mocked(get).mockReturnValue([
      {
        ...entry('9', { en: 'docs/_index', fr: 'documentation/_index' }),
        workflow: { collectionName: 'pages' },
      },
      {
        ...entry('10', { en: 'docs/_index', fr: 'autre/_index' }),
        workflow: { collectionName: 'x' },
      },
    ]);

    expect(localizeDirPath({ collection: createCollection(), dirPath: 'docs', locale: 'fr' })).toBe(
      'documentation',
    );
  });

  test('uses the index file in a collection without the subfolders mode', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([
      entry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
      entry('2', { en: 'about/team', fr: 'a-propos/equipe' }),
    ]);

    expect(
      localizeDirPath({
        collection: createCollection({ nested: { subfolders: false } }),
        dirPath: 'about',
        locale: 'fr',
      }),
    ).toBe('a-propos');
  });
});
