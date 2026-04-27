import { writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  buildRenumberChanges,
  getOrderFieldKey,
  renumberCollectionEntries,
  reorderEntries,
  sortEntriesByOrderField,
} from './reorder';

vi.mock('$lib/services/backends', () => ({
  backend: writable(null),
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn().mockResolvedValue({ commit: {}, savedEntries: [], savedAssets: [] }),
}));

vi.mock('$lib/services/contents/collection/data', () => ({
  contentUpdatesToast: writable(null),
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

describe('getOrderFieldKey()', () => {
  test('returns undefined when reorder is not configured', () => {
    expect(getOrderFieldKey({})).toBeUndefined();
    expect(getOrderFieldKey({ reorder: false })).toBeUndefined();
    expect(getOrderFieldKey(undefined)).toBeUndefined();
  });

  test('returns the default key when reorder is true', () => {
    expect(getOrderFieldKey({ reorder: true })).toBe('order');
  });

  test('returns the configured key when reorder.key is set', () => {
    expect(getOrderFieldKey({ reorder: { key: 'priority' } })).toBe('priority');
  });

  test('falls back to the default key when reorder.key is empty', () => {
    expect(getOrderFieldKey({ reorder: { key: '' } })).toBe('order');
  });
});

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

  test('does not update the toast when called with silent option', async () => {
    const { contentUpdatesToast } = await import('$lib/services/contents/collection/data');

    contentUpdatesToast.set(/** @type {any} */ ({ marker: 'untouched' }));

    const collection = makeCollection();

    const entries = [
      makeEntry('b', { title: 'B', order: 2 }),
      makeEntry('a', { title: 'A', order: 1 }),
    ];

    await reorderEntries(collection, entries, { silent: true });

    // Toast store should not have been updated.
    let value;

    contentUpdatesToast.subscribe((v) => {
      value = v;
    })();

    expect(value).toEqual({ marker: 'untouched' });
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

    backend.set({ repository: { databaseName: 'sveltia-cms-test' } });

    const collection = makeCollection();
    const entries = [makeEntry('a', { title: 'A' })];

    await reorderEntries(collection, entries);

    expect(IndexedDB).toHaveBeenCalledWith('sveltia-cms-test', 'file-cache');

    backend.set(null);
  });
});

describe('renumberCollectionEntries()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns 0 when collection is undefined', async () => {
    expect(await renumberCollectionEntries(undefined)).toBe(0);
  });

  test('returns 0 for non-entry collections', async () => {
    expect(await renumberCollectionEntries(/** @type {any} */ ({ _type: 'file' }))).toBe(0);
  });

  test('returns 0 when reorder is not enabled', async () => {
    const collection = makeCollection({ _type: 'entry', reorder: false });

    expect(await renumberCollectionEntries(collection)).toBe(0);
  });

  test('compacts gaps in the order field', async () => {
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

    vi.mocked(getEntriesByCollection).mockReturnValue([
      makeEntry('a', { title: 'A', order: 1 }),
      makeEntry('c', { title: 'C', order: 5 }),
      makeEntry('b', { title: 'B', order: 3 }),
    ]);

    const collection = makeCollection({ _type: 'entry' });
    const result = await renumberCollectionEntries(collection);

    // a stays at 1; b moves 3→2; c moves 5→3 → 2 entries updated.
    expect(result).toBe(2);

    const { saveChanges } = await import('$lib/services/backends/save');
    const callArgs = vi.mocked(saveChanges).mock.calls[0][0];

    expect(callArgs.savingEntries?.map((e) => e.locales._default.content.order)).toEqual([2, 3]);
    expect(callArgs.savingEntries?.map((e) => e.slug)).toEqual(['b', 'c']);
  });

  test('places entries without a numeric order at the end', async () => {
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

    vi.mocked(getEntriesByCollection).mockReturnValue([
      makeEntry('noord1', { title: 'N1' }),
      makeEntry('a', { title: 'A', order: 2 }),
      makeEntry('noord2', { title: 'N2' }),
      makeEntry('b', { title: 'B', order: 4 }),
    ]);

    const collection = makeCollection({ _type: 'entry' });

    await renumberCollectionEntries(collection);

    const { saveChanges } = await import('$lib/services/backends/save');
    const callArgs = vi.mocked(saveChanges).mock.calls[0][0];

    // Numeric-ordered entries first (a→1, b→2), then unordered ones (noord1→3, noord2→4).
    expect(callArgs.savingEntries?.map((e) => [e.slug, e.locales._default.content.order])).toEqual([
      ['a', 1],
      ['b', 2],
      ['noord1', 3],
      ['noord2', 4],
    ]);
  });

  test('returns 0 and does not save when nothing changes', async () => {
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

    vi.mocked(getEntriesByCollection).mockReturnValue([
      makeEntry('a', { title: 'A', order: 1 }),
      makeEntry('b', { title: 'B', order: 2 }),
    ]);

    const collection = makeCollection({ _type: 'entry' });
    const result = await renumberCollectionEntries(collection);

    expect(result).toBe(0);

    const { saveChanges } = await import('$lib/services/backends/save');

    expect(saveChanges).not.toHaveBeenCalled();
  });

  test('preserves the original order of entries that all lack a numeric order', async () => {
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

    vi.mocked(getEntriesByCollection).mockReturnValue([
      makeEntry('x', { title: 'X' }),
      makeEntry('y', { title: 'Y' }),
      makeEntry('z', { title: 'Z' }),
    ]);

    const collection = makeCollection({ _type: 'entry' });

    await renumberCollectionEntries(collection);

    const { saveChanges } = await import('$lib/services/backends/save');
    const callArgs = vi.mocked(saveChanges).mock.calls[0][0];

    // The sort comparator returns 0 for these pairs; iteration order is preserved (1, 2, 3).
    expect(callArgs.savingEntries?.map((e) => [e.slug, e.locales._default.content.order])).toEqual([
      ['x', 1],
      ['y', 2],
      ['z', 3],
    ]);
  });

  test('moves entries without a numeric order after ordered ones via the bHas comparator branch', async () => {
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

    // Layout chosen so the v8 sort comparator is called with (noord, withOrder=3),
    // exercising the `if (bHas) return 1` branch.
    vi.mocked(getEntriesByCollection).mockReturnValue([
      makeEntry('a', { title: 'A', order: 5 }),
      makeEntry('noord', { title: 'N' }),
      makeEntry('b', { title: 'B', order: 3 }),
    ]);

    const collection = makeCollection({ _type: 'entry' });

    await renumberCollectionEntries(collection);

    const { saveChanges } = await import('$lib/services/backends/save');
    const callArgs = vi.mocked(saveChanges).mock.calls[0][0];

    expect(callArgs.savingEntries?.map((e) => [e.slug, e.locales._default.content.order])).toEqual([
      ['b', 1],
      ['a', 2],
      ['noord', 3],
    ]);
  });

  test('excludes the index file from numbering', async () => {
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');
    const { getIndexFile } = await import('$lib/services/contents/collection/entries/index-file');

    vi.mocked(getIndexFile).mockReturnValueOnce(/** @type {any} */ ({ name: '_index' }));
    vi.mocked(getEntriesByCollection).mockReturnValue([
      makeEntry('_index', { title: 'Index', order: 99 }),
      makeEntry('a', { title: 'A', order: 5 }),
      makeEntry('b', { title: 'B', order: 7 }),
    ]);

    const collection = makeCollection({ _type: 'entry' });

    await renumberCollectionEntries(collection);

    const { saveChanges } = await import('$lib/services/backends/save');
    const callArgs = vi.mocked(saveChanges).mock.calls[0][0];

    // Only `a` and `b` should be renumbered to 1 and 2; `_index` is left alone.
    expect(callArgs.savingEntries?.map((e) => e.slug)).toEqual(['a', 'b']);
    expect(callArgs.savingEntries?.map((e) => e.locales._default.content.order)).toEqual([1, 2]);
  });

  test('does not produce a commit when string-typed order matches the target number', async () => {
    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

    // Order is stored as strings (e.g. coming from a number field saved as text). The compacted
    // sequence is already 1,2 — so nothing needs to change.
    vi.mocked(getEntriesByCollection).mockReturnValue([
      makeEntry('a', { title: 'A', order: '1' }),
      makeEntry('b', { title: 'B', order: '2' }),
    ]);

    const collection = makeCollection({ _type: 'entry' });
    const result = await renumberCollectionEntries(collection);

    expect(result).toBe(0);

    const { saveChanges } = await import('$lib/services/backends/save');

    expect(saveChanges).not.toHaveBeenCalled();
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
});

describe('sortEntriesByOrderField()', () => {
  test('returns a shallow copy unchanged when no order field is configured', () => {
    const entries = [makeEntry('a', { title: 'A' }), makeEntry('b', { title: 'B' })];
    const collection = /** @type {any} */ ({ _i18n: { defaultLocale: '_default' } });
    const sorted = sortEntriesByOrderField(entries, collection);

    expect(sorted).toEqual(entries);
    expect(sorted).not.toBe(entries);
  });
});
