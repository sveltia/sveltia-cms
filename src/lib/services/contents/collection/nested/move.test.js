// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { isEntryCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { buildNestedMoveChanges } from '$lib/services/contents/collection/nested/move';
import { getPreviousSha } from '$lib/services/contents/draft/save/changes';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import {
  buildSingleFileContent,
  createSyntheticDraft,
  resolveCacheDB,
} from '$lib/services/contents/entry/changes';
import { formatEntryFile } from '$lib/services/contents/file/format';

vi.mock('$lib/services/contents/collection', () => ({
  isEntryCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/draft/save/changes', () => ({
  getPreviousSha: vi.fn(async () => 'sha'),
}));

vi.mock('$lib/services/contents/draft/save/serialize', () => ({
  serializeContent: vi.fn(() => ({ title: 'Serialized' })),
}));

vi.mock('$lib/services/contents/entry/changes', () => ({
  buildSingleFileContent: vi.fn(() => ({ title: 'Single' })),
  createSyntheticDraft: vi.fn(() => ({ synthetic: true })),
  resolveCacheDB: vi.fn(() => undefined),
}));

vi.mock('$lib/services/contents/file/format', () => ({
  formatEntryFile: vi.fn(async () => 'formatted'),
}));

/**
 * Create a single-locale entry.
 * @param {string} id Entry ID.
 * @param {string} subPath Entry’s sub path.
 * @returns {any} Entry.
 */
const entry = (id, subPath) => ({
  id,
  slug: subPath,
  subPath,
  locales: {
    en: { slug: subPath, path: `content/pages/${subPath}.md`, content: { title: subPath } },
  },
});

/** @type {any} */
const collection = {
  name: 'pages',
  folder: 'content/pages',
  nested: {},
  _file: { extension: 'md' },
  _i18n: {
    i18nEnabled: false,
    allLocales: ['en'],
    defaultLocale: 'en',
    structureMap: {},
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isEntryCollection).mockImplementation(
    (_collection) => typeof _collection?.folder === 'string' && !Array.isArray(_collection?.files),
  );
  vi.mocked(getPreviousSha).mockResolvedValue('sha');
  vi.mocked(createSyntheticDraft).mockReturnValue({ synthetic: true });
  vi.mocked(resolveCacheDB).mockReturnValue(undefined);
  vi.mocked(buildSingleFileContent).mockReturnValue({ title: 'Single' });
  vi.mocked(serializeContent).mockReturnValue({ title: 'Serialized' });
  vi.mocked(formatEntryFile).mockResolvedValue('formatted');
});

describe('buildNestedMoveChanges()', () => {
  test('returns nothing for a new entry', async () => {
    expect(
      await buildNestedMoveChanges({
        collection,
        originalEntry: undefined,
        savingEntry: entry('1', 'docs/_index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing for a collection that is not nested', async () => {
    expect(
      await buildNestedMoveChanges({
        collection: { ...collection, nested: undefined },
        originalEntry: entry('1', 'docs/_index'),
        savingEntry: entry('1', 'guides/_index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing when the collection doesn’t use subfolders', async () => {
    expect(
      await buildNestedMoveChanges({
        collection: { ...collection, nested: { subfolders: false } },
        originalEntry: entry('1', 'docs/intro'),
        savingEntry: entry('1', 'guides/intro'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing when the entry is in the collection folder', async () => {
    expect(
      await buildNestedMoveChanges({
        collection,
        originalEntry: entry('1', '_index'),
        savingEntry: entry('1', 'docs/_index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing when the folder hasn’t changed', async () => {
    expect(
      await buildNestedMoveChanges({
        collection,
        originalEntry: entry('1', 'docs/_index'),
        savingEntry: entry('1', 'docs/index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing when the entry would be moved into itself', async () => {
    expect(
      await buildNestedMoveChanges({
        collection,
        originalEntry: entry('1', 'docs/_index'),
        savingEntry: entry('1', 'docs/guides/_index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing when the folder has no other entry', async () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([entry('1', 'docs/_index')]);

    expect(
      await buildNestedMoveChanges({
        collection,
        originalEntry: entry('1', 'docs/_index'),
        savingEntry: entry('1', 'guides/_index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('moves every entry below the folder', async () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([
      entry('1', 'docs/_index'),
      entry('2', 'docs/intro/_index'),
      entry('3', 'docs/intro/deep/_index'),
      entry('4', 'other/_index'),
    ]);

    const { changes, savingEntries } = await buildNestedMoveChanges({
      collection,
      originalEntry: entry('1', 'docs/_index'),
      savingEntry: entry('1', 'guides/manual/_index'),
    });

    expect(changes).toEqual([
      {
        action: 'move',
        slug: 'guides/manual/intro/_index',
        path: 'content/pages/guides/manual/intro/_index.md',
        previousPath: 'content/pages/docs/intro/_index.md',
        previousSha: 'sha',
        data: 'formatted',
      },
      {
        action: 'move',
        slug: 'guides/manual/intro/deep/_index',
        path: 'content/pages/guides/manual/intro/deep/_index.md',
        previousPath: 'content/pages/docs/intro/deep/_index.md',
        previousSha: 'sha',
        data: 'formatted',
      },
    ]);

    expect(savingEntries.map(({ subPath }) => subPath)).toEqual([
      'guides/manual/intro/_index',
      'guides/manual/intro/deep/_index',
    ]);
  });

  test('moves the entries up to the collection folder', async () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([
      entry('1', 'docs/_index'),
      entry('2', 'docs/intro/_index'),
    ]);

    const { changes } = await buildNestedMoveChanges({
      collection,
      originalEntry: entry('1', 'docs/_index'),
      savingEntry: entry('1', '_index'),
    });

    expect(changes[0].path).toBe('content/pages/intro/_index.md');
  });

  test('moves one file per locale with a file-per-locale i18n structure', async () => {
    /** @type {any} */
    const i18nCollection = {
      ...collection,
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: false },
      },
    };

    /**
     * Create an entry with two locales.
     * @param {string} id Entry ID.
     * @param {string} subPath Entry’s sub path.
     * @returns {any} Entry.
     */
    const i18nEntry = (id, subPath) => ({
      id,
      slug: subPath,
      subPath,
      locales: {
        en: { slug: subPath, path: `content/pages/${subPath}.en.md`, content: { title: 'EN' } },
        fr: { slug: subPath, path: `content/pages/${subPath}.fr.md`, content: undefined },
      },
    });

    vi.mocked(getEntriesByCollection).mockReturnValue([
      i18nEntry('1', 'docs/_index'),
      i18nEntry('2', 'docs/intro/_index'),
    ]);

    const { changes } = await buildNestedMoveChanges({
      collection: i18nCollection,
      originalEntry: i18nEntry('1', 'docs/_index'),
      savingEntry: i18nEntry('1', 'guides/_index'),
    });

    // The French file has no content, so it’s left out
    expect(changes).toEqual([
      {
        action: 'move',
        slug: 'guides/intro/_index',
        path: 'content/pages/guides/intro/_index.en.md',
        previousPath: 'content/pages/docs/intro/_index.en.md',
        previousSha: 'sha',
        data: 'formatted',
      },
    ]);
  });
});
