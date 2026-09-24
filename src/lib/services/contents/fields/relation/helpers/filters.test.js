import { describe, expect, test } from 'vitest';

import {
  filterAndPrepareEntries,
  resolveFilterValues,
} from '$lib/services/contents/fields/relation/helpers/filters';

/**
 * @import { Entry } from '$lib/types/private';
 */

describe('Test filterAndPrepareEntries()', () => {
  /** Plain entry collection, where a slug is a name rather than a path. */
  const collection = /** @type {any} */ ({ name: 'posts', folder: 'content/posts' });
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
    const result = filterAndPrepareEntries({ refEntries: entries, collection, locale });

    expect(result).toHaveLength(3);
    expect(result[0].refEntry.slug).toBe('entry-1');
    expect(result[0].content).toEqual({ title: 'Entry 1', status: 'published' });
  });

  test('should filter by fileName', () => {
    const result = filterAndPrepareEntries({
      refEntries: entries,
      collection,
      locale,
      fileName: 'entry-2',
    });

    expect(result).toHaveLength(1);
    expect(result[0].refEntry.slug).toBe('entry-2');
  });

  test('should apply entry filters', () => {
    const filters = [{ field: 'status', values: ['published'] }];

    const result = filterAndPrepareEntries({
      refEntries: entries,
      collection,
      locale,
      entryFilters: filters,
    });

    expect(result).toHaveLength(2);
    expect(result[0].refEntry.slug).toBe('entry-1');
    expect(result[1].refEntry.slug).toBe('entry-3');
  });

  test('should fall back to default locale', () => {
    const result = filterAndPrepareEntries({ refEntries: entries, collection, locale });

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

    const result = filterAndPrepareEntries({
      refEntries: multiEntries,
      collection,
      locale,
      entryFilters: filters,
    });

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

    const result = filterAndPrepareEntries({
      refEntries: entriesWithEmpty,
      collection,
      locale: 'en',
    });

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

    const result = filterAndPrepareEntries({
      refEntries: entriesWithWrongLocale,
      collection,
      locale: 'en',
    });

    // Content is empty ({}) so hasContent is false — entry is excluded
    expect(result).toHaveLength(0);
  });

  test('should exclude entries when exclude is true', () => {
    const filters = [{ field: 'status', values: ['published'], exclude: true }];

    const result = filterAndPrepareEntries({
      refEntries: entries,
      collection,
      locale,
      entryFilters: filters,
    });

    expect(result).toHaveLength(1);
    expect(result[0].refEntry.slug).toBe('entry-2'); // the draft entry
  });

  test('should skip filter when values array is empty', () => {
    // Empty values array means "no constraint" — all entries with content should pass
    const filters = [{ field: 'status', values: [] }];

    const result = filterAndPrepareEntries({
      refEntries: entries,
      collection,
      locale,
      entryFilters: filters,
    });

    expect(result).toHaveLength(3);
  });

  describe('list field values', () => {
    /**
     * Create an entry with the given flattened content.
     * @param {string} slug Entry slug.
     * @param {Record<string, any>} content Flattened content.
     * @returns {Entry} Entry.
     */
    const createEntry = (slug, content) => ({
      id: slug,
      slug,
      subPath: slug,
      locales: { en: { slug, path: `${slug}.md`, content: { title: slug, ...content } } },
    });

    /** @type {Entry[]} */
    const listEntries = [
      createEntry('cats-birds', { 'pets.0': 'cats', 'pets.1': 'birds' }),
      createEntry('birds', { 'pets.0': 'birds' }),
      createEntry('dogs', { pets: 'dogs' }),
      createEntry('none', {}),
      createEntry('nested', { 'pets.0.name': 'cats' }),
      // Draft content stores an empty placeholder at the list’s own key path
      createEntry('placeholder', { pets: [], 'pets.0': 'dogs' }),
      createEntry('empty', { pets: [] }),
    ];

    /**
     * Get the slugs of the entries matching the given filters.
     * @param {any[]} entryFilters Entry filters.
     * @param {Entry[]} [refEntries] Reference entries.
     * @returns {string[]} Entry slugs.
     */
    const getSlugs = (entryFilters, refEntries = listEntries) =>
      filterAndPrepareEntries({ refEntries, collection, locale, entryFilters }).map(
        ({ refEntry }) => refEntry.slug,
      );

    test('should match a list value when any of its items is included', () => {
      expect(getSlugs([{ field: 'pets', values: ['cats', 'dogs'] }])).toEqual([
        'cats-birds',
        'dogs',
        'placeholder',
      ]);
    });

    test('should exclude a list value when any of its items is included', () => {
      expect(getSlugs([{ field: 'pets', values: ['cats', 'dogs'], exclude: true }])).toEqual([
        'birds',
        'none',
        'nested',
        'empty',
      ]);
    });

    test('should support the `fields.` prefix', () => {
      expect(getSlugs([{ field: 'fields.pets', values: ['birds'] }])).toEqual([
        'cats-birds',
        'birds',
      ]);
    });

    test('should match entries sharing a list item with the current entry', () => {
      const entryFilters = resolveFilterValues([{ field: 'pets', values: ['{{fields.pets}}'] }], {
        'pets.0': 'cats',
        'pets.1': 'dogs',
      });

      expect(getSlugs(entryFilters)).toEqual(['cats-birds', 'dogs', 'placeholder']);
    });

    test('should escape special characters in the field name', () => {
      /** @type {Entry[]} */
      const refEntries = [
        createEntry('match', { 'a+b.0': 'x' }),
        createEntry('no-match', { 'aab.0': 'x' }),
      ];

      expect(getSlugs([{ field: 'a+b', values: ['x'] }], refEntries)).toEqual(['match']);
    });
  });

  test('should filter by entry slug when field is "slug"', () => {
    // Bare `slug` refers to the entry slug (refEntry.slug), not a content field
    const filters = [{ field: 'slug', values: ['entry-1'] }];

    const result = filterAndPrepareEntries({
      refEntries: entries,
      collection,
      locale,
      entryFilters: filters,
    });

    expect(result).toHaveLength(1);
    expect(result[0].refEntry.slug).toBe('entry-1');
  });

  test('should exclude entry by slug when field is "slug" and exclude is true', () => {
    const filters = [{ field: 'slug', values: ['entry-1'], exclude: true }];

    const result = filterAndPrepareEntries({
      refEntries: entries,
      collection,
      locale,
      entryFilters: filters,
    });

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

    const result = filterAndPrepareEntries({
      refEntries: entriesWithSlugField,
      collection,
      locale: 'en',
      entryFilters: filters,
    });

    expect(result).toHaveLength(1);
    expect(result[0].refEntry.slug).toBe('entry-a');
  });

  test('should fall back to collection defaultLocale when entry lacks current locale', () => {
    // Issue #798: Entry doesn't have 'de' translation, but has 'en' (the defaultLocale)
    /** @type {Entry[]} */
    const entriesWithDefaultLocale = [
      {
        id: 'article-a',
        slug: 'article-a',
        subPath: 'article-a',
        locales: {
          id: { slug: 'article-a', path: 'id/article-a.md', content: { title: 'Artikel A' } },
          en: { slug: 'article-a', path: 'en/article-a.md', content: { title: 'Article A' } },
          fr: { slug: 'article-a', path: 'fr/article-a.md', content: { title: 'Article A' } },
          // No 'de' translation
        },
      },
    ];

    // When viewing in 'de' locale with collection defaultLocale 'en'
    const result = filterAndPrepareEntries({
      refEntries: entriesWithDefaultLocale,
      collection,
      locale: 'de',
      defaultLocale: 'en',
    });

    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual({ title: 'Article A' });
  });

  test('should still fall back to _default if defaultLocale is not available', () => {
    /** @type {Entry[]} */
    const entriesWithOnlyDefault = [
      {
        id: 'entry-x',
        slug: 'entry-x',
        subPath: 'entry-x',
        locales: {
          _default: { slug: 'entry-x', path: 'entry-x.md', content: { title: 'Entry X' } },
          // No 'de' or 'en' translations
        },
      },
    ];

    // When viewing in 'de' locale with collection defaultLocale 'en', but entry has neither
    const result = filterAndPrepareEntries({
      refEntries: entriesWithOnlyDefault,
      collection,
      locale: 'de',
      defaultLocale: 'en',
    });

    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual({ title: 'Entry X' });
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

  test('should expand a list value resolved from {{fields.x}} into its items', () => {
    const filters = [{ field: 'pets', values: ['fish', '{{fields.pets}}'] }];
    const result = resolveFilterValues(filters, { 'pets.0': 'cats', 'pets.1': 'birds' });

    expect(result[0].values).toEqual(['fish', 'cats', 'birds']);
  });

  test('should expand a list value stored next to its placeholder', () => {
    const filters = [{ field: 'tags', values: ['{{fields.tags}}'] }];
    const values = { tags: [], 'tags.0': 'a', 'tags.1': 'b' };
    const result = resolveFilterValues(filters, values);

    expect(result[0].values).toEqual(['a', 'b']);
    // The placeholder must not be filled in, as the values can be the live state of an entry draft
    expect(values.tags).toEqual([]);
  });

  test('should reflect list items added to or removed from the current values in place', () => {
    const filters = [{ field: 'tags', values: ['{{fields.tags}}'] }];
    /** @type {Record<string, any>} */
    const values = { tags: [], 'tags.0': 'a' };

    expect(resolveFilterValues(filters, values)[0].values).toEqual(['a']);

    values['tags.1'] = 'b';

    expect(resolveFilterValues(filters, values)[0].values).toEqual(['a', 'b']);

    delete values['tags.0'];
    delete values['tags.1'];
    values['tags.0'] = 'c';

    expect(resolveFilterValues(filters, values)[0].values).toEqual(['c']);
  });

  test('should only read the values it needs from the current values', () => {
    /** @type {string[]} */
    const reads = [];

    /**
     * Wrap values in a proxy recording the properties read, like a draft’s `$state` would track.
     * @param {Record<string, any>} values Values.
     * @returns {Record<string, any>} Proxy.
     */
    const track = (values) =>
      new Proxy(values, {
        /**
         * Record the property read, then read it.
         * @param {Record<string, any>} target Wrapped values.
         * @param {string | symbol} key Property key.
         * @returns {any} Property value.
         */
        get: (target, key) => {
          reads.push(String(key));

          return Reflect.get(target, key);
        },
      });

    const values = { uuid: 'abc', body: 'text', tags: [], 'tags.0': 'a' };

    resolveFilterValues([{ field: 'uuid', values: ['{{fields.uuid}}'] }], track(values));
    expect(reads).toEqual(['uuid']);

    reads.length = 0;
    resolveFilterValues([{ field: 'tags', values: ['{{fields.tags}}'] }], track(values));
    expect(reads).toEqual(['tags', 'tags.0']);
  });

  test('should resolve an empty list value from {{fields.x}} to no values', () => {
    const filters = [{ field: 'pets', values: ['{{fields.pets}}'] }];
    const result = resolveFilterValues(filters, { pets: [] });

    expect(result[0].values).toEqual([]);
  });
});
