// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { groupEntries, parseGroupConfig, viewGroups } from './group';

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

describe('Test viewGroups store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('viewGroups store is defined and exported', () => {
    expect(viewGroups).toBeDefined();
  });

  // Note: Full store testing requires more complex mocking of Svelte's derived store
  // and would typically be done in integration tests or with testing utilities
  // that can properly handle Svelte store reactivity
});
