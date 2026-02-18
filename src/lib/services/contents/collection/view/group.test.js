// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { groupEntries, parseGroupConfig } from './group';

// Mock all dependencies
vi.mock('svelte-i18n', () => ({
  _: vi.fn(() => (key) => (key === 'other' ? 'Other' : key)),
  locale: {
    subscribe: vi.fn(() => vi.fn()),
    set: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({
    subscribe: vi.fn(() => vi.fn()),
    set: vi.fn(),
    update: vi.fn(),
  })),
  derived: vi.fn(() => ({
    subscribe: vi.fn(() => vi.fn()),
  })),
  readable: vi.fn(() => ({
    subscribe: vi.fn(() => vi.fn()),
  })),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getPropertyValue: vi.fn(),
}));

vi.mock('$lib/services/utils/misc', () => ({
  getRegex: vi.fn(),
}));

const { get } = await import('svelte/store');
const { getPropertyValue } = await import('$lib/services/contents/entry/fields');

describe('groupEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the translation function
    // @ts-ignore - Mock parameter types
    vi.mocked(get).mockReturnValue((key) => (key === 'other' ? 'Other' : key));
  });

  test('should return ungrouped entries when no conditions', () => {
    // @ts-ignore - Mock data for testing
    const entries = [
      {
        id: 'entry1',
        sha: 'sha1',
        slug: 'slug1',
        subPath: '',
        locales: { en: { path: 'path1', slug: 'slug1', content: {} } },
      },
    ];

    // @ts-ignore - Mock data for testing
    const collection = {
      _type: 'entry',
      _file: { format: 'frontmatter', extension: 'md', formatOptions: {} },
      _i18n: {
        i18nEnabled: false,
        structure: 'single_file',
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        locales: ['en'],
        canonicalSlug: {},
      },
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
    };

    // @ts-ignore - Mock data for testing
    const result = groupEntries(entries, collection);

    expect(result).toEqual([{ name: '*', entries }]);
  });

  test('should return ungrouped entries when conditions is null', () => {
    // @ts-ignore - Mock data for testing
    const entries = [
      {
        id: 'entry1',
        sha: 'sha1',
        slug: 'slug1',
        subPath: '',
        locales: { en: { path: 'path1', slug: 'slug1', content: {} } },
      },
      {
        id: 'entry2',
        sha: 'sha2',
        slug: 'slug2',
        subPath: '',
        locales: { en: { path: 'path2', slug: 'slug2', content: {} } },
      },
    ];

    // @ts-ignore - Mock data for testing
    const collection = {
      _type: 'entry',
      _file: { format: 'frontmatter', extension: 'md', formatOptions: {} },
      _i18n: {
        i18nEnabled: false,
        structure: 'single_file',
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        locales: ['en'],
        canonicalSlug: {},
      },
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
    };

    // @ts-ignore - Mock data for testing
    const result = groupEntries(entries, collection, null);

    expect(result).toEqual([{ name: '*', entries }]);
  });

  test('should return ungrouped entries when conditions is undefined', () => {
    // @ts-ignore - Mock data for testing
    const entries = [
      {
        id: 'entry1',
        sha: 'sha1',
        slug: 'slug1',
        subPath: '',
        locales: { en: { path: 'path1', slug: 'slug1', content: {} } },
      },
    ];

    // @ts-ignore - Mock data for testing
    const collection = {
      _type: 'entry',
      _file: { format: 'frontmatter', extension: 'md', formatOptions: {} },
      _i18n: {
        i18nEnabled: false,
        structure: 'single_file',
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        locales: ['en'],
        canonicalSlug: {},
      },
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
    };

    // @ts-ignore - Mock data for testing
    const result = groupEntries(entries, collection, undefined);

    expect(result).toEqual([{ name: '*', entries }]);
  });

  test('should return ungrouped entries when conditions has empty field', () => {
    // @ts-ignore - Mock data for testing
    const entries = [
      {
        id: 'entry1',
        sha: 'sha1',
        slug: 'slug1',
        subPath: '',
        locales: { en: { path: 'path1', slug: 'slug1', content: {} } },
      },
    ];

    // @ts-ignore - Mock data for testing
    const collection = {
      _type: 'entry',
      _file: { format: 'frontmatter', extension: 'md', formatOptions: {} },
      _i18n: {
        i18nEnabled: false,
        structure: 'single_file',
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        locales: ['en'],
        canonicalSlug: {},
      },
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
    };

    // @ts-ignore - Mock data for testing
    const result = groupEntries(entries, collection, { field: '', pattern: undefined });

    expect(result).toEqual([{ name: '*', entries }]);
  });

  test('should group entries by field', () => {
    // @ts-ignore - Mock data for testing
    const entries = [
      {
        id: 'entry1',
        sha: 'sha1',
        slug: 'slug1',
        subPath: '',
        locales: { en: { path: 'path1', slug: 'slug1', content: { category: 'tech' } } },
      },
      {
        id: 'entry2',
        sha: 'sha2',
        slug: 'slug2',
        subPath: '',
        locales: { en: { path: 'path2', slug: 'slug2', content: { category: 'news' } } },
      },
      {
        id: 'entry3',
        sha: 'sha3',
        slug: 'slug3',
        subPath: '',
        locales: { en: { path: 'path3', slug: 'slug3', content: { category: 'tech' } } },
      },
    ];

    // @ts-ignore - Mock data for testing
    const collection = {
      _file: { format: 'frontmatter', extension: 'md', formatOptions: {} },
      _i18n: {
        i18nEnabled: false,
        structure: 'single_file',
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        locales: ['en'],
        canonicalSlug: {},
      },
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      view_groups: [{ field: 'category', label: 'Category', pattern: '' }],
    };

    const conditions = { field: 'category' };

    // @ts-ignore - Mock parameter types
    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'category') {
        return entry.locales.en.content.category;
      }

      return undefined;
    });

    // @ts-ignore - Mock data for testing
    const result = groupEntries(entries, collection, conditions);

    expect(result).toHaveLength(2);
    expect(result.find((g) => g.name === 'tech')?.entries).toHaveLength(2);
    expect(result.find((g) => g.name === 'news')?.entries).toHaveLength(1);
  });

  test('should handle undefined values', () => {
    // @ts-ignore - Mock data for testing
    const entries = [
      {
        id: 'entry1',
        sha: 'sha1',
        slug: 'slug1',
        subPath: '',
        locales: { en: { path: 'path1', slug: 'slug1', content: { category: 'tech' } } },
      },
      {
        id: 'entry2',
        sha: 'sha2',
        slug: 'slug2',
        subPath: '',
        locales: { en: { path: 'path2', slug: 'slug2', content: {} } },
      },
    ];

    // @ts-ignore - Mock data for testing
    const collection = {
      _file: { format: 'frontmatter', extension: 'md', formatOptions: {} },
      _i18n: {
        i18nEnabled: false,
        structure: 'single_file',
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        locales: ['en'],
        canonicalSlug: {},
      },
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      view_groups: [{ field: 'category', label: 'Category', pattern: '' }],
    };

    const conditions = { field: 'category' };

    // @ts-ignore - Mock parameter types
    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'category') {
        return entry.locales.en.content.category;
      }

      return undefined;
    });

    // @ts-ignore - Mock data for testing
    const result = groupEntries(entries, collection, conditions);

    expect(result).toHaveLength(2);
    expect(result.find((g) => g.name === 'tech')?.entries).toHaveLength(1);
    expect(result.find((g) => g.name === 'Other')?.entries).toHaveLength(1);
  });

  test('should handle regex patterns', async () => {
    const { getRegex } = await import('$lib/services/utils/misc');

    // @ts-ignore - Mock data for testing
    const entries = [
      {
        id: 'entry1',
        sha: 'sha1',
        slug: 'slug1',
        subPath: '',
        locales: { en: { path: 'path1', slug: 'slug1', content: { date: '2023-01-15' } } },
      },
      {
        id: 'entry2',
        sha: 'sha2',
        slug: 'slug2',
        subPath: '',
        locales: { en: { path: 'path2', slug: 'slug2', content: { date: '2023-02-20' } } },
      },
      {
        id: 'entry3',
        sha: 'sha3',
        slug: 'slug3',
        subPath: '',
        locales: { en: { path: 'path3', slug: 'slug3', content: { date: '2024-01-10' } } },
      },
    ];

    // @ts-ignore - Mock data for testing
    const collection = {
      _file: { format: 'frontmatter', extension: 'md', formatOptions: {} },
      _i18n: {
        i18nEnabled: false,
        structure: 'single_file',
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        locales: ['en'],
        canonicalSlug: {},
      },
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
    };

    const conditions = { field: 'date', pattern: /^\d{4}/ };

    // @ts-ignore - Mock parameter types
    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'date') {
        return entry.locales.en.content.date;
      }

      return undefined;
    });

    // @ts-ignore - Mock parameter types
    vi.mocked(getRegex).mockReturnValue(/^\d{4}/);

    // @ts-ignore - Mock data for testing
    const result = groupEntries(entries, collection, conditions);

    expect(result).toHaveLength(2);
    expect(result.find((g) => g.name === '2023')?.entries).toHaveLength(2);
    expect(result.find((g) => g.name === '2024')?.entries).toHaveLength(1);
  });

  test('should handle empty entries array', () => {
    // @ts-ignore - Mock data for testing
    const entries = [];

    // @ts-ignore - Mock data for testing
    const collection = {
      _file: { format: 'frontmatter', extension: 'md', formatOptions: {} },
      _i18n: {
        i18nEnabled: false,
        structure: 'single_file',
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        locales: ['en'],
        canonicalSlug: {},
      },
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
    };

    // @ts-ignore - Mock data for testing
    const result = groupEntries(entries, collection);

    expect(result).toEqual([]);
  });

  test('should reverse groups when sorting is descending on the same field', async () => {
    const { getRegex } = await import('$lib/services/utils/misc');

    // @ts-ignore - Mock data for testing
    const entries = [
      {
        id: 'entry1',
        sha: 'sha1',
        slug: 'slug1',
        subPath: '',
        locales: { en: { path: 'path1', slug: 'slug1', content: { date: '2023-01-01' } } },
      },
      {
        id: 'entry2',
        sha: 'sha2',
        slug: 'slug2',
        subPath: '',
        locales: { en: { path: 'path2', slug: 'slug2', content: { date: '2024-01-01' } } },
      },
      {
        id: 'entry3',
        sha: 'sha3',
        slug: 'slug3',
        subPath: '',
        locales: { en: { path: 'path3', slug: 'slug3', content: { date: '2022-01-01' } } },
      },
    ];

    // @ts-ignore - Mock data for testing
    const collection = {
      _file: { format: 'frontmatter', extension: 'md', formatOptions: {} },
      _i18n: {
        i18nEnabled: false,
        structure: 'single_file',
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        locales: ['en'],
        canonicalSlug: {},
      },
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
    };

    // @ts-ignore - Mock parameter types
    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'date') {
        return entry.locales.en.content.date;
      }

      return undefined;
    });

    // @ts-ignore - Mock parameter types
    vi.mocked(getRegex).mockReturnValue(/^(\d{4})/);

    // Mock currentView store to return descending sort on date field
    vi.mocked(get).mockImplementation((store) => {
      // For currentView store
      if (store && typeof store === 'object' && 'subscribe' in store) {
        return { sort: { key: 'date', order: 'descending' } };
      }

      // For translation function
      return (key) => (key === 'other' ? 'Other' : key);
    });

    // @ts-ignore - Mock data for testing
    const conditions = { field: 'date', pattern: '(\\d{4})' };
    // @ts-ignore - Mock data for testing
    const result = groupEntries(entries, collection, conditions);

    // Groups should be reversed (descending order)
    expect(result[0].name).toBe('2024');
    expect(result[1].name).toBe('2023');
    expect(result[2].name).toBe('2022');
  });
});

describe('Test parseGroupConfig()', () => {
  test('returns empty options for undefined input', () => {
    const result = parseGroupConfig(undefined);

    expect(result).toEqual({ options: [] });
  });

  test('returns empty options for null input', () => {
    const result = parseGroupConfig(/** @type {any} */ (null));

    expect(result).toEqual({ options: [] });
  });

  test('returns empty options for empty array', () => {
    const result = parseGroupConfig([]);

    expect(result).toEqual({ options: [] });
  });

  test('parses array format (Netlify/Decap CMS compatible)', () => {
    const groups = [
      { field: 'category', label: 'Category' },
      { field: 'author', label: 'Author' },
    ];

    const result = parseGroupConfig(groups);

    expect(result).toEqual({ options: groups });
  });

  test('parses object format without default (Static CMS compatible)', () => {
    const groups = {
      groups: [
        { field: 'category', label: 'Category' },
        { field: 'author', label: 'Author' },
      ],
    };

    const result = parseGroupConfig(groups);

    expect(result).toEqual({
      options: groups.groups,
      default: undefined,
    });
  });

  test('parses object format with default (Static CMS compatible)', () => {
    const groups = {
      groups: [
        { name: 'by-category', field: 'category', label: 'Category' },
        { name: 'by-author', field: 'author', label: 'Author' },
      ],
      default: 'by-category',
    };

    const result = parseGroupConfig(groups);

    expect(result).toEqual({
      options: groups.groups,
      default: { field: 'category', pattern: undefined },
    });
  });

  test('handles object format with invalid default name', () => {
    const groups = {
      groups: [
        { name: 'by-category', field: 'category', label: 'Category' },
        { name: 'by-author', field: 'author', label: 'Author' },
      ],
      default: 'nonexistent',
    };

    const result = parseGroupConfig(groups);

    expect(result).toEqual({
      options: groups.groups,
      default: undefined,
    });
  });

  test('returns empty options for object with empty groups array', () => {
    const groups = {
      groups: [],
      default: 'by-category',
    };

    const result = parseGroupConfig(groups);

    expect(result).toEqual({ options: [] });
  });

  test('returns empty options for object with undefined groups', () => {
    const groups = /** @type {any} */ ({
      default: 'by-category',
    });

    const result = parseGroupConfig(groups);

    expect(result).toEqual({ options: [] });
  });

  test('returns empty options for object with non-array groups', () => {
    const groups = /** @type {any} */ ({
      groups: 'not an array',
      default: 'by-category',
    });

    const result = parseGroupConfig(groups);

    expect(result).toEqual({ options: [] });
  });

  test('returns empty options for non-object, non-array input', () => {
    const result = parseGroupConfig(/** @type {any} */ ('invalid'));

    expect(result).toEqual({ options: [] });
  });
});

describe('initializeViewGroups', () => {
  test('calls set with empty array when collection is undefined', async () => {
    const { initializeViewGroups } = await import('./group');
    const mockSet = vi.fn();

    initializeViewGroups(undefined, mockSet);

    expect(mockSet).toHaveBeenCalledWith([]);
  });

  test('calls set with empty array for file collection', async () => {
    const { initializeViewGroups } = await import('./group');
    const mockSet = vi.fn();

    const fileCollection = /** @type {any} */ ({
      name: 'pages',
      _type: 'file',
      files: [],
      _fileMap: {},
    });

    initializeViewGroups(fileCollection, mockSet);

    expect(mockSet).toHaveBeenCalledWith([]);
  });

  test('processes and sets groups for entry collection', async () => {
    const { initializeViewGroups } = await import('./group');
    const { currentView } = await import('$lib/services/contents/collection/view');
    const mockSet = vi.fn();

    vi.mocked(currentView).update = vi.fn();

    const entryCollection = /** @type {any} */ ({
      name: 'posts',
      _type: 'entry',
      folder: 'content/posts',
      view_groups: [
        { field: 'author', pattern: 'john', name: 'john' },
        { field: 'status', pattern: 'draft', name: 'draft' },
      ],
    });

    initializeViewGroups(entryCollection, mockSet);

    expect(mockSet).toHaveBeenCalledWith([
      { field: 'author', pattern: 'john', name: 'john' },
      { field: 'status', pattern: 'draft', name: 'draft' },
    ]);

    expect(vi.mocked(currentView).update).toHaveBeenCalled();
  });

  test('handles entry collection with no view_groups', async () => {
    const { initializeViewGroups } = await import('./group');
    const { currentView } = await import('$lib/services/contents/collection/view');
    const mockSet = vi.fn();

    vi.mocked(currentView).update = vi.fn();

    const entryCollection = /** @type {any} */ ({
      name: 'posts',
      _type: 'entry',
      folder: 'content/posts',
    });

    initializeViewGroups(entryCollection, mockSet);

    expect(mockSet).toHaveBeenCalledWith([]);

    expect(vi.mocked(currentView).update).toHaveBeenCalled();
  });

  test('handles entry collection with view_groups object format', async () => {
    const { initializeViewGroups } = await import('./group');
    const { currentView } = await import('$lib/services/contents/collection/view');
    const mockSet = vi.fn();

    vi.mocked(currentView).update = vi.fn();

    const entryCollection = /** @type {any} */ ({
      name: 'posts',
      _type: 'entry',
      folder: 'content/posts',
      view_groups: {
        groups: [
          { field: 'author', pattern: 'john', name: 'john' },
          { field: 'status', pattern: 'draft', name: 'draft' },
        ],
        default: 'john',
      },
    });

    initializeViewGroups(entryCollection, mockSet);

    expect(mockSet).toHaveBeenCalledWith([
      { field: 'author', pattern: 'john', name: 'john' },
      { field: 'status', pattern: 'draft', name: 'draft' },
    ]);

    expect(vi.mocked(currentView).update).toHaveBeenCalled();
  });
});

describe('Test viewGroups store', () => {
  test('viewGroups derived callback calls initializeViewGroups when selectedCollection changes', async () => {
    vi.resetModules();

    // Use the real svelte/store functions for this isolated test
    const { writable, derived: realDerived, get: realGet } = await vi.importActual('svelte/store');

    vi.doMock('svelte/store', () => ({
      derived: realDerived,
      get: realGet,
      writable,
    }));

    const _selectedCollection = writable(/** @type {any} */ (undefined));
    const _currentView = writable({ type: 'list' });

    vi.doMock('$lib/services/contents/collection', () => ({
      selectedCollection: _selectedCollection,
    }));

    vi.doMock('$lib/services/contents/collection/view', () => ({
      currentView: _currentView,
    }));

    vi.doMock('$lib/services/contents/entry/fields', () => ({
      getPropertyValue: vi.fn(),
    }));

    vi.doMock('$lib/services/utils/misc', () => ({
      getRegex: vi.fn(),
    }));

    const { viewGroups } = await import('./group');
    let groupValues = /** @type {any} */ (null);

    const unsub = viewGroups.subscribe((value) => {
      groupValues = value;
    });

    // Set a folder collection with view_groups to exercise line 137
    _selectedCollection.set(
      /** @type {any} */ ({
        name: 'posts',
        _type: 'entry',
        folder: 'content/posts',
        view_groups: [{ field: 'status', pattern: 'published', name: 'published' }],
      }),
    );

    expect(Array.isArray(groupValues)).toBe(true);

    unsub();
  });
});
