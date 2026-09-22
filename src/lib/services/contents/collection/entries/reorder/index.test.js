import { beforeEach, describe, expect, test, vi } from 'vitest';

import { buildRenumberChanges, reorderEntries, sortEntriesByOrderField } from '.';

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
}));

vi.mock('$lib/services/contents/draft/save/changes', () => ({
  getPreviousSha: vi.fn().mockResolvedValue('sha-1'),
}));

vi.mock('$lib/services/contents/draft/save/serialize', () => ({
  serializeContent: vi.fn(({ valueMap }) => ({ ...valueMap })),
}));

vi.mock('$lib/services/contents/file/format', () => ({
  formatEntryFile: vi.fn(async ({ content }) => `formatted:${JSON.stringify(content)}\n`),
}));

vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: vi.fn(),
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

describe('sortEntriesByOrderField()', () => {
  test('returns a shallow copy unchanged when no order field is configured', () => {
    const entries = [makeEntry('a', { title: 'A' }), makeEntry('b', { title: 'B' })];
    const collection = /** @type {any} */ ({ _i18n: { defaultLocale: '_default' } });
    const sorted = sortEntriesByOrderField(entries, collection);

    expect(sorted).toEqual(entries);
    expect(sorted).not.toBe(entries);
  });

  test('sorts by the order value, with entries lacking one at the end in their input order', () => {
    const unorderedA = makeEntry('x', { title: 'X' });
    const second = makeEntry('b', { title: 'B', order: '2' });
    const unorderedB = makeEntry('y', { title: 'Y', order: 'n/a' });
    const first = makeEntry('a', { title: 'A', order: 1 });

    expect(
      sortEntriesByOrderField([unorderedA, second, unorderedB, first], makeCollection()),
    ).toEqual([first, second, unorderedA, unorderedB]);
  });

  test('moves an entry without an order value after one that comes later with a value', () => {
    // Laid out so the V8 comparator is called with (unordered, ordered), which is the branch the
    // previous test doesn’t reach
    const five = makeEntry('a', { title: 'A', order: 5 });
    const unordered = makeEntry('n', { title: 'N' });
    const three = makeEntry('b', { title: 'B', order: 3 });

    expect(sortEntriesByOrderField([five, unordered, three], makeCollection())).toEqual([
      three,
      five,
      unordered,
    ]);
  });
});
