import { beforeEach, describe, expect, test, vi } from 'vitest';

import { buildRenumberChanges, reorderEntries } from '.';

vi.mock('$lib/services/backends', () => ({
  backend: { current: null },
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn().mockResolvedValue({ commit: {}, savedEntries: [], savedAssets: [] }),
}));

vi.mock('$lib/services/contents/collection/data', () => ({
  contentUpdatesToast: { current: null },
  UPDATE_TOAST_DEFAULT_STATE: { count: 0, saved: false, deleted: false },
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  getIndexFile: vi.fn(() => undefined),
  isCollectionIndexFile: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/draft/save/changes', () => ({
  getArrayItemTarget: vi.fn(() => ({})),
}));

vi.mock('$lib/services/contents/draft/save/serialize', () => ({
  serializeContent: vi.fn(({ valueMap }) => ({ ...valueMap })),
}));

vi.mock('$lib/services/contents/file/format', () => ({
  formatEntryFile: vi.fn(async ({ content }) => `formatted:${JSON.stringify(content)}\n`),
}));

vi.mock('@sveltia/utils/storage', () => ({
  // The file cache database the previous SHA of each file is looked up in
  IndexedDB: vi.fn(
    /**
     *
     */
    class {
      get = vi.fn(async () => ({ sha: 'sha-1' }));
    },
  ),
}));

/**
 * Build a minimal entry collection mock for tests.
 * @param {object} [overrides] Optional overrides.
 * @returns {any} Mock collection.
 */
const makeCollection = (overrides = {}) => ({
  name: 'posts',
  reorder: true,
  fields: [{ name: 'title', widget: 'string' }],
  _file: { format: 'yaml' },
  _i18n: {
    i18nEnabled: false,
    allLocales: ['_default'],
    defaultLocale: '_default',
    structureMap: {},
  },
  ...overrides,
});

/**
 * Build a minimal entry mock for tests.
 * @param {string} id Entry id.
 * @param {Record<string, any>} content Default-locale content.
 * @returns {any} Mock entry.
 */
const makeEntry = (id, content) => ({
  id,
  slug: id,
  subPath: id,
  locales: {
    _default: { slug: id, path: `content/${id}.md`, content },
  },
});

/**
 * Build a minimal entry collection mock storing all the entries in one file.
 * @returns {any} Mock collection.
 */
const makeArrayFileCollection = () =>
  makeCollection({
    _type: 'entry',
    file: 'data/items.json',
    _file: { format: 'json', arrayFile: true, fullPath: 'data/items.json' },
  });

/**
 * Build a minimal entry mock stored in a file with the other entries.
 * @param {string} id Entry id.
 * @param {number | undefined} arrayIndex Position in the array.
 * @returns {any} Mock entry.
 */
const makeArrayEntry = (id, arrayIndex) => ({
  id,
  slug: id,
  subPath: id,
  arrayIndex,
  locales: {
    _default: { slug: id, path: 'data/items.json', content: { title: id } },
  },
});

describe('reorderEntries()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns 0 when collection has no reorder config', async () => {
    const collection = makeCollection({ reorder: false });
    const result = await reorderEntries(collection, []);

    expect(result).toBe(0);

    const { saveChanges } = await import('$lib/services/backends/save');

    expect(saveChanges).not.toHaveBeenCalled();
  });

  test('skips entries whose order is already correct', async () => {
    const collection = makeCollection();

    const entries = [
      makeEntry('a', { title: 'A', order: 1 }),
      makeEntry('b', { title: 'B', order: 2 }),
    ];

    const result = await reorderEntries(collection, entries);

    expect(result).toBe(0);

    const { saveChanges } = await import('$lib/services/backends/save');

    expect(saveChanges).not.toHaveBeenCalled();
  });

  test('saves changed entries with updated order field', async () => {
    const collection = makeCollection();

    const entries = [
      makeEntry('b', { title: 'B', order: 2 }),
      makeEntry('a', { title: 'A', order: 1 }),
    ];

    const result = await reorderEntries(collection, entries);

    expect(result).toBe(2);

    const { saveChanges } = await import('$lib/services/backends/save');

    expect(saveChanges).toHaveBeenCalledTimes(1);

    const callArgs = vi.mocked(saveChanges).mock.calls[0][0];

    expect(callArgs.changes).toHaveLength(2);
    expect(callArgs.changes[0]).toMatchObject({
      action: 'update',
      slug: 'b',
      path: 'content/b.md',
    });
    expect(callArgs.savingEntries?.[0].locales._default.content).toMatchObject({
      title: 'B',
      order: 1,
    });
    expect(callArgs.savingEntries?.[1].locales._default.content).toMatchObject({
      title: 'A',
      order: 2,
    });
    expect(callArgs.options.commitType).toBe('update');
  });

  test('uses a custom order key when configured', async () => {
    const collection = makeCollection({ reorder: { key: 'priority' } });
    const entries = [makeEntry('a', { title: 'A' }), makeEntry('b', { title: 'B' })];
    const result = await reorderEntries(collection, entries);

    expect(result).toBe(2);

    const { saveChanges } = await import('$lib/services/backends/save');
    const callArgs = vi.mocked(saveChanges).mock.calls[0][0];

    expect(callArgs.savingEntries?.[0].locales._default.content).toMatchObject({ priority: 1 });
    expect(callArgs.savingEntries?.[1].locales._default.content).toMatchObject({ priority: 2 });
  });

  test('emits one change per locale for multi-file i18n', async () => {
    const collection = makeCollection({
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'ja'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: false },
      },
    });

    const entry = {
      id: 'a',
      slug: 'a',
      subPath: 'a',
      locales: {
        en: { slug: 'a', path: 'content/en/a.md', content: { title: 'A' } },
        ja: { slug: 'a', path: 'content/ja/a.md', content: { title: 'あ' } },
      },
    };

    const result = await reorderEntries(collection, [entry]);

    expect(result).toBe(1);

    const { saveChanges } = await import('$lib/services/backends/save');
    const callArgs = vi.mocked(saveChanges).mock.calls[0][0];

    expect(callArgs.changes).toHaveLength(2);
    expect(callArgs.changes.map((c) => c.path).sort()).toEqual([
      'content/en/a.md',
      'content/ja/a.md',
    ]);
  });

  test('skips locales without content for multi-file i18n', async () => {
    const collection = makeCollection({
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'ja'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: false },
      },
    });

    const entry = {
      id: 'a',
      slug: 'a',
      subPath: 'a',
      locales: {
        en: { slug: 'a', path: 'content/en/a.md', content: { title: 'A' } },
        // `ja` exists but has no content → should be skipped without producing a change
        ja: { slug: 'a', path: 'content/ja/a.md' },
      },
    };

    const result = await reorderEntries(collection, [/** @type {any} */ (entry)]);

    expect(result).toBe(1);

    const { saveChanges } = await import('$lib/services/backends/save');
    const callArgs = vi.mocked(saveChanges).mock.calls[0][0];

    expect(callArgs.changes).toHaveLength(1);
    expect(callArgs.changes[0].path).toBe('content/en/a.md');
  });

  test('produces a single nested-locale change for i18nSingleFile', async () => {
    const collection = makeCollection({
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'ja'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFile: true, i18nSingleFileDefaultRoot: false },
      },
    });

    const entry = {
      id: 'a',
      slug: 'a',
      subPath: 'a',
      locales: {
        en: { slug: 'a', path: 'content/a.md', content: { title: 'A' } },
        ja: { slug: 'a', path: 'content/a.md', content: { title: 'あ' } },
      },
    };

    const result = await reorderEntries(collection, [entry]);

    expect(result).toBe(1);

    const { formatEntryFile } = await import('$lib/services/contents/file/format');

    const formatted = /** @type {any} */ (
      vi.mocked(formatEntryFile).mock.calls.at(-1)?.[0].content
    );

    // Nested locale keys structure: top-level keys are locale codes
    expect(Object.keys(formatted)).toEqual(['en', 'ja']);
    expect(formatted.en).toMatchObject({ title: 'A', order: 1 });
    expect(formatted.ja).toMatchObject({ title: 'あ', order: 1 });
  });

  test('produces a default-root change for i18nSingleFileDefaultRoot', async () => {
    const collection = makeCollection({
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'ja'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: true },
      },
    });

    const entry = {
      id: 'a',
      slug: 'a',
      subPath: 'a',
      locales: {
        en: { slug: 'a', path: 'content/a.md', content: { title: 'A', lang: 'en' } },
        ja: { slug: 'a', path: 'content/a.md', content: { title: 'あ' } },
      },
    };

    const result = await reorderEntries(collection, [entry]);

    expect(result).toBe(1);

    const { formatEntryFile } = await import('$lib/services/contents/file/format');

    const formatted = /** @type {any} */ (
      vi.mocked(formatEntryFile).mock.calls.at(-1)?.[0].content
    );

    // Default-root structure: default locale fields hoisted, plus a `lang` array, plus a `ja` key
    expect(formatted.lang).toEqual(['en', 'ja']);
    expect(formatted).toMatchObject({ title: 'A', order: 1 });
    expect(formatted.ja).toMatchObject({ title: 'あ', order: 1 });
  });

  test('handles a missing default locale in i18nSingleFileDefaultRoot mode', async () => {
    const collection = makeCollection({
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'ja'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: true },
      },
    });

    // The default locale (`en`) has no content → `localeContents[defaultLocale] ?? {}` fallback.
    const entry = {
      id: 'a',
      slug: 'a',
      subPath: 'a',
      locales: {
        en: { slug: 'a', path: 'content/a.md' },
        ja: { slug: 'a', path: 'content/a.md', content: { title: 'あ' } },
      },
    };

    const result = await reorderEntries(collection, [/** @type {any} */ (entry)]);

    expect(result).toBe(1);

    const { formatEntryFile } = await import('$lib/services/contents/file/format');

    const formatted = /** @type {any} */ (
      vi.mocked(formatEntryFile).mock.calls.at(-1)?.[0].content
    );

    expect(formatted.lang).toEqual(['en', 'ja']);
    expect(formatted.ja).toMatchObject({ title: 'あ', order: 1 });
  });

  test('builds one change rewriting the array file in the new order', async () => {
    const collection = makeArrayFileCollection();
    const a = makeArrayEntry('a', 0);
    const b = makeArrayEntry('b', 1);
    const c = makeArrayEntry('c', 2);
    const result = await reorderEntries(collection, [b, a, c]);

    expect(result).toBe(2);

    const { saveChanges } = await import('$lib/services/backends/save');

    expect(saveChanges).toHaveBeenCalledWith({
      changes: [
        {
          action: 'update',
          path: 'data/items.json',
          arrayOrder: [
            { index: 1, locales: b.locales },
            { index: 0, locales: a.locales },
            { index: 2, locales: c.locales },
          ],
        },
      ],
      savingEntries: [b, a],
      options: { commitType: 'update', collection },
    });
  });

  test('does nothing when no entry has moved in the array file', async () => {
    const collection = makeArrayFileCollection();

    const result = await reorderEntries(collection, [
      makeArrayEntry('a', 0),
      makeArrayEntry('b', 1),
    ]);

    expect(result).toBe(0);

    const { saveChanges } = await import('$lib/services/backends/save');

    expect(saveChanges).not.toHaveBeenCalled();
  });

  test('initializes the file cache database when the backend has a databaseName', async () => {
    const { backend } = /** @type {any} */ (await import('$lib/services/backends'));
    const { IndexedDB } = await import('@sveltia/utils/storage');

    backend.current = { repository: { databaseName: 'sveltia-cms-test' } };

    const collection = makeCollection();
    const entries = [makeEntry('a', { title: 'A' })];

    await reorderEntries(collection, entries);

    expect(IndexedDB).toHaveBeenCalledWith('sveltia-cms-test', 'file-cache');

    backend.current = null;
  });
});

describe('buildRenumberChanges()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns empty result when collection is undefined', async () => {
    expect(await buildRenumberChanges(undefined)).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns empty result for non-entry collections', async () => {
    expect(await buildRenumberChanges(/** @type {any} */ ({ _type: 'file' }))).toEqual({
      changes: [],
      savingEntries: [],
    });
  });

  test('returns empty result when reorder is not enabled', async () => {
    const collection = makeCollection({ _type: 'entry', reorder: false });

    expect(await buildRenumberChanges(collection)).toEqual({ changes: [], savingEntries: [] });
  });

  test('builds changes from current collection entries (minus excludeIds) without saving', async () => {
    const { saveChanges } = await import('$lib/services/backends/save');
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');
    const collection = makeCollection({ _type: 'entry' });

    vi.mocked(getEntriesByCollection).mockReturnValueOnce([
      makeEntry('a', { title: 'A', order: 5 }),
      makeEntry('b', { title: 'B', order: 7 }),
      makeEntry('c', { title: 'C', order: 9 }),
    ]);

    const result = await buildRenumberChanges(collection, {
      excludeIds: new Set(['c']),
    });

    expect(result.savingEntries.map((e) => [e.slug, e.locales._default.content.order])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect(result.changes.length).toBeGreaterThan(0);
    // Crucially, no save was triggered.
    expect(saveChanges).not.toHaveBeenCalled();
  });

  test('leaves out the collection’s own index file only, not another one with the same slug', async () => {
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

    const { getIndexFile, isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const collection = makeCollection({ _type: 'entry' });
    const ownIndex = { ...makeEntry('own', { title: 'Home' }), slug: '_index' };
    // Another collection’s index file within this collection’s folder carries the same slug
    const innerIndex = { ...makeEntry('inner', { title: 'Posts', order: 3 }), slug: '_index' };

    vi.mocked(getIndexFile).mockReturnValueOnce(/** @type {any} */ ({ name: '_index' }));
    vi.mocked(isCollectionIndexFile).mockImplementation((_collection, entry) => entry.id === 'own');
    vi.mocked(getEntriesByCollection).mockReturnValueOnce([
      ownIndex,
      makeEntry('a', { title: 'A', order: 1 }),
      innerIndex,
    ]);

    const result = await buildRenumberChanges(collection);

    expect(result.savingEntries.map((e) => [e.id, e.locales._default.content.order])).toEqual([
      ['inner', 2],
    ]);

    vi.mocked(isCollectionIndexFile).mockReset();
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
  });

  test('reuses a caller-provided cacheDB instead of opening a new one', async () => {
    const { IndexedDB } = await import('@sveltia/utils/storage');
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');
    const collection = makeCollection({ _type: 'entry' });

    vi.mocked(getEntriesByCollection).mockReturnValueOnce([
      makeEntry('a', { title: 'A', order: 5 }),
    ]);

    const providedCacheDB = /** @type {any} */ ({ get: vi.fn(), set: vi.fn() });

    await buildRenumberChanges(collection, { cacheDB: providedCacheDB });

    expect(IndexedDB).not.toHaveBeenCalled();
  });

  test('renumbers the entries already rewritten by the same operation', async () => {
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');
    const collection = makeCollection({ _type: 'entry' });

    vi.mocked(getEntriesByCollection).mockReturnValueOnce([
      makeEntry('a', { title: 'A', order: 5 }),
      makeEntry('b', { title: 'B', order: 7 }),
    ]);

    const result = await buildRenumberChanges(collection, {
      updatedEntries: new Map([['b', makeEntry('b', { title: 'B', order: 7, tag: '' })]]),
    });

    // The rewritten entry stands in for the stored one, so the renumbered file carries both updates
    expect(result.savingEntries.map((e) => e.locales._default.content)).toEqual([
      { title: 'A', order: 1 },
      { title: 'B', order: 2, tag: '' },
    ]);
  });
});
