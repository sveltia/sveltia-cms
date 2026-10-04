// @ts-nocheck
import { IndexedDB } from '@sveltia/utils/storage';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import { formatEntryData } from '$lib/services/contents/draft/save/entry-file';
import {
  buildEntryFileChanges,
  getPreviousSha,
  isSingleFileEntry,
  resolveCacheDB,
} from '$lib/services/contents/draft/save/file-changes';

vi.mock('$lib/services/backends', () => ({ backend: { current: null } }));

vi.mock('$lib/services/contents/draft/save/entry-file', () => ({
  formatEntryData: vi.fn(),
}));

vi.mock('@sveltia/utils/storage', () => ({ IndexedDB: vi.fn() }));

const draft = { fields: [] };
const _file = { format: 'yaml-frontmatter' };
const entry = { slug: 'a', locales: {} };

/**
 * Create a cache database mock holding the SHA of the given files.
 * @param {Record<string, string>} shaMap Map of file paths to SHAs.
 * @returns {any} Cache database.
 */
const createCacheDB = (shaMap) => ({
  get: vi.fn(async (path) => (path in shaMap ? { sha: shaMap[path] } : undefined)),
});

const singleFileConfig = {
  _i18n: { i18nEnabled: false, allLocales: ['_default'], defaultLocale: '_default' },
};

const multiFileConfig = {
  _i18n: {
    i18nEnabled: true,
    allLocales: ['en', 'fr', 'de'],
    defaultLocale: 'en',
    structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: false },
  },
};

describe('resolveCacheDB()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backend.current = null;
  });

  test('returns the provided handle', () => {
    const provided = { get: vi.fn() };

    expect(resolveCacheDB(provided)).toBe(provided);
    expect(IndexedDB).not.toHaveBeenCalled();
  });

  test('opens a handle for the current backend', () => {
    backend.current = { repository: { databaseName: 'db' } };
    resolveCacheDB();
    expect(IndexedDB).toHaveBeenCalledWith('db', 'file-cache');
  });

  test('returns undefined when no backend is configured', () => {
    expect(resolveCacheDB()).toBeUndefined();
  });
});

describe('getPreviousSha()', () => {
  test('returns undefined when previousPath is undefined', async () => {
    const result = await getPreviousSha({ previousPath: undefined, cacheDB: undefined });

    expect(result).toBeUndefined();
  });

  test('returns undefined when cache entry not found', async () => {
    const mockCacheDB = {
      get: vi.fn().mockResolvedValue(undefined),
    };

    const result = await getPreviousSha({
      previousPath: 'posts/old-post.md',
      cacheDB: mockCacheDB,
    });

    expect(result).toBeUndefined();
    expect(mockCacheDB.get).toHaveBeenCalledWith('posts/old-post.md');
  });

  test('returns sha from cache when found', async () => {
    const mockCacheDB = {
      get: vi.fn().mockResolvedValue({ sha: 'abc123' }),
    };

    const result = await getPreviousSha({
      previousPath: 'posts/old-post.md',
      cacheDB: mockCacheDB,
    });

    expect(result).toBe('abc123');
    expect(mockCacheDB.get).toHaveBeenCalledWith('posts/old-post.md');
  });

  test('returns undefined without a cache database', async () => {
    expect(
      await getPreviousSha({ previousPath: 'posts/old-post.md', cacheDB: undefined }),
    ).toBeUndefined();
  });
});

describe('isSingleFileEntry()', () => {
  test('returns true when i18n is disabled', () => {
    expect(isSingleFileEntry({ i18nEnabled: false })).toBe(true);
    expect(isSingleFileEntry({ i18nEnabled: false, structureMap: {} })).toBe(true);
  });

  test('returns true for the single file structures', () => {
    expect(isSingleFileEntry({ i18nEnabled: true, structureMap: { i18nSingleFile: true } })).toBe(
      true,
    );
    expect(
      isSingleFileEntry({ i18nEnabled: true, structureMap: { i18nSingleFileDefaultRoot: true } }),
    ).toBe(true);
  });

  test('returns false for a file-per-locale structure', () => {
    expect(
      isSingleFileEntry({
        i18nEnabled: true,
        structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: false },
      }),
    ).toBe(false);
  });

  test('returns a falsy value when i18n is enabled without a structure map', () => {
    expect(isSingleFileEntry({ i18nEnabled: true })).toBe(false);
    expect(isSingleFileEntry({ i18nEnabled: true, structureMap: {} })).toBe(false);
  });
});

describe('buildEntryFileChanges()', () => {
  beforeEach(() => {
    vi.mocked(formatEntryData).mockImplementation(
      async ({ locale }) => `data:${locale ?? 'single'}`,
    );
  });

  test('plans a single file without a locale', async () => {
    const cacheDB = createCacheDB({ 'posts/old.md': 'sha-old' });

    const planChange = vi.fn(() => ({
      action: 'move',
      slug: 'new',
      path: 'posts/new.md',
      previousPath: 'posts/old.md',
      currentPath: 'posts/old.md',
    }));

    const changes = await buildEntryFileChanges({
      draft,
      config: singleFileConfig,
      _file,
      entry,
      cacheDB,
      planChange,
    });

    expect(planChange).toHaveBeenCalledTimes(1);
    expect(planChange).toHaveBeenCalledWith(undefined);
    expect(changes).toEqual([
      {
        action: 'move',
        slug: 'new',
        path: 'posts/new.md',
        previousPath: 'posts/old.md',
        previousSha: 'sha-old',
        data: 'data:single',
      },
    ]);
    expect(cacheDB.get).toHaveBeenCalledWith('posts/old.md');
    expect(formatEntryData).toHaveBeenCalledTimes(1);
    expect(formatEntryData).toHaveBeenCalledWith({
      draft,
      config: singleFileConfig,
      _file,
      entry,
      locale: undefined,
    });
  });

  test.each([[{ i18nSingleFile: true }], [{ i18nSingleFileDefaultRoot: true }]])(
    'plans a single file for the single file i18n structure %o',
    async (structureMap) => {
      const config = { _i18n: { ...multiFileConfig._i18n, structureMap } };
      const planChange = vi.fn(() => ({ action: 'create', slug: 'a', path: 'posts/a.md' }));

      const changes = await buildEntryFileChanges({
        draft,
        config,
        _file,
        entry,
        cacheDB: undefined,
        planChange,
      });

      expect(planChange.mock.calls).toEqual([[undefined]]);
      expect(changes).toEqual([
        {
          action: 'create',
          slug: 'a',
          path: 'posts/a.md',
          previousSha: undefined,
          data: 'data:single',
        },
      ]);
    },
  );

  test('plans one file per locale in the order of the locales', async () => {
    const cacheDB = createCacheDB({ 'en/a.md': 'sha-en', 'fr/a.md': 'sha-fr' });

    // Resolve the data of the first locale last, so the order can’t follow the completion order
    vi.mocked(formatEntryData).mockImplementation(
      ({ locale }) =>
        new Promise((resolve) => {
          setTimeout(() => resolve(`data:${locale}`), locale === 'en' ? 20 : 0);
        }),
    );

    const planChange = vi.fn((locale) => ({
      action: 'update',
      slug: 'a',
      path: `${locale}/a.md`,
      currentPath: `${locale}/a.md`,
    }));

    const changes = await buildEntryFileChanges({
      draft,
      config: multiFileConfig,
      _file,
      entry,
      cacheDB,
      planChange,
    });

    expect(planChange.mock.calls).toEqual([['en'], ['fr'], ['de']]);
    expect(changes).toEqual([
      { action: 'update', slug: 'a', path: 'en/a.md', previousSha: 'sha-en', data: 'data:en' },
      { action: 'update', slug: 'a', path: 'fr/a.md', previousSha: 'sha-fr', data: 'data:fr' },
      { action: 'update', slug: 'a', path: 'de/a.md', previousSha: undefined, data: 'data:de' },
    ]);

    ['en', 'fr', 'de'].forEach((locale) => {
      expect(formatEntryData).toHaveBeenCalledWith({
        draft,
        config: multiFileConfig,
        _file,
        entry,
        locale,
      });
    });
  });

  test('skips a locale without a planned change', async () => {
    const planChange = vi.fn((locale) =>
      locale === 'fr' ? undefined : { action: 'create', slug: 'a', path: `${locale}/a.md` },
    );

    const changes = await buildEntryFileChanges({
      draft,
      config: multiFileConfig,
      _file,
      entry,
      cacheDB: undefined,
      planChange,
    });

    expect(changes.map(({ path }) => path)).toEqual(['en/a.md', 'de/a.md']);
    expect(formatEntryData).toHaveBeenCalledTimes(2);
    expect(formatEntryData).not.toHaveBeenCalledWith(expect.objectContaining({ locale: 'fr' }));
  });

  test('returns no changes when nothing is planned', async () => {
    expect(
      await buildEntryFileChanges({
        draft,
        config: singleFileConfig,
        _file,
        entry,
        cacheDB: undefined,
        planChange: vi.fn(() => undefined),
      }),
    ).toEqual([]);
    expect(formatEntryData).not.toHaveBeenCalled();
  });

  test('deletes a file without formatting its data', async () => {
    const cacheDB = createCacheDB({ 'fr/a.md': 'sha-fr' });

    const planChange = vi.fn((locale) =>
      locale === 'fr'
        ? { action: 'delete', slug: 'a', path: 'fr/a.md', currentPath: 'fr/a.md' }
        : undefined,
    );

    const changes = await buildEntryFileChanges({
      draft,
      config: multiFileConfig,
      _file,
      entry,
      cacheDB,
      planChange,
    });

    expect(changes).toEqual([
      { action: 'delete', slug: 'a', path: 'fr/a.md', previousSha: 'sha-fr' },
    ]);
    expect(changes[0]).not.toHaveProperty('data');
    expect(changes[0]).not.toHaveProperty('currentPath');
    expect(formatEntryData).not.toHaveBeenCalled();
  });

  test('looks up the previous SHA by the current path, not the new or previous path', async () => {
    const cacheDB = createCacheDB({
      'posts/current.md': 'sha-current',
      'posts/new.md': 'sha-new',
      'posts/previous.md': 'sha-previous',
    });

    const changes = await buildEntryFileChanges({
      draft,
      config: singleFileConfig,
      _file,
      entry,
      cacheDB,
      planChange: vi.fn(() => ({
        action: 'update',
        slug: 'a',
        path: 'posts/new.md',
        previousPath: 'posts/previous.md',
        currentPath: 'posts/current.md',
      })),
    });

    expect(cacheDB.get).toHaveBeenCalledTimes(1);
    expect(cacheDB.get).toHaveBeenCalledWith('posts/current.md');
    expect(changes[0].previousSha).toBe('sha-current');
    expect(changes[0]).not.toHaveProperty('currentPath');
  });

  test('leaves the previous SHA undefined for a new file', async () => {
    const cacheDB = createCacheDB({ 'posts/a.md': 'sha-a' });

    const [change] = await buildEntryFileChanges({
      draft,
      config: singleFileConfig,
      _file,
      entry,
      cacheDB,
      planChange: vi.fn(() => ({ action: 'create', slug: 'a', path: 'posts/a.md' })),
    });

    expect(cacheDB.get).not.toHaveBeenCalled();
    expect(change.previousSha).toBeUndefined();
  });

  test('keeps the other properties of the plan', async () => {
    const arrayItem = { index: 1, locales: {} };

    const [change] = await buildEntryFileChanges({
      draft,
      config: singleFileConfig,
      _file,
      entry,
      cacheDB: undefined,
      planChange: vi.fn(() => ({
        action: 'update',
        slug: 'a',
        path: 'data/members.json',
        currentPath: 'data/members.json',
        arrayItem,
      })),
    });

    expect(change).toEqual({
      action: 'update',
      slug: 'a',
      path: 'data/members.json',
      previousSha: undefined,
      data: 'data:single',
      arrayItem,
    });
  });
});
