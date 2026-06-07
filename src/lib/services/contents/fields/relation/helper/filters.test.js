import { describe, expect, test } from 'vitest';

import {
  filterAndPrepareEntries,
  resolveFilterValues,
} from '$lib/services/contents/fields/relation/helper/filters';

/**
 * @import { Entry } from '$lib/types/private';
 */

describe('Test filterAndPrepareEntries()', () => {
  const locale = 'en';

  /** @type {Entry[]} */
  const entries = [
    {
      id: 'entry-1',
      slug: 'entry-1',
      subPath: 'entry-1',
      locales: {
        en: {
          slug: 'entry-1',
          path: 'entry-1.md',
          content: { title: 'Entry 1', status: 'published' },
        },
      },
    },
    {
      id: 'entry-2',
      slug: 'entry-2',
      subPath: 'entry-2',
      locales: {
        en: { slug: 'entry-2', path: 'entry-2.md', content: { title: 'Entry 2', status: 'draft' } },
      },
    },
    {
      id: 'entry-3',
      slug: 'entry-3',
      subPath: 'entry-3',
      locales: {
        _default: {
          slug: 'entry-3',
          path: 'entry-3.md',
          content: { title: 'Entry 3', status: 'published' },
        },
      },
    },
  ];

  test('should return all entries with content when no filters', () => {
    const result = filterAndPrepareEntries(entries, locale);

    expect(result).toHaveLength(3);
    expect(result[0].refEntry.slug).toBe('entry-1');
    expect(result[0].content).toEqual({ title: 'Entry 1', status: 'published' });
  });

  test('should filter by fileName', () => {
    const result = filterAndPrepareEntries(entries, locale, 'entry-2');

    expect(result).toHaveLength(1);
    expect(result[0].refEntry.slug).toBe('entry-2');
  });

  test('should apply entry filters', () => {
    const filters = [{ field: 'status', values: ['published'] }];
    const result = filterAndPrepareEntries(entries, locale, undefined, filters);

    expect(result).toHaveLength(2);
    expect(result[0].refEntry.slug).toBe('entry-1');
    expect(result[1].refEntry.slug).toBe('entry-3');
  });

  test('should fall back to default locale', () => {
    const result = filterAndPrepareEntries(entries, locale);

    expect(result[2].content).toEqual({ title: 'Entry 3', status: 'published' });
  });

  test('should handle multiple filters', () => {
    /** @type {Entry[]} */
    const multiEntries = [
      {
        id: 'entry-1',
        slug: 'entry-1',
        subPath: 'entry-1',
        locales: {
          en: {
            slug: 'entry-1',
            path: 'entry-1.md',
            content: { status: 'published', category: 'tech' },
          },
        },
      },
      {
        id: 'entry-2',
        slug: 'entry-2',
        subPath: 'entry-2',
        locales: {
          en: {
            slug: 'entry-2',
            path: 'entry-2.md',
            content: { status: 'published', category: 'sports' },
          },
        },
      },
    ];

    const filters = [
      { field: 'status', values: ['published'] },
      { field: 'category', values: ['tech'] },
    ];

    const result = filterAndPrepareEntries(multiEntries, locale, undefined, filters);

    expect(result).toHaveLength(1);
    expect(result[0].refEntry.slug).toBe('entry-1');
  });

  test('should exclude entries with empty content', () => {
    /** @type {Entry[]} */
    const entriesWithEmpty = [
      {
        id: 'entry-1',
        slug: 'entry-1',
        subPath: 'entry-1',
        locales: {
          en: {
            slug: 'entry-1',
            path: 'entry-1.md',
            content: { title: 'Entry 1' },
          },
        },
      },
      {
        id: 'entry-2',
        slug: 'entry-2',
        subPath: 'entry-2',
        locales: {
          en: {
            slug: 'entry-2',
            path: 'entry-2.md',
            content: {}, // Empty content
          },
        },
      },
    ];

    const result = filterAndPrepareEntries(entriesWithEmpty, 'en');

    expect(result).toHaveLength(1);
    expect(result[0].refEntry.slug).toBe('entry-1');
  });

  test('falls back to {} when neither requested locale nor _default exists', () => {
    // Covers the ?? {} fallback on the locale lookup (line 270 idx 2) and
    // the content ?? {} assignment (line 275 idx 1). The entry has no 'en'
    // locale and no '_default' locale, so both lookups fail.
    /** @type {any[]} */
    const entriesWithWrongLocale = [
      {
        id: 'entry-fr',
        slug: 'entry-fr',
        subPath: 'entry-fr',
        locales: {
          fr: { slug: 'entry-fr', path: 'entry-fr.md', content: { title: 'Entrée' } },
        },
      },
    ];

    const result = filterAndPrepareEntries(entriesWithWrongLocale, 'en');

    // Content is empty ({}) so hasContent is false — entry is excluded
    expect(result).toHaveLength(0);
  });

  test('should exclude entries when exclude is true', () => {
    const filters = [{ field: 'status', values: ['published'], exclude: true }];
    const result = filterAndPrepareEntries(entries, locale, undefined, filters);

    expect(result).toHaveLength(1);
    expect(result[0].refEntry.slug).toBe('entry-2'); // the draft entry
  });

  test('should skip filter when values array is empty', () => {
    // Empty values array means "no constraint" — all entries with content should pass
    const filters = [{ field: 'status', values: [] }];
    const result = filterAndPrepareEntries(entries, locale, undefined, filters);

    expect(result).toHaveLength(3);
  });

  test('should filter by entry slug when field is "slug"', () => {
    // Bare `slug` refers to the entry slug (refEntry.slug), not a content field
    const filters = [{ field: 'slug', values: ['entry-1'] }];
    const result = filterAndPrepareEntries(entries, locale, undefined, filters);

    expect(result).toHaveLength(1);
    expect(result[0].refEntry.slug).toBe('entry-1');
  });

  test('should exclude entry by slug when field is "slug" and exclude is true', () => {
    const filters = [{ field: 'slug', values: ['entry-1'], exclude: true }];
    const result = filterAndPrepareEntries(entries, locale, undefined, filters);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.refEntry.slug)).toEqual(['entry-2', 'entry-3']);
  });

  test('should filter by content field named "slug" when field is "fields.slug"', () => {
    // `fields.slug` strips the prefix and looks up content['slug'], not refEntry.slug
    /** @type {Entry[]} */
    const entriesWithSlugField = [
      {
        id: 'a',
        slug: 'entry-a',
        subPath: 'a',
        locales: {
          en: { slug: 'entry-a', path: 'a.md', content: { slug: 'alpha', status: 'published' } },
        },
      },
      {
        id: 'b',
        slug: 'entry-b',
        subPath: 'b',
        locales: {
          en: { slug: 'entry-b', path: 'b.md', content: { slug: 'beta', status: 'published' } },
        },
      },
    ];

    const filters = [{ field: 'fields.slug', values: ['alpha'] }];
    const result = filterAndPrepareEntries(entriesWithSlugField, 'en', undefined, filters);

    expect(result).toHaveLength(1);
    expect(result[0].refEntry.slug).toBe('entry-a');
  });
});

describe('Test resolveFilterValues()', () => {
  test('should pass through non-template values unchanged', () => {
    const filters = [{ field: 'status', values: ['published', 42] }];
    const result = resolveFilterValues(filters, undefined);

    expect(result[0].values).toEqual(['published', 42]);
  });

  test('should resolve {{fields.x}} against currentLocaleValues', () => {
    const filters = [{ field: 'uuid', values: ['{{fields.uuid}}'] }];
    const result = resolveFilterValues(filters, { uuid: 'abc-123' });

    expect(result[0].values).toEqual(['abc-123']);
  });

  test('should drop template values that cannot be resolved', () => {
    const filters = [{ field: 'uuid', values: ['{{fields.uuid}}'] }];
    const result = resolveFilterValues(filters, undefined);

    expect(result[0].values).toEqual([]);
  });

  test('should drop templates whose key is absent from currentLocaleValues', () => {
    const filters = [{ field: 'uuid', values: ['{{fields.uuid}}'] }];
    const result = resolveFilterValues(filters, { other: 'something' });

    expect(result[0].values).toEqual([]);
  });

  test('should keep non-{{fields.x}} non-{{slug}} templates unchanged', () => {
    const filters = [{ field: 'x', values: ['{{unknown}}'] }];
    const result = resolveFilterValues(filters, { unknown: 'should-not-resolve' });

    expect(result[0].values).toEqual(['{{unknown}}']);
  });

  test('should resolve {{slug}} against currentSlug', () => {
    const filters = [{ field: 'slug', values: ['{{slug}}'] }];
    const result = resolveFilterValues(filters, undefined, 'my-article');

    expect(result[0].values).toEqual(['my-article']);
  });

  test('should drop {{slug}} when currentSlug is not available', () => {
    const filters = [{ field: 'slug', values: ['{{slug}}'] }];
    const result = resolveFilterValues(filters, undefined, undefined);

    expect(result[0].values).toEqual([]);
  });

  test('should drop {{slug}} when currentSlug is empty string (new entry)', () => {
    const filters = [{ field: 'slug', values: ['{{slug}}'] }];
    const result = resolveFilterValues(filters, undefined, '');

    expect(result[0].values).toEqual([]);
  });

  test('should resolve both {{slug}} and {{fields.x}} in same filter', () => {
    const filters = [{ field: 'key', values: ['{{slug}}', '{{fields.uuid}}'] }];
    const result = resolveFilterValues(filters, { uuid: 'abc-123' }, 'my-article');

    expect(result[0].values).toEqual(['my-article', 'abc-123']);
  });

  test('should preserve exclude flag', () => {
    const filters = [{ field: 'uuid', values: ['{{fields.uuid}}'], exclude: true }];
    const result = resolveFilterValues(filters, { uuid: 'abc-123' });

    expect(result[0].exclude).toBe(true);
    expect(result[0].values).toEqual(['abc-123']);
  });

  test('should handle mixed template and static values', () => {
    const filters = [{ field: 'tag', values: ['static', '{{fields.myTag}}'] }];
    const result = resolveFilterValues(filters, { myTag: 'dynamic' });

    expect(result[0].values).toEqual(['static', 'dynamic']);
  });
});
