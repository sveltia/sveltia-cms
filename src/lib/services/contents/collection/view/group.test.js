// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { groupEntries } from './group';

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
});
