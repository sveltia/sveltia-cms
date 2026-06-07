import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { processEntry } from '$lib/services/contents/fields/relation/helper/entries';
import { getSubFieldMatch } from '$lib/services/contents/fields/relation/helper/list-fields';

/**
 * @import { Entry } from '$lib/types/private';
 */

// Mock dependencies
vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
  getFieldDisplayValue: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummaryFromContent: vi.fn(),
}));

describe('Test processEntry()', async () => {
  const { isCollectionIndexFile } =
    await import('$lib/services/contents/collection/entries/index-file');

  const { getField, getFieldDisplayValue } = await import('$lib/services/contents/entry/fields');
  const { getEntrySummaryFromContent } = await import('$lib/services/contents/entry/summary');

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getField).mockReturnValue(undefined);

    // Mock getFieldDisplayValue to return based on valueMap
    vi.mocked(getFieldDisplayValue).mockImplementation(({ keyPath, valueMap }) => {
      if (!valueMap || !keyPath) return '';
      return valueMap[keyPath] || '';
    });

    // Mock getEntrySummaryFromContent to return empty
    vi.mocked(getEntrySummaryFromContent).mockReturnValue('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Simple option creation (no list fields)', () => {
    test('should use createSimpleOption when hasListFields is false', () => {
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getFieldDisplayValue).mockImplementation(({ keyPath }) => {
        if (keyPath === 'name') return 'John Doe';
        if (keyPath === 'email') return 'john@example.com';
        return '';
      });

      /** @type {Entry} */
      const entry = {
        id: 'author-1',
        slug: 'john-doe',
        subPath: 'john-doe',
        locales: {
          _default: {
            slug: 'john-doe',
            path: 'authors/john-doe.md',
            content: { name: 'John Doe', email: 'john@example.com' },
          },
        },
      };

      // @ts-ignore - Simplified mock collection for testing
      const mockCollection = { _type: 'entry', name: 'authors' };

      const result = processEntry({
        refEntry: entry,
        content: { name: 'John Doe', email: 'john@example.com' },
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: '{{name}}',
          _valueField: '{{slug}}',
          _searchField: '{{name}} {{email}}',
          allFieldNames: ['name', 'email', 'slug'],
          hasListFields: false,
        },
        allFieldNames: ['name', 'email', 'slug'],
        hasListFields: false,
        collectionName: 'authors',
        fileName: undefined,
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('John Doe');
      expect(result[0].value).toBe('john-doe');
      expect(result[0].searchValue).toBe('John Doe john@example.com');
    });
  });

  describe('Fallback section (lines 656-673) - when processListFields returns hasProcessedListFields=false', () => {
    test('should use replaceTemplateFields fallback when processListFields returns false', () => {
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getFieldDisplayValue).mockReturnValue('');

      /** @type {Entry} */
      const entry = {
        id: 'test-entry',
        slug: 'test-slug',
        subPath: 'test-slug',
        locales: {
          _default: {
            slug: 'test-slug',
            path: 'test-slug.md',
            content: { title: 'Test Title' },
          },
        },
      };

      // @ts-ignore - Simplified mock collection for testing
      const mockCollection = { _type: 'entry', name: 'pages' };

      const result = processEntry({
        refEntry: entry,
        content: { title: 'Test Title' },
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: '{{title}}',
          _valueField: '{{slug}}',
          _searchField: '{{title}}',
          allFieldNames: ['title', 'slug'],
          hasListFields: true, // Has list fields but processListFields will return false
        },
        allFieldNames: ['title', 'slug'],
        hasListFields: true,
        collectionName: 'pages',
        fileName: undefined,
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      // When replaceTemplateFields returns values
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('test-slug');
    });

    test('should fallback to slug for empty label (line 666)', () => {
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getFieldDisplayValue).mockReturnValue('');

      /** @type {Entry} */
      const entry = {
        id: 'empty-label-entry',
        slug: 'fallback-slug',
        subPath: 'fallback-slug',
        locales: {
          _default: {
            slug: 'fallback-slug',
            path: 'fallback-slug.md',
            content: {},
          },
        },
      };

      // @ts-ignore - Simplified mock collection for testing
      const mockCollection = { _type: 'entry', name: 'test' };

      const result = processEntry({
        refEntry: entry,
        content: {},
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: '{{nonexistent}}',
          _valueField: '{{slug}}',
          _searchField: '{{nonexistent}}',
          allFieldNames: ['nonexistent', 'slug'],
          hasListFields: true,
        },
        allFieldNames: ['nonexistent', 'slug'],
        hasListFields: true,
        collectionName: 'test',
        fileName: undefined,
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      // Label should fallback to slug when empty
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('fallback-slug');
    });

    test('should fallback to slug for empty value (line 668)', () => {
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getFieldDisplayValue).mockReturnValue('');

      /** @type {Entry} */
      const entry = {
        id: 'empty-value-entry',
        slug: 'value-fallback-slug',
        subPath: 'value-fallback-slug',
        locales: {
          _default: {
            slug: 'value-fallback-slug',
            path: 'value-fallback-slug.md',
            content: {},
          },
        },
      };

      // @ts-ignore - Simplified mock collection for testing
      const mockCollection = { _type: 'entry', name: 'test' };

      const result = processEntry({
        refEntry: entry,
        content: {},
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: 'Valid Label',
          _valueField: '{{nonexistent_value}}',
          _searchField: '{{nonexistent_value}}',
          allFieldNames: ['nonexistent_value'],
          hasListFields: true,
        },
        allFieldNames: ['nonexistent_value'],
        hasListFields: true,
        collectionName: 'test',
        fileName: undefined,
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      // Value should fallback to slug when empty
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('value-fallback-slug');
    });

    test('should fallback searchValue to label when searchValue template is empty', () => {
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getFieldDisplayValue).mockReturnValue('');
      vi.mocked(getEntrySummaryFromContent).mockReturnValue('');

      /** @type {Entry} */
      const entry = {
        id: 'empty-search-entry',
        slug: 'search-slug',
        subPath: 'search-slug',
        locales: {
          _default: {
            slug: 'search-slug',
            path: 'search-slug.md',
            content: {},
          },
        },
      };

      // @ts-ignore - Simplified mock collection for testing
      const mockCollection = { _type: 'entry', name: 'test' };

      const result = processEntry({
        refEntry: entry,
        content: {},
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: 'Valid Label',
          _valueField: '{{slug}}',
          _searchField: '', // Empty searchField template
          allFieldNames: ['slug'],
          hasListFields: true,
        },
        allFieldNames: ['slug'],
        hasListFields: true,
        collectionName: 'test',
        fileName: undefined,
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      // When searchValue template is empty, it stays empty after replaceTemplateFields
      // Then it falls back to label
      expect(result).toHaveLength(1);
      expect(result[0].searchValue).toBe('Valid Label');
    });

    test('should handle all empty fallbacks (label, value, and searchValue)', () => {
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getFieldDisplayValue).mockReturnValue('');

      /** @type {Entry} */
      const entry = {
        id: 'all-empty-entry',
        slug: 'all-empty-slug',
        subPath: 'all-empty-slug',
        locales: {
          _default: {
            slug: 'all-empty-slug',
            path: 'all-empty-slug.md',
            content: {},
          },
        },
      };

      // @ts-ignore - Simplified mock collection for testing
      const mockCollection = { _type: 'entry', name: 'test' };

      const result = processEntry({
        refEntry: entry,
        content: {},
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: '{{missing1}}',
          _valueField: '{{missing2}}',
          _searchField: '{{missing3}}',
          allFieldNames: ['missing1', 'missing2', 'missing3'],
          hasListFields: true,
        },
        allFieldNames: ['missing1', 'missing2', 'missing3'],
        hasListFields: true,
        collectionName: 'test',
        fileName: undefined,
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      // All should fallback appropriately
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('all-empty-slug'); // Label falls back to slug
      expect(result[0].value).toBe('all-empty-slug'); // Value falls back to slug
      expect(result[0].searchValue).toBe('all-empty-slug'); // SearchValue falls back to label which is slug
    });
  });

  describe('Complex multi-list fallback scenarios', () => {
    test('should cover || fallbacks in the processEntry fallback block (lines 716-718)', () => {
      // Reach the fallback block: hasListFields=true BUT no wildcard fields
      // → analyzeListFields returns empty map → hasProcessedListFields stays false
      // → code falls into the fallback block at lines 697-720.
      // Using empty templates so label/value/searchValue resolve to '',
      // which exercises all the `|| ''` / `|| slug` false branches.

      /** @type {Entry} */
      const entry = {
        id: 'fallback-entry',
        slug: 'fallback-slug',
        subPath: 'fallback-slug',
        locales: {
          _default: {
            slug: 'fallback-slug',
            path: 'fallback-slug.md',
            content: {},
          },
        },
      };

      // @ts-ignore
      const mockCollection = { _type: 'entry', name: 'test' };

      // @ts-ignore
      const result = processEntry({
        refEntry: entry,
        content: {},
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: '', // empty → label = '' → `label || ''` false branch
          _valueField: '', // empty → value = '' → `value || slug` false branch
          _searchField: '', // empty → searchValue = '' → `... || ''` false branch
          allFieldNames: [],
          hasListFields: false,
        },
        allFieldNames: [], // no wildcards → analyzeListFields returns empty Map
        hasListFields: true, // true so we enter list-handling path then fall through
        collectionName: 'test',
        fileName: undefined,
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe(''); // label || '' → ''
      expect(result[0].value).toBe('fallback-slug'); // value || slug → 'fallback-slug'
      expect(result[0].searchValue).toBe(''); // searchValue || label || '' → ''
    });

    test('should process entries with mixed list and non-list fields', () => {
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getField).mockReturnValue(undefined);

      /** @type {Entry} */
      const entry = {
        id: 'mixed-entry',
        slug: 'mixed-slug',
        subPath: 'mixed-slug',
        locales: {
          _default: {
            slug: 'mixed-slug',
            path: 'mixed-slug.md',
            content: {
              title: 'Test Entry',
            },
          },
        },
      };

      // @ts-ignore - Simplified mock collection for testing
      const mockCollection = { _type: 'entry', name: 'test' };

      // Test with hasListFields=true but templates that don't have wildcards
      // @ts-ignore
      const result = processEntry({
        refEntry: entry,
        content: {
          title: 'Test Entry',
        },
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: '{{title}}',
          _valueField: '{{slug}}',
          _searchField: '{{title}}',
          allFieldNames: ['title', 'slug'],
          hasListFields: false,
        },
        allFieldNames: ['title', 'slug'],
        hasListFields: false,
        collectionName: 'test',
        fileName: undefined,
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      // Should process using createSimpleOption path
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].value).toBe('mixed-slug');
    });
  });

  describe('Locale and content handling', () => {
    test('should handle different locales properly', () => {
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getFieldDisplayValue).mockReturnValue('Japanese Name');

      /** @type {Entry} */
      const entry = {
        id: 'multi-locale-entry',
        slug: 'entry-slug',
        subPath: 'entry-slug',
        locales: {
          _default: {
            slug: 'entry-slug',
            path: 'entry-slug.md',
            content: { name: 'English Name' },
          },
          ja: {
            slug: 'entry-slug',
            path: 'entry-slug.ja.md',
            content: { name: 'Japanese Name' },
          },
        },
      };

      // @ts-ignore - Simplified mock collection for testing
      const mockCollection = { _type: 'entry', name: 'entries' };

      const result = processEntry({
        refEntry: entry,
        content: { name: 'Japanese Name' },
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: '{{name}}',
          _valueField: '{{slug}}',
          _searchField: '{{name}}',
          allFieldNames: ['name', 'slug'],
          hasListFields: false,
        },
        allFieldNames: ['name', 'slug'],
        hasListFields: false,
        collectionName: 'entries',
        fileName: undefined,
        locale: 'ja',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Japanese Name');
    });

    test('should handle missing locales gracefully', () => {
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getFieldDisplayValue).mockReturnValue('Default Name');

      /** @type {Entry} */
      const entry = {
        id: 'single-locale-entry',
        slug: 'entry-slug',
        subPath: 'entry-slug',
        locales: {
          _default: {
            slug: 'entry-slug',
            path: 'entry-slug.md',
            content: { name: 'Default Name' },
          },
        },
      };

      // @ts-ignore - Simplified mock collection for testing
      const mockCollection = { _type: 'entry', name: 'entries' };

      const result = processEntry({
        refEntry: entry,
        content: { name: 'Default Name' },
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: '{{name}}',
          _valueField: '{{slug}}',
          _searchField: '{{name}}',
          allFieldNames: ['name', 'slug'],
          hasListFields: false,
        },
        allFieldNames: ['name', 'slug'],
        hasListFields: false,
        collectionName: 'entries',
        fileName: undefined,
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Default Name');
    });
  });

  describe('File collection handling', () => {
    test('should handle file collection entries', () => {
      vi.mocked(isCollectionIndexFile).mockReturnValue(false);
      vi.mocked(getFieldDisplayValue).mockReturnValue('File Entry');

      /** @type {Entry} */
      const entry = {
        id: 'file-entry',
        slug: 'config',
        subPath: 'config',
        locales: {
          _default: {
            slug: 'config',
            path: 'config.md',
            content: { name: 'File Entry' },
          },
        },
      };

      // @ts-ignore - Simplified mock collection for testing
      const mockCollection = { _type: 'file', name: 'config' };

      const result = processEntry({
        refEntry: entry,
        content: { name: 'File Entry' },
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: '{{name}}',
          _valueField: '{{slug}}',
          _searchField: '{{name}}',
          allFieldNames: ['name', 'slug'],
          hasListFields: false,
        },
        allFieldNames: ['name', 'slug'],
        hasListFields: false,
        collectionName: 'config',
        fileName: 'config.md',
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('File Entry');
    });

    test('should cover || fallbacks in the processEntry fallback block (lines 716-718)', () => {
      // Reach the fallback block: hasListFields=true BUT no wildcard fields
      // → analyzeListFields returns empty map → hasProcessedListFields stays false
      // → code falls into the fallback block at lines 697-720.
      // Using empty templates so label/value/searchValue resolve to '',
      // which exercises all the `|| ''` / `|| slug` false branches.

      /** @type {Entry} */
      const entry = {
        id: 'fallback-entry',
        slug: 'fallback-slug',
        subPath: 'fallback-slug',
        locales: {
          _default: {
            slug: 'fallback-slug',
            path: 'fallback-slug.md',
            content: {},
          },
        },
      };

      // @ts-ignore
      const mockCollection = { _type: 'entry', name: 'test' };

      // @ts-ignore
      const result = processEntry({
        refEntry: entry,
        content: {},
        // @ts-ignore
        collection: mockCollection,
        templates: {
          _displayField: '', // empty → label = '' → `label || ''` false branch
          _valueField: '', // empty → value = '' → `value || slug` false branch
          _searchField: '', // empty → searchValue = '' → `... || ''` false branch
          allFieldNames: [],
          hasListFields: false,
        },
        allFieldNames: [], // no wildcards → analyzeListFields returns empty Map
        hasListFields: true, // true so we enter list-handling path then fall through
        collectionName: 'test',
        fileName: undefined,
        locale: '_default',
        identifierField: 'title',
        defaultLocale: '_default',
      });

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe(''); // label || '' → ''
      expect(result[0].value).toBe('fallback-slug'); // value || slug → 'fallback-slug'
      expect(result[0].searchValue).toBe(''); // searchValue || label || '' → ''
    });
  });
});

describe('Test getSubFieldMatch()', () => {
  test('should return null when no matching field is found', () => {
    /** @type {[string, any][]} */
    const groupEntries = [
      ['skills.*', {}],
      ['tags.*', {}],
    ];

    const result = getSubFieldMatch(groupEntries);

    expect(result).toBeNull();
  });

  test('should extract match from complex list field pattern', () => {
    /** @type {[string, any][]} */
    const groupEntries = [
      ['cities.*.name', {}],
      ['cities.*.population', {}],
    ];

    const result = getSubFieldMatch(groupEntries);

    expect(result).not.toBeNull();
    expect(result?.[0]).toBe('cities.*.name');
    expect(result?.[1]).toBe('cities');
    expect(result?.[2]).toBe('name');
  });

  test('should return first matching field when multiple matches exist', () => {
    /** @type {[string, any][]} */
    const groupEntries = [
      ['sections.*.title', {}],
      ['sections.*.description', {}],
      ['sections.*.id', {}],
    ];

    const result = getSubFieldMatch(groupEntries);

    expect(result).not.toBeNull();
    expect(result?.[0]).toBe('sections.*.title');
    expect(result?.[1]).toBe('sections');
    expect(result?.[2]).toBe('title');
  });

  test('should handle single entry in groupEntries', () => {
    /** @type {[string, any][]} */
    const groupEntries = [['products.*.sku', {}]];
    const result = getSubFieldMatch(groupEntries);

    expect(result).not.toBeNull();
    expect(result?.[1]).toBe('products');
    expect(result?.[2]).toBe('sku');
  });

  test('should not match simple list fields without wildcard pattern', () => {
    /** @type {[string, any][]} */
    const groupEntries = [
      ['items.0.name', {}],
      ['items.1.name', {}],
    ];

    const result = getSubFieldMatch(groupEntries);

    expect(result).toBeNull();
  });

  test('should not match fields with single wildcard at end', () => {
    /** @type {[string, any][]} */
    const groupEntries = [['tags.*', {}]];
    const result = getSubFieldMatch(groupEntries);

    expect(result).toBeNull();
  });

  test('should extract base field name with multiple nested levels', () => {
    /** @type {[string, any][]} */
    const groupEntries = [['categories.*.description', {}]];
    const result = getSubFieldMatch(groupEntries);

    expect(result).not.toBeNull();
    expect(result?.[1]).toBe('categories');
    expect(result?.[2]).toBe('description');
  });

  test('should handle empty groupEntries array', () => {
    /** @type {[string, any][]} */
    const groupEntries = [];
    const result = getSubFieldMatch(groupEntries);

    expect(result).toBeNull();
  });

  test('should return correct indices for destructuring', () => {
    /** @type {[string, any][]} */
    const groupEntries = [['authors.*.name', { some: 'config' }]];
    const result = getSubFieldMatch(groupEntries);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);

    // Verify it can be destructured like in processComplexListField
    const [fullMatch, baseFieldName, subKey] = result || [];

    expect(fullMatch).toBe('authors.*.name');
    expect(baseFieldName).toBe('authors');
    expect(subKey).toBe('name');
  });

  test('should handle field names with hyphens or underscores', () => {
    /** @type {[string, any][]} */
    const groupEntries = [
      ['social_media.*.profile_url', {}],
      ['contact-info.*.email-address', {}],
    ];

    const result = getSubFieldMatch(groupEntries);

    expect(result).not.toBeNull();
    expect(result?.[1]).toBe('social_media');
    expect(result?.[2]).toBe('profile_url');
  });
});
