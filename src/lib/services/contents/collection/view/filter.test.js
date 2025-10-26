import { beforeEach, describe, expect, test, vi } from 'vitest';

import { filterEntries, parseFilterConfig } from './filter';

/**
 * @import { Entry, FilteringConditions, InternalCollection } from '$lib/types/private';
 */

// Mock dependencies
vi.mock('svelte/store', () => ({
  derived: vi.fn(() => ({
    subscribe: vi.fn(() => vi.fn()),
  })),
  get: vi.fn(() => ({})),
  writable: vi.fn(() => ({ subscribe: vi.fn() })),
}));

vi.mock('$lib/services/assets/view', () => ({
  currentView: {
    subscribe: vi.fn(() => vi.fn()),
    set: vi.fn(),
  },
}));

vi.mock('$lib/services/contents/collection', () => ({
  selectedCollection: {
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock('$lib/services/contents/collection/view/settings', () => ({
  entryListSettings: {
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getPropertyValue: vi.fn(),
}));

vi.mock('$lib/services/utils/misc', () => ({
  getRegex: vi.fn(),
}));

describe('Test filterEntries()', async () => {
  const { getPropertyValue } = await import('$lib/services/contents/entry/fields');
  const { getRegex } = await import('$lib/services/utils/misc');

  /** @type {InternalCollection} */
  const mockCollection = {
    name: 'posts',
    _type: 'entry',
    _i18n: {
      i18nEnabled: false,
      allLocales: ['en'],
      initialLocales: ['en'],
      defaultLocale: 'en',
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nRootMultiFolder: false,
      },
      canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
      omitDefaultLocaleFromFileName: false,
    },
    view_filters: [
      { field: 'status', pattern: 'published', label: 'Published' },
      { field: 'category', pattern: 'tech', label: 'Tech' },
      { field: 'title', pattern: /^Test/, label: 'Test Title' },
      { field: 'title', pattern: 'Test.*', label: 'Test Pattern' }, // Add the pattern for the test
      { field: 'featured', pattern: true, label: 'Featured' },
    ],
    fields: [],
    folder: 'content/posts',
    _file: { extension: 'md', format: 'frontmatter' },
    _thumbnailFieldNames: [],
  };

  /** @type {any[]} */
  const mockEntries = [
    {
      id: 'entry1',
      slug: 'entry-1',
      locales: {
        en: {
          status: 'published',
          category: 'tech',
          title: 'Test Article',
          featured: true,
        },
      },
      sha: 'abc123',
      path: 'content/posts/entry1.md',
    },
    {
      id: 'entry2',
      slug: 'entry-2',
      locales: {
        en: {
          status: 'draft',
          category: 'tech',
          title: 'Draft Article',
          featured: false,
        },
      },
      sha: 'def456',
      path: 'content/posts/entry2.md',
    },
    {
      id: 'entry3',
      slug: 'entry-3',
      locales: {
        en: {
          status: 'published',
          category: 'design',
          title: 'Design Article',
          featured: true,
        },
      },
      sha: 'ghi789',
      path: 'content/posts/entry3.md',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getPropertyValue to return the locale values
    vi.mocked(getPropertyValue).mockImplementation(
      ({ entry, key }) => /** @type {any} */ (entry).locales?.en?.[key],
    );

    // Mock getRegex
    vi.mocked(getRegex).mockImplementation((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern;
      }

      if (typeof pattern === 'string' && pattern.startsWith('/') && pattern.endsWith('/')) {
        return new RegExp(pattern.slice(1, -1));
      }

      return undefined;
    });
  });

  test('filters entries with exact string match', () => {
    /** @type {FilteringConditions[]} */
    const filters = [{ field: 'status', pattern: 'published' }];
    const result = filterEntries(mockEntries, mockCollection, filters);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['entry1', 'entry3']);
  });

  test('filters entries with multiple conditions (AND logic)', () => {
    /** @type {FilteringConditions[]} */
    const filters = [
      { field: 'status', pattern: 'published' },
      { field: 'category', pattern: 'tech' },
    ];

    const result = filterEntries(mockEntries, mockCollection, filters);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('entry1');
  });

  test('filters entries with regex pattern', () => {
    /** @type {FilteringConditions[]} */
    const filters = [{ field: 'title', pattern: /^Test/ }];
    const result = filterEntries(mockEntries, mockCollection, filters);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('entry1');
  });

  test('filters entries with boolean pattern', () => {
    /** @type {FilteringConditions[]} */
    const filters = [{ field: 'featured', pattern: true }];
    const result = filterEntries(mockEntries, mockCollection, filters);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['entry1', 'entry3']);
  });

  test('returns all entries when no filters are provided', () => {
    const result = filterEntries(mockEntries, mockCollection, []);

    expect(result).toHaveLength(3);
    expect(result).toEqual(mockEntries);
  });

  test('ignores invalid filters not in view_filters config', () => {
    /** @type {FilteringConditions[]} */
    const filters = [
      { field: 'status', pattern: 'published' }, // Valid
      { field: 'invalid_field', pattern: 'value' }, // Invalid - not in config
      { field: 'category', pattern: 'invalid_pattern' }, // Invalid - pattern not in config
    ];

    const result = filterEntries(mockEntries, mockCollection, filters);

    // Should only apply the valid 'status' filter
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['entry1', 'entry3']);
  });

  test('ignores filters with undefined field or pattern', () => {
    /** @type {FilteringConditions[]} */
    const filters = [
      { field: 'status', pattern: 'published' }, // Valid
      /** @type {any} */ ({ field: undefined, pattern: 'value' }), // Invalid
      /** @type {any} */ ({ field: 'category', pattern: undefined }), // Invalid
    ];

    const result = filterEntries(mockEntries, mockCollection, filters);

    // Should only apply the valid 'status' filter
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['entry1', 'entry3']);
  });

  test('handles entries with undefined property values', () => {
    // Create custom mock for this test only
    const customGetPropertyValue = vi.fn(({ entry, key }) => {
      if (/** @type {any} */ (entry).id === 'entry2' && key === 'status') {
        return undefined;
      }

      return /** @type {any} */ (entry).locales?.en?.[key];
    });

    vi.mocked(getPropertyValue).mockImplementation(customGetPropertyValue);

    /** @type {FilteringConditions[]} */
    const filters = [{ field: 'status', pattern: 'published' }];
    const result = filterEntries(mockEntries, mockCollection, filters);

    // Only entry1 and entry3 have status 'published', but entry2 has undefined status
    // so it should be filtered out, leaving entry1 and entry3
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['entry1', 'entry3']);
  });

  test('checks both raw and referenced values', () => {
    // Mock getPropertyValue to return different values for raw vs referenced
    vi.mocked(getPropertyValue).mockImplementation(({ entry, key, resolveRef = true }) => {
      if (/** @type {any} */ (entry).id === 'entry1' && key === 'status') {
        return resolveRef ? 'published' : 'ref:published';
      }

      return /** @type {any} */ (entry).locales?.en?.[key];
    });

    /** @type {FilteringConditions[]} */
    const filters = [{ field: 'status', pattern: 'published' }];
    const result = filterEntries(mockEntries, mockCollection, filters);

    // Should match because referenced value is 'published'
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['entry1', 'entry3']);
  });

  test('handles regex patterns from getRegex', () => {
    // Clear all previous mocks and set fresh ones
    vi.resetAllMocks();

    // Mock getPropertyValue to return the locale values
    vi.mocked(getPropertyValue).mockImplementation(
      ({ entry, key }) => /** @type {any} */ (entry).locales?.en?.[key],
    );

    // Mock getRegex to return a regex ONLY for the specific test pattern
    vi.mocked(getRegex).mockImplementation((pattern) => {
      // Only return regex for our test pattern
      if (pattern === 'Test.*') {
        return /Test.*/;
      }

      // Return undefined for all other patterns (like the config patterns)
      return undefined;
    });

    /** @type {FilteringConditions[]} */
    const filters = [{ field: 'title', pattern: 'Test.*' }];
    const result = filterEntries(mockEntries, mockCollection, filters);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('entry1');
  });

  test('handles collection without view_filters config', () => {
    const collectionWithoutFilters = {
      ...mockCollection,
      view_filters: undefined,
    };

    /** @type {FilteringConditions[]} */
    const filters = [{ field: 'status', pattern: 'published' }];
    const result = filterEntries(mockEntries, collectionWithoutFilters, filters);

    // Should return all entries since no filters are configured
    expect(result).toHaveLength(3);
    expect(result).toEqual(mockEntries);
  });

  test('handles empty view_filters config', () => {
    const collectionWithEmptyFilters = {
      ...mockCollection,
      view_filters: [],
    };

    /** @type {FilteringConditions[]} */
    const filters = [{ field: 'status', pattern: 'published' }];
    const result = filterEntries(mockEntries, collectionWithEmptyFilters, filters);

    // Should return all entries since no filters are configured
    expect(result).toHaveLength(3);
    expect(result).toEqual(mockEntries);
  });

  test('handles regex test against both raw and referenced values', () => {
    // Mock getRegex to return a regex
    vi.mocked(getRegex).mockReturnValue(/^Test/);

    // Mock getPropertyValue to return different values for raw vs referenced
    vi.mocked(getPropertyValue).mockImplementation(({ entry, key, resolveRef = true }) => {
      if (/** @type {any} */ (entry).id === 'entry2' && key === 'title') {
        return resolveRef ? 'Test Referenced Title' : 'Draft Article';
      }

      return /** @type {any} */ (entry).locales?.en?.[key];
    });

    /** @type {FilteringConditions[]} */
    const filters = [{ field: 'title', pattern: /^Test/ }];
    const result = filterEntries(mockEntries, mockCollection, filters);

    // Should match entry1 (raw value) and entry2 (referenced value)
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['entry1', 'entry2']);
  });

  test('handles string conversion for regex testing', () => {
    // Mock getRegex to return a regex
    vi.mocked(getRegex).mockReturnValue(/tech/i);

    // Mock getPropertyValue to return non-string values
    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'category') {
        return { name: 'tech', id: 1 }; // Object value
      }

      return /** @type {any} */ (entry).locales?.en?.[key];
    });

    /** @type {FilteringConditions[]} */
    const filters = [{ field: 'category', pattern: /tech/i }];
    const result = filterEntries(mockEntries, mockCollection, filters);

    // Should convert object to string and test regex
    expect(result).toHaveLength(3);
  });
});

describe('Test parseFilterConfig()', () => {
  test('returns empty options for undefined input', () => {
    const result = parseFilterConfig(undefined);

    expect(result).toEqual({ options: [] });
  });

  test('returns empty options for null input', () => {
    const result = parseFilterConfig(/** @type {any} */ (null));

    expect(result).toEqual({ options: [] });
  });

  test('returns empty options for empty array', () => {
    const result = parseFilterConfig([]);

    expect(result).toEqual({ options: [] });
  });

  test('parses array format (Netlify/Decap CMS compatible)', () => {
    const filters = [
      { field: 'status', pattern: 'published', label: 'Published' },
      { field: 'category', pattern: 'tech', label: 'Tech' },
    ];

    const result = parseFilterConfig(filters);

    expect(result).toEqual({ options: filters });
  });

  test('parses object format without default (Static CMS compatible)', () => {
    const filters = {
      filters: [
        { field: 'status', pattern: 'published', label: 'Published' },
        { field: 'category', pattern: 'tech', label: 'Tech' },
      ],
    };

    const result = parseFilterConfig(filters);

    expect(result).toEqual({
      options: filters.filters,
      default: undefined,
    });
  });

  test('parses object format with default (Static CMS compatible)', () => {
    const filters = {
      filters: [
        { name: 'published', field: 'status', pattern: 'published', label: 'Published' },
        { name: 'tech', field: 'category', pattern: 'tech', label: 'Tech' },
      ],
      default: 'published',
    };

    const result = parseFilterConfig(filters);

    expect(result).toEqual({
      options: filters.filters,
      default: { field: 'status', pattern: 'published' },
    });
  });

  test('handles object format with invalid default name', () => {
    const filters = {
      filters: [
        { name: 'published', field: 'status', pattern: 'published', label: 'Published' },
        { name: 'tech', field: 'category', pattern: 'tech', label: 'Tech' },
      ],
      default: 'nonexistent',
    };

    const result = parseFilterConfig(filters);

    expect(result).toEqual({
      options: filters.filters,
      default: undefined,
    });
  });

  test('returns empty options for object with empty filters array', () => {
    const filters = {
      filters: [],
      default: 'published',
    };

    const result = parseFilterConfig(filters);

    expect(result).toEqual({ options: [] });
  });

  test('returns empty options for object with undefined filters', () => {
    const filters = /** @type {any} */ ({
      default: 'published',
    });

    const result = parseFilterConfig(filters);

    expect(result).toEqual({ options: [] });
  });

  test('returns empty options for object with non-array filters', () => {
    const filters = /** @type {any} */ ({
      filters: 'not an array',
      default: 'published',
    });

    const result = parseFilterConfig(filters);

    expect(result).toEqual({ options: [] });
  });

  test('returns empty options for non-object, non-array input', () => {
    const result = parseFilterConfig(/** @type {any} */ ('invalid'));

    expect(result).toEqual({ options: [] });
  });
});

describe('initializeViewFilters', () => {
  test('calls set with empty array when collection is undefined', async () => {
    const { initializeViewFilters } = await import('./filter');
    const mockSet = vi.fn();

    initializeViewFilters(undefined, mockSet);

    expect(mockSet).toHaveBeenCalledWith([]);
  });

  test('calls set with empty array for file collection', async () => {
    const { initializeViewFilters } = await import('./filter');
    const mockSet = vi.fn();

    const fileCollection = /** @type {any} */ ({
      name: 'pages',
      _type: 'file',
      files: [],
      _fileMap: {},
    });

    initializeViewFilters(fileCollection, mockSet);

    expect(mockSet).toHaveBeenCalledWith([]);
  });

  test('processes and sets filters for entry collection', async () => {
    const { initializeViewFilters } = await import('./filter');
    const { currentView } = await import('$lib/services/contents/collection/view');
    const mockSet = vi.fn();

    vi.mocked(currentView).update = vi.fn();

    const entryCollection = /** @type {any} */ ({
      name: 'posts',
      _type: 'entry',
      folder: 'content/posts',
      view_filters: [
        { field: 'status', pattern: 'published', name: 'published' },
        { field: 'category', pattern: 'tech', name: 'tech' },
      ],
    });

    initializeViewFilters(entryCollection, mockSet);

    expect(mockSet).toHaveBeenCalledWith([
      { field: 'status', pattern: 'published', name: 'published' },
      { field: 'category', pattern: 'tech', name: 'tech' },
    ]);

    expect(vi.mocked(currentView).update).toHaveBeenCalled();
  });

  test('handles entry collection with no view_filters', async () => {
    const { initializeViewFilters } = await import('./filter');
    const { currentView } = await import('$lib/services/contents/collection/view');
    const mockSet = vi.fn();

    vi.mocked(currentView).update = vi.fn();

    const entryCollection = /** @type {any} */ ({
      name: 'posts',
      _type: 'entry',
      folder: 'content/posts',
    });

    initializeViewFilters(entryCollection, mockSet);

    expect(mockSet).toHaveBeenCalledWith([]);

    expect(vi.mocked(currentView).update).toHaveBeenCalled();
  });

  test('handles entry collection with view_filters object format', async () => {
    const { initializeViewFilters } = await import('./filter');
    const { currentView } = await import('$lib/services/contents/collection/view');
    const mockSet = vi.fn();

    vi.mocked(currentView).update = vi.fn();

    const entryCollection = /** @type {any} */ ({
      name: 'posts',
      _type: 'entry',
      folder: 'content/posts',
      view_filters: {
        filters: [
          { field: 'status', pattern: 'published', name: 'published' },
          { field: 'category', pattern: 'tech', name: 'tech' },
        ],
        default: 'published',
      },
    });

    initializeViewFilters(entryCollection, mockSet);

    expect(mockSet).toHaveBeenCalledWith([
      { field: 'status', pattern: 'published', name: 'published' },
      { field: 'category', pattern: 'tech', name: 'tech' },
    ]);

    expect(vi.mocked(currentView).update).toHaveBeenCalled();
  });
});
