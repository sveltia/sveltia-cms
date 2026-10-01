// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { allEntries, allEntryFolders } from '$lib/services/contents';
import {
  _resetEntriesByCollectionCache,
  canCreateIndexFile,
  countCollectionEntries,
  getEntriesByCollection,
  getListedCollections,
  matchesCollectionFilter,
  selectedEntries,
  selectedEntryIdSet,
} from '$lib/services/contents/collection/entries';

// Mock dependencies
vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { current: undefined },
  allEntryFolders: { current: undefined },
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  getIndexFile: vi.fn(),
  getIndexFileName: vi.fn(),
  isCollectionIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/collections', () => ({
  getAssociatedCollections: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/values', () => ({
  getPropertyValue: vi.fn(),
}));

vi.mock('$lib/services/utils/regex', () => ({
  getRegex: vi.fn(),
}));

describe('selectedEntryIdSet', () => {
  test('derives a Set of entry IDs from selectedEntries', () => {
    selectedEntries.current = [{ id: 'a' }, { id: 'b' }];
    expect(selectedEntryIdSet.current).toEqual(new Set(['a', 'b']));

    selectedEntries.current = [];
    expect(selectedEntryIdSet.current).toEqual(new Set());
  });
});

describe('getEntriesByCollection()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The mocked stores never change identity, so drop the memoized entry lists between cases
    _resetEntriesByCollectionCache();
  });

  test('returns empty array when collection not found', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');

    vi.mocked(getCollection).mockReturnValue(undefined);

    const result = getEntriesByCollection('non-existent');

    expect(result).toEqual([]);
  });

  test('filters entries by collection', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    // Create a minimal collection mock with required properties
    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    };

    const entries = [
      { id: '1', locales: { en: { content: {} } } },
      { id: '2', locales: { en: { content: {} } } },
      { id: '3', locales: { en: { content: {} } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    allEntries.current = entries;

    // Mock getAssociatedCollections to return collections with minimal required properties
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }])
      .mockReturnValueOnce([{ name: 'pages' }])
      .mockReturnValueOnce([{ name: 'posts' }]);

    const result = getEntriesByCollection('posts');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('filters entries by field pattern', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
    const { getPropertyValue } = await import('$lib/services/contents/entry/values');
    const { getRegex } = await import('$lib/services/utils/regex');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: {
        field: 'status',
        pattern: '^published$',
      },
    };

    const entries = [
      { id: '1', locales: { en: { content: { status: 'published' } } } },
      { id: '2', locales: { en: { content: { status: 'draft' } } } },
      { id: '3', locales: { en: { content: { status: 'published' } } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    allEntries.current = entries;
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts' }]);
    vi.mocked(getPropertyValue)
      .mockReturnValueOnce('published')
      .mockReturnValueOnce('draft')
      .mockReturnValueOnce('published');
    vi.mocked(getRegex).mockReturnValue(/^published$/);

    const result = getEntriesByCollection('posts');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('filters entries by field value array', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
    const { getPropertyValue } = await import('$lib/services/contents/entry/values');
    const { getRegex } = await import('$lib/services/utils/regex');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: {
        field: 'category',
        value: ['tech', 'science'],
      },
    };

    const entries = [
      { id: '1', locales: { en: { content: { category: 'tech' } } } },
      { id: '2', locales: { en: { content: { category: 'sports' } } } },
      { id: '3', locales: { en: { content: { category: 'science' } } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    allEntries.current = entries;
    // Mock getRegex to return null since we're not using pattern matching
    vi.mocked(getRegex).mockReturnValue(null);
    // Mock getAssociatedCollections to return 'posts' collection for each entry
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }]) // Entry 1
      .mockReturnValueOnce([{ name: 'posts' }]) // Entry 2
      .mockReturnValueOnce([{ name: 'posts' }]); // Entry 3
    vi.mocked(getPropertyValue)
      .mockReturnValueOnce('tech') // Entry 1: category 'tech' (included)
      .mockReturnValueOnce('sports') // Entry 2: category 'sports' (excluded)
      .mockReturnValueOnce('science'); // Entry 3: category 'science' (included)

    const result = getEntriesByCollection('posts');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('filters entries by single field value', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
    const { getPropertyValue } = await import('$lib/services/contents/entry/values');
    const { getRegex } = await import('$lib/services/utils/regex');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: {
        field: 'featured',
        value: true,
      },
    };

    const entries = [
      { id: '1', locales: { en: { content: { featured: true } } } },
      { id: '2', locales: { en: { content: { featured: false } } } },
      { id: '3', locales: { en: { content: { featured: true } } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    allEntries.current = entries;
    // Mock getRegex to return null since we're not using pattern matching
    vi.mocked(getRegex).mockReturnValue(null);
    // Mock getAssociatedCollections to return 'posts' collection for each entry
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }]) // Entry 1
      .mockReturnValueOnce([{ name: 'posts' }]) // Entry 2
      .mockReturnValueOnce([{ name: 'posts' }]); // Entry 3
    vi.mocked(getPropertyValue)
      .mockReturnValueOnce(true) // Entry 1: featured true (included)
      .mockReturnValueOnce(false) // Entry 2: featured false (excluded)
      .mockReturnValueOnce(true); // Entry 3: featured true (included)

    const result = getEntriesByCollection('posts');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('exempts Hugo’s special index file from the collection filter', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const indexFileModule = await import('$lib/services/contents/collection/entries/index-file');
    const { isCollectionIndexFile } = indexFileModule;
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
    const { getPropertyValue } = await import('$lib/services/contents/entry/values');
    const { getRegex } = await import('$lib/services/utils/regex');

    const collection = {
      name: 'news',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: { field: 'type', value: 'post' },
      index_file: { fields: [{ name: 'type', widget: 'hidden', default: 'updates' }] },
    };

    const entries = [
      { id: '1', slug: 'hello', locales: { en: { content: { type: 'post' } } } },
      // The index file has its own `index_file.fields` schema, so its `type` doesn’t match the
      // collection filter, yet it must still be listed
      { id: '2', slug: '_index', locales: { en: { content: { type: 'updates' } } } },
      { id: '3', slug: 'world', locales: { en: { content: { type: 'page' } } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    allEntries.current = entries;
    vi.mocked(getRegex).mockReturnValue(null);
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'news' }]);
    vi.mocked(isCollectionIndexFile).mockImplementation((_collection, entry) => entry.id === '2');
    vi.mocked(getPropertyValue)
      .mockReturnValueOnce('post') // Entry 1: included
      .mockReturnValueOnce('page'); // Entry 3: excluded

    const result = getEntriesByCollection('news');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
    // The index file short-circuits before the property lookup
    expect(getPropertyValue).toHaveBeenCalledTimes(2);
  });

  test('sorts the entries into their collections, keeping the store order', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const entries = [
      { id: '1', locales: { en: { path: 'posts/hello.md', content: {} } } },
      { id: '2', locales: { en: { path: 'pages/about.md', content: {} } } },
      { id: '3', locales: { en: { path: 'posts/world.md', content: {} } } },
      { id: '4', locales: { en: { path: 'other/file.md', content: {} } } },
    ];

    vi.mocked(getCollection).mockImplementation((name) => ({
      name,
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    }));
    // A collection can match an entry through more than one of its folders, and an entry can
    // belong to more than one collection
    vi.mocked(getAssociatedCollections).mockImplementation((entry) => {
      const { path } = entry.locales.en;

      if (path.startsWith('posts/')) {
        return [{ name: 'posts' }, { name: 'posts' }, { name: 'all' }];
      }

      return path.startsWith('pages/') ? [{ name: 'all' }] : [];
    });
    allEntries.current = entries;

    expect(getEntriesByCollection('posts').map(({ id }) => id)).toEqual(['1', '3']);
    expect(getEntriesByCollection('all').map(({ id }) => id)).toEqual(['1', '2', '3']);
    expect(getEntriesByCollection('empty')).toEqual([]);
    // The entry list is scanned once for every collection
    expect(getAssociatedCollections).toHaveBeenCalledTimes(entries.length);
  });

  test('uses null fallback when getPropertyValue returns undefined (line 95 branch 1)', async () => {
    // When getPropertyValue returns undefined, `?? null` converts it to null.
    // Then `filterValues.includes(null)` determines inclusion.
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
    const { getPropertyValue } = await import('$lib/services/contents/entry/values');
    const { getRegex } = await import('$lib/services/utils/regex');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: {
        field: 'status',
        value: null, // filtering for null (missing) values
      },
    };

    const entries = [{ id: '1', locales: { en: { content: {} } } }];

    vi.mocked(getCollection).mockReturnValue(collection);
    allEntries.current = entries;
    vi.mocked(getRegex).mockReturnValue(null);
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts' }]);
    // Return undefined to trigger the `?? null` fallback
    vi.mocked(getPropertyValue).mockReturnValue(undefined);

    const result = getEntriesByCollection('posts');

    // value = undefined ?? null = null, filterValues.includes(null) = true
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('reuses the same array for repeated calls', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
    const collection = { name: 'posts', _type: 'entry', _i18n: { defaultLocale: 'en' } };
    const entries = [{ id: '1', locales: { en: { content: {} } } }];

    vi.mocked(getCollection).mockReturnValue(collection);
    allEntries.current = entries;
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts' }]);

    const first = getEntriesByCollection('posts');
    const second = getEntriesByCollection('posts');

    // Reference equality is what lets the Relation option cache hit
    expect(second).toBe(first);
    // The entry list was scanned only once
    expect(vi.mocked(getAssociatedCollections)).toHaveBeenCalledTimes(1);
  });

  test('keeps separate results per collection', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const entries = [
      { id: '1', locales: { en: { content: {} } } },
      { id: '2', locales: { en: { content: {} } } },
    ];

    vi.mocked(getCollection).mockImplementation((name) => ({
      name,
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    }));
    allEntries.current = entries;
    vi.mocked(getAssociatedCollections).mockImplementation((entry) => [
      { name: entry.id === '1' ? 'posts' : 'pages' },
    ]);

    expect(getEntriesByCollection('posts').map(({ id }) => id)).toEqual(['1']);
    expect(getEntriesByCollection('pages').map(({ id }) => id)).toEqual(['2']);
  });

  test('rescans when the entry store is replaced', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
    const collection = { name: 'posts', _type: 'entry', _i18n: { defaultLocale: 'en' } };
    const before = [{ id: '1', locales: { en: { content: {} } } }];
    const after = [...before, { id: '2', locales: { en: { content: {} } } }];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts' }]);

    allEntries.current = before;
    expect(getEntriesByCollection('posts')).toHaveLength(1);

    allEntries.current = after;
    expect(getEntriesByCollection('posts')).toHaveLength(2);
  });

  test('rescans when the entry folder store is replaced', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
    const collection = { name: 'pages', _type: 'file', _i18n: { defaultLocale: 'en' } };

    const entries = [
      { id: '1', locales: { en: { path: 'content/home.md', content: {} } } },
      { id: '2', locales: { en: { path: 'content/about.md', content: {} } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(getAssociatedCollections).mockImplementation((entry) =>
      entry.id === '1' ? [collection] : [],
    );

    allEntryFolders.current = [];
    allEntries.current = entries;
    expect(getEntriesByCollection('pages')).toHaveLength(1);

    // A new configuration adds a file to the collection
    vi.mocked(getAssociatedCollections).mockReturnValue([collection]);
    allEntryFolders.current = [];
    expect(getEntriesByCollection('pages')).toHaveLength(2);
  });
});

describe('matchesCollectionFilter()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  test('returns true when the collection has no filter', () => {
    const collection = { name: 'posts', _type: 'entry', _i18n: { defaultLocale: 'en' } };
    const entry = { id: '1', locales: { en: { content: { status: 'draft' } } } };

    expect(matchesCollectionFilter(collection, entry)).toBe(true);
  });

  test('ignores the filter of a file collection', () => {
    const collection = {
      name: 'data',
      _type: 'file',
      _i18n: { defaultLocale: 'en' },
      filter: { field: 'status', value: 'published' },
    };

    const entry = { id: '1', locales: { en: { content: { status: 'draft' } } } };

    expect(matchesCollectionFilter(collection, entry)).toBe(true);
  });

  test('compares the field value with the filter value', async () => {
    const { getPropertyValue } = await import('$lib/services/contents/entry/values');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: { field: 'status', value: 'published' },
    };

    const entry = { id: '1', locales: { en: { content: {} } } };

    vi.mocked(getPropertyValue).mockReturnValueOnce('published').mockReturnValueOnce('draft');

    expect(matchesCollectionFilter(collection, entry)).toBe(true);
    expect(matchesCollectionFilter(collection, entry)).toBe(false);

    expect(getPropertyValue).toHaveBeenCalledWith({
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'status',
    });
  });

  test('matches the field value against the filter pattern', async () => {
    const { getPropertyValue } = await import('$lib/services/contents/entry/values');
    const { getRegex } = await import('$lib/services/utils/regex');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: { field: 'status', pattern: '^published$' },
    };

    const entry = { id: '1', locales: { en: { content: {} } } };

    vi.mocked(getRegex).mockReturnValue(/^published$/);
    vi.mocked(getPropertyValue).mockReturnValueOnce('published').mockReturnValueOnce('draft');

    expect(matchesCollectionFilter(collection, entry)).toBe(true);
    expect(matchesCollectionFilter(collection, entry)).toBe(false);
    // The condition is cached, so the pattern is compiled once per collection
    expect(getRegex).toHaveBeenCalledTimes(1);
  });

  test('passes an entry when any item of a multi-value field matches', async () => {
    const { getPropertyValue } = await import('$lib/services/contents/entry/values');
    const { getRegex } = await import('$lib/services/utils/regex');
    const _i18n = { defaultLocale: 'en' };
    const entry = { id: '1', locales: { en: { content: {} } } };

    const valueCollection = {
      name: 'news',
      _type: 'entry',
      _i18n,
      filter: { field: 'tags', value: 'news' },
    };

    const patternCollection = {
      name: 'updates',
      _type: 'entry',
      _i18n,
      filter: { field: 'tags', pattern: '^updates$' },
    };

    vi.mocked(getRegex).mockReturnValue(/^updates$/);

    vi.mocked(getPropertyValue)
      .mockReturnValueOnce(['news', 'updates'])
      .mockReturnValueOnce(['events'])
      .mockReturnValueOnce(['news', 'updates'])
      .mockReturnValueOnce(['events'])
      .mockReturnValueOnce([]);

    expect(matchesCollectionFilter(valueCollection, entry)).toBe(true);
    expect(matchesCollectionFilter(valueCollection, entry)).toBe(false);
    expect(matchesCollectionFilter(patternCollection, entry)).toBe(true);
    expect(matchesCollectionFilter(patternCollection, entry)).toBe(false);
    expect(matchesCollectionFilter(patternCollection, entry)).toBe(false);
  });

  test('treats a missing value as null', async () => {
    const { getPropertyValue } = await import('$lib/services/contents/entry/values');

    const collection = {
      name: 'untagged',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: { field: 'status', value: [null] },
    };

    const entry = { id: '1', locales: { en: { content: {} } } };

    vi.mocked(getPropertyValue).mockReturnValueOnce(undefined).mockReturnValueOnce('draft');

    expect(matchesCollectionFilter(collection, entry)).toBe(true);
    expect(matchesCollectionFilter(collection, entry)).toBe(false);
  });

  test('exempts Hugo’s special index file from the filter', async () => {
    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: { field: 'status', value: 'published' },
    };

    const entry = { id: '1', locales: { en: { content: {} } } };

    vi.mocked(isCollectionIndexFile).mockReturnValue(true);

    expect(matchesCollectionFilter(collection, entry)).toBe(true);
  });
});

describe('getListedCollections()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  test('omits the collections that filter the entry out', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');
    const { getPropertyValue } = await import('$lib/services/contents/entry/values');
    const listed = { name: 'posts', _type: 'entry', _i18n: { defaultLocale: 'en' } };

    const filtered = {
      name: 'drafts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: { field: 'status', value: 'draft' },
    };

    const entry = { id: '1', locales: { en: { content: { status: 'published' } } } };

    vi.mocked(getAssociatedCollections).mockReturnValue([listed, filtered]);
    vi.mocked(getPropertyValue).mockReturnValue('published');

    expect(getListedCollections(entry)).toEqual([listed]);
  });

  test('returns an empty array when the entry belongs to no collection', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    vi.mocked(getAssociatedCollections).mockReturnValue([]);

    expect(getListedCollections({ id: '1', locales: {} })).toEqual([]);
  });
});

describe('selectedEntries', () => {
  test('is exported as reactive state', () => {
    selectedEntries.current = [];
    expect(selectedEntries.current).toEqual([]);
  });
});

describe('countCollectionEntries()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Entries in a `pages` collection on `content`, which holds its own index file, another
   * collection’s index file and a regular entry.
   */
  const entries = [
    { id: '1', slug: '_index', locales: { en: { path: 'content/_index.md', content: {} } } },
    { id: '2', slug: 'about', locales: { en: { path: 'content/about/_index.md', content: {} } } },
    {
      id: '3',
      slug: '_index',
      locales: { en: { path: 'content/posts/_index.md', content: {} } },
    },
  ];

  test('leaves out the collection’s own index file', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');

    const { getIndexFileName, isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    vi.mocked(getCollection).mockReturnValue({ name: 'pages', _type: 'entry' });
    vi.mocked(getIndexFileName).mockReturnValue('_index');
    // `content/posts/_index.md` belongs to a collection below `content`, so it’s an ordinary entry
    // as far as `pages` is concerned
    // @see https://github.com/sveltia/sveltia-cms/issues/1005
    vi.mocked(isCollectionIndexFile).mockImplementation(
      (_collection, { locales }) => locales.en?.path === 'content/_index.md',
    );

    expect(countCollectionEntries('pages', entries)).toBe(2);
  });

  test('skips the pass entirely when the collection has no index file', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');

    const { getIndexFileName, isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    vi.mocked(getCollection).mockReturnValue({ name: 'pages', _type: 'entry' });
    vi.mocked(getIndexFileName).mockReturnValue(undefined);

    expect(countCollectionEntries('pages', entries)).toBe(3);
    // Nothing can be left out, so the entries aren’t walked at all
    expect(isCollectionIndexFile).not.toHaveBeenCalled();
  });

  test('counts every entry when the collection is gone', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');

    const { getIndexFileName } =
      await import('$lib/services/contents/collection/entries/index-file');

    vi.mocked(getCollection).mockReturnValue(undefined);

    expect(countCollectionEntries('pages', entries)).toBe(3);
    expect(getIndexFileName).not.toHaveBeenCalled();
  });
});

describe('canCreateIndexFile()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The mocked stores never change identity, so drop the memoized entry lists between cases
    _resetEntriesByCollectionCache();
  });

  test('returns false when collection has no index file configured', async () => {
    const { getIndexFile } = await import('$lib/services/contents/collection/entries/index-file');

    vi.mocked(getIndexFile).mockReturnValue(undefined);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile({ name: 'posts' });

    expect(result).toBe(false);
  });

  test('returns true when index file does not yet exist in collection entries', async () => {
    const { getIndexFile } = await import('$lib/services/contents/collection/entries/index-file');
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    };

    vi.mocked(getIndexFile).mockReturnValue({ name: '_index' });
    vi.mocked(getCollection).mockReturnValue(collection);

    const entries = [
      { id: '1', slug: 'post-1', locales: { en: { content: {} } } },
      { id: '2', slug: 'post-2', locales: { en: { content: {} } } },
    ];

    allEntries.current = entries;
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }])
      .mockReturnValueOnce([{ name: 'posts' }]);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(true);
  });

  test('returns false when index file already exists in collection entries', async () => {
    const { getIndexFile, isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    };

    vi.mocked(getIndexFile).mockReturnValue({ name: '_index' });
    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(isCollectionIndexFile).mockImplementation(
      (_collection, { slug }) => slug === '_index',
    );

    const entries = [
      { id: '1', slug: '_index', locales: { en: { content: {} } } },
      { id: '2', slug: 'post-1', locales: { en: { content: {} } } },
    ];

    allEntries.current = entries;
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }])
      .mockReturnValueOnce([{ name: 'posts' }]);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(false);
  });

  test('returns false when custom-named index file already exists', async () => {
    const { getIndexFile, isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    };

    vi.mocked(getIndexFile).mockReturnValue({ name: 'home' });
    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(isCollectionIndexFile).mockImplementation((_collection, { slug }) => slug === 'home');

    const entries = [
      { id: '1', slug: 'home', locales: { en: { content: {} } } },
      { id: '2', slug: 'post-1', locales: { en: { content: {} } } },
    ];

    allEntries.current = entries;
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }])
      .mockReturnValueOnce([{ name: 'posts' }]);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(false);
  });

  test('ignores a nested collection’s index file listed in the collection', async () => {
    const { getIndexFile, isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const collection = {
      name: 'pages',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    };

    vi.mocked(getIndexFile).mockReturnValue({ name: '_index' });
    vi.mocked(getCollection).mockReturnValue(collection);

    // `content/posts/_index.md` belongs to a `posts` collection below `content`, which gave it the
    // slug `_index`, but it isn’t the `pages` collection’s own index file
    // @see https://github.com/sveltia/sveltia-cms/issues/1005
    vi.mocked(isCollectionIndexFile).mockImplementation(
      (_collection, { locales }) => locales.en?.path === 'content/_index.md',
    );

    const entries = [
      {
        id: '1',
        slug: '_index',
        locales: { en: { path: 'content/posts/_index.md', content: {} } },
      },
      { id: '2', slug: 'about', locales: { en: { path: 'content/about/_index.md', content: {} } } },
    ];

    allEntries.current = entries;
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'pages' }])
      .mockReturnValueOnce([{ name: 'pages' }]);

    // @ts-ignore - Intentionally incomplete for testing
    expect(canCreateIndexFile(collection)).toBe(true);
  });
});
