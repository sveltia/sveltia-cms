// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getReferringEntries } from '$lib/services/contents/entry/referring';

/**
 * @import { Entry } from '$lib/types/private';
 */

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(() => []),
  writable: vi.fn(() => ({ subscribe: vi.fn() })),
}));

vi.mock('$lib/services/config', () => ({
  collectors: {
    relationFields: new Set(),
  },
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { subscribe: vi.fn() },
  allEntryFolders: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/relation/helper', () => ({
  getOptions: vi.fn(),
}));

describe('getReferringEntries()', async () => {
  const { collectors } = await import('$lib/services/config');
  const { get } = await import('svelte/store');
  const { getCollection } = await import('$lib/services/contents/collection');
  const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');
  const { getEntrySummary } = await import('$lib/services/contents/entry/summary');
  const { getOptions } = await import('$lib/services/contents/fields/relation/helper');

  /** @type {Entry} */
  const targetEntry = {
    id: 'tag-1',
    slug: 'travel',
    subPath: 'travel',
    locales: {
      _default: {
        slug: 'travel',
        path: 'content/tags/travel.md',
        content: { title: 'Travel', slug: 'travel' },
      },
    },
  };

  /** @type {Entry} */
  const postEntry1 = {
    id: 'post-1',
    slug: 'my-trip',
    subPath: 'my-trip',
    locales: {
      _default: {
        slug: 'my-trip',
        path: 'content/posts/my-trip.md',
        content: { title: 'My Trip', tags: 'travel' },
      },
    },
  };

  /** @type {Entry} */
  const postEntry2 = {
    id: 'post-2',
    slug: 'food-review',
    subPath: 'food-review',
    locales: {
      _default: {
        slug: 'food-review',
        path: 'content/posts/food-review.md',
        content: { title: 'Food Review', tags: 'food' },
      },
    },
  };

  /** @type {Entry} */
  const postEntryMultiple = {
    id: 'post-3',
    slug: 'travel-food',
    subPath: 'travel-food',
    locales: {
      _default: {
        slug: 'travel-food',
        path: 'content/posts/travel-food.md',
        content: { title: 'Travel & Food', 'tags.0': 'travel', 'tags.1': 'food' },
      },
    },
  };

  const tagsCollection = {
    name: 'tags',
    label: 'Tags',
    _type: 'entry',
    _i18n: { defaultLocale: '_default' },
  };

  const postsCollection = {
    name: 'posts',
    label: 'Blog Posts',
    _type: 'entry',
    identifier_field: 'title',
    _i18n: { defaultLocale: '_default' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    collectors.relationFields = new Set();
  });

  test('returns empty array when target collection is not found', () => {
    getCollection.mockReturnValue(undefined);

    expect(getReferringEntries({ collectionName: 'unknown', entry: targetEntry })).toEqual([]);
  });

  test('returns empty array when no relation fields reference the target collection', () => {
    getCollection.mockReturnValue(tagsCollection);
    collectors.relationFields = new Set();

    expect(getReferringEntries({ collectionName: 'tags', entry: targetEntry })).toEqual([]);
  });

  test('finds referring entries for a single-value relation field using slug', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tags',
      label: 'Tags',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: {
          collection: { name: 'posts' },
          typedKeyPath: 'tags',
        },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'posts') return [postEntry1, postEntry2];

      return [];
    });

    getEntrySummary.mockReturnValue('My Trip');

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].collectionName).toBe('posts');
    expect(result[0].collectionLabel).toBe('Blog Posts');
    expect(result[0].fieldLabel).toBe('Tags');
    expect(result[0].entry).toBe(postEntry1);
    expect(result[0].summary).toBe('My Trip');
  });

  test('finds referring entries for a multiple relation field', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tags',
      label: 'Tags',
      collection: 'tags',
      value_field: '{{slug}}',
      multiple: true,
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: {
          collection: { name: 'posts' },
          typedKeyPath: 'tags',
        },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'posts') return [postEntryMultiple, postEntry2];

      return [];
    });

    getEntrySummary.mockReturnValue('Travel & Food');

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(postEntryMultiple);
  });

  test('finds referring entries using a custom value_field', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: 'title',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: {
          collection: { name: 'posts' },
          typedKeyPath: 'tag',
        },
      },
    ]);

    /** @type {Entry} */
    const postWithTitle = {
      id: 'post-t1',
      slug: 'trip',
      subPath: 'trip',
      locales: {
        _default: {
          slug: 'trip',
          path: 'content/posts/trip.md',
          content: { title: 'Trip', tag: 'Travel' },
        },
      },
    };

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'posts') return [postWithTitle];

      return [];
    });

    getEntrySummary.mockReturnValue('Trip');

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(postWithTitle);
  });

  test('excludes self-references within the same collection', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'related',
      label: 'Related Tags',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: {
          collection: { name: 'tags' },
          typedKeyPath: 'related',
        },
      },
    ]);

    /** @type {Entry} */
    const otherTag = {
      id: 'tag-2',
      slug: 'adventure',
      subPath: 'adventure',
      locales: {
        _default: {
          slug: 'adventure',
          path: 'content/tags/adventure.md',
          content: { title: 'Adventure', related: 'travel' },
        },
      },
    };

    getCollection.mockReturnValue(tagsCollection);

    getEntriesByCollection.mockReturnValue([targetEntry, otherTag]);

    getEntrySummary.mockReturnValue('Adventure');

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    // Should find the other tag, but not the target entry itself
    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(otherTag);
  });

  test('returns referring entries from different collections', () => {
    const tagsRelation = {
      widget: 'relation',
      name: 'tags',
      label: 'Tags',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    const categoryRelation = {
      widget: 'relation',
      name: 'category',
      label: 'Category',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    const pagesCollection = {
      name: 'pages',
      label: 'Pages',
      _type: 'entry',
      _i18n: { defaultLocale: '_default' },
    };

    /** @type {Entry} */
    const pageEntry = {
      id: 'page-1',
      slug: 'about',
      subPath: 'about',
      locales: {
        _default: {
          slug: 'about',
          path: 'content/pages/about.md',
          content: { title: 'About', category: 'travel' },
        },
      },
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: tagsRelation,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tags' },
      },
      {
        fieldConfig: categoryRelation,
        context: { collection: { name: 'pages' }, typedKeyPath: 'category' },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;
      if (name === 'pages') return pagesCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'posts') return [postEntry1];
      if (name === 'pages') return [pageEntry];

      return [];
    });

    getEntrySummary.mockImplementation((_col, entry) =>
      entry === postEntry1 ? 'My Trip' : 'About',
    );

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(2);
    expect(result.map((b) => b.collectionName).sort()).toEqual(['pages', 'posts']);
  });

  test('handles entries with no content gracefully', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tags',
      label: 'Tags',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tags' },
      },
    ]);

    /** @type {Entry} */
    const emptyEntry = {
      id: 'post-empty',
      slug: 'empty',
      subPath: 'empty',
      locales: {
        _default: {
          slug: 'empty',
          path: 'content/posts/empty.md',
          content: {},
        },
      },
    };

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockReturnValue([emptyEntry]);

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(0);
  });

  test('handles context with missing collection name', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tags',
      label: 'Tags',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: undefined, typedKeyPath: 'tags' },
      },
    ]);

    getCollection.mockReturnValue(tagsCollection);

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(0);
  });

  test('respects fileName filter for file collections', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'settings',
      file: 'general',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'settings') return { ...tagsCollection, name: 'settings' };
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    // When filtering by fileName='other', the relation with file='general' shouldn't match
    const result = getReferringEntries({
      collectionName: 'settings',
      fileName: 'other',
      entry: targetEntry,
    });

    expect(result).toHaveLength(0);
  });

  test('returns empty when source collection is not found', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tags',
      label: 'Tags',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tags' },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;

      // posts collection not found
      return undefined;
    });

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(0);
  });

  test('returns empty when target values resolve to empty set', () => {
    // Use a custom value_field that doesn't match anything in the target entry
    const relationFieldConfig = {
      widget: 'relation',
      name: 'author',
      label: 'Author',
      collection: 'tags',
      value_field: 'nonexistent_field',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'author' },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockReturnValue([]);

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(0);
  });

  test('finds referring entries through typed key paths with wildcard patterns', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: {
          collection: { name: 'posts' },
          // typedKeyPath after stripping type annotations and wildcards resolves to 'blocks.tag'
          typedKeyPath: 'blocks.*<item>.tag',
        },
      },
    ]);

    /** @type {Entry} */
    const postWithBlocks = {
      id: 'post-blocks',
      slug: 'blocky',
      subPath: 'blocky',
      locales: {
        _default: {
          slug: 'blocky',
          path: 'content/posts/blocky.md',
          content: {
            title: 'Blocky',
            // After wildcard stripping, effectiveKeyPath becomes 'blocks.tag'
            'blocks.tag': 'travel',
          },
        },
      },
    };

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockReturnValue([postWithBlocks]);
    getEntrySummary.mockReturnValue('Blocky');

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(postWithBlocks);
  });

  test('handles template-based value_field with slug matching', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: '{{slug}}-{{title}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'tags') return [targetEntry];

      if (name === 'posts') {
        return [
          {
            id: 'post-tpl',
            slug: 'tpl-post',
            subPath: 'tpl-post',
            locales: {
              _default: {
                slug: 'tpl-post',
                path: 'content/posts/tpl-post.md',
                content: { title: 'Tpl Post', tag: 'travel-Travel' },
              },
            },
          },
        ];
      }

      return [];
    });

    // getOptions should return options whose values contain the target slug
    getOptions.mockReturnValue([{ label: 'Travel', value: 'travel-Travel' }]);
    getEntrySummary.mockReturnValue('Tpl Post');

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry.slug).toBe('tpl-post');
  });

  test('handles template value_field fallback when no options match slug', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: '{{category}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    /** @type {Entry} */
    const targetWithCategory = {
      id: 'tag-cat',
      slug: 'travel',
      subPath: 'travel',
      locales: {
        _default: {
          slug: 'travel',
          path: 'content/tags/travel.md',
          content: { title: 'Travel', category: 'adventures' },
        },
      },
    };

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'tags') return [targetWithCategory];

      if (name === 'posts') {
        return [
          {
            id: 'post-cat',
            slug: 'cat-post',
            subPath: 'cat-post',
            locales: {
              _default: {
                slug: 'cat-post',
                path: 'content/posts/cat-post.md',
                content: { title: 'Cat Post', tag: 'adventures' },
              },
            },
          },
        ];
      }

      return [];
    });

    // No option values contain the target slug 'travel', so fallback applies
    getOptions.mockReturnValue([{ label: 'Adventures', value: 'adventures' }]);
    getEntrySummary.mockReturnValue('Cat Post');

    const result = getReferringEntries({
      collectionName: 'tags',
      entry: targetWithCategory,
    });

    expect(result).toHaveLength(1);
    expect(result[0].entry.slug).toBe('cat-post');
  });

  test('handles file collection with allEntries filtering', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'settings',
      file: 'general',
      value_field: '{{slug}}',
    };

    const settingsCollection = {
      name: 'settings',
      label: 'Settings',
      _type: 'file',
      _i18n: { defaultLocale: '_default' },
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    /** @type {Entry} */
    const settingsEntry = {
      id: 'settings-general',
      slug: 'general',
      subPath: '',
      locales: {
        _default: {
          slug: 'general',
          path: 'content/settings/general.yml',
          content: { title: 'General', slug: 'general' },
        },
      },
    };

    // Mock get(allEntries) to return entries including the settings entry
    get.mockReturnValue([settingsEntry]);

    getCollection.mockImplementation((name) => {
      if (name === 'settings') return settingsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockReturnValue([postEntry1]);
    getEntrySummary.mockReturnValue('My Trip');

    const result = getReferringEntries({
      collectionName: 'settings',
      entry: settingsEntry,
    });

    // postEntry1 has tags: 'travel', not 'general', so no match
    expect(result).toHaveLength(0);
  });

  test('uses fallback locale content when primary locale missing', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: 'title',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    // Target entry that has content only in 'en' locale, not in '_default'
    /** @type {Entry} */
    const targetFallback = {
      id: 'tag-fb',
      slug: 'travel',
      subPath: 'travel',
      locales: {
        en: {
          slug: 'travel',
          path: 'content/tags/en/travel.md',
          content: { title: 'Travel', slug: 'travel' },
        },
      },
    };

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'tags') return [targetFallback];

      if (name === 'posts') {
        return [
          {
            id: 'post-fb',
            slug: 'fb-post',
            subPath: 'fb-post',
            locales: {
              _default: {
                slug: 'fb-post',
                path: 'content/posts/fb-post.md',
                content: { title: 'FB Post', tag: 'Travel' },
              },
            },
          },
        ];
      }

      return [];
    });

    getEntrySummary.mockReturnValue('FB Post');

    const result = getReferringEntries({ collectionName: 'tags', entry: targetFallback });

    expect(result).toHaveLength(1);
    expect(result[0].entry.slug).toBe('fb-post');
  });

  test('returns empty when referenced collection is not found in getTargetValues', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    // First call returns the target collection, second call (inside getTargetValues) returns
    // undefined so that the internal getCollection(refCollectionName) fails.
    getCollection.mockReturnValueOnce(tagsCollection).mockReturnValueOnce(undefined);

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    // getTargetValues returns empty set → targetValues.size === 0 → no results
    expect(result).toHaveLength(0);
  });

  test('handles template value_field fallback with missing target content key', () => {
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: '{{missing_key}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'tags') return [targetEntry];
      if (name === 'posts') return [postEntry1];

      return [];
    });

    // No options match the target slug, and targetContent['missing_key'] is undefined
    getOptions.mockReturnValue([{ label: 'Other', value: 'other' }]);

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    // targetValues is empty → no referring entries
    expect(result).toHaveLength(0);
  });

  test('filters out relation fields targeting a different collection (line 152)', () => {
    // Mix of a valid 'tags' relation and one targeting 'categories' — the latter is filtered away
    const tagsRelation = {
      widget: 'relation',
      name: 'tags',
      label: 'Tags',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    const categoriesRelation = {
      widget: 'relation',
      name: 'category',
      label: 'Category',
      collection: 'categories', // does not match collectionName='tags'
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: tagsRelation,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tags' },
      },
      {
        fieldConfig: categoriesRelation,
        context: { collection: { name: 'posts' }, typedKeyPath: 'category' },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockReturnValue([postEntry1]);
    getEntrySummary.mockReturnValue('My Trip');

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    // Only the tags relation matches; the categories one is filtered (return false on line 152)
    expect(result).toHaveLength(1);
    expect(result[0].collectionName).toBe('posts');
  });

  test('finds referring entries through wildcard effectiveKeyPath (lines 120-124)', () => {
    // typedKeyPath 'blocks.0.*tag' — the * is not followed by '.' and not at the end, so
    // baseKeyPath retains '*' and effectiveKeyPath triggers hasReference's wildcard branch. After
    // processing: keyPath='blocks.0.*tag', baseKeyPath='blocks.0.*tag',
    // effectiveKeyPath='blocks.0.*tag' Pattern: /^blocks\.0\.\d+tag$/ matching keys like
    // 'blocks.0.0tag'
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: {
          collection: { name: 'posts' },
          typedKeyPath: 'blocks.0.*tag',
        },
      },
    ]);

    /** @type {Entry} */
    const postWithWildcardKey = {
      id: 'post-wc',
      slug: 'wc-post',
      subPath: 'wc-post',
      locales: {
        _default: {
          slug: 'wc-post',
          path: 'content/posts/wc-post.md',
          content: { 'blocks.0.0tag': 'travel' },
        },
      },
    };

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockReturnValue([postWithWildcardKey]);
    getEntrySummary.mockReturnValue('WC Post');

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(postWithWildcardKey);
  });

  test('falls back to empty object when target entry has no locale content (line 78)', () => {
    // Entry with no `content` in any locale — forces the `?? {}` fallback at line 78
    /** @type {Entry} */
    const entryNoContent = {
      id: 'tag-empty',
      slug: 'no-content',
      subPath: 'no-content',
      locales: {
        _default: {
          slug: 'no-content',
          path: 'content/tags/no-content.md',
          // content intentionally omitted
        },
      },
    };

    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: 'title', // non-slug, so getTargetValues reads targetContent
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockReturnValue([]);
    getOptions.mockReturnValue([]);

    // targetContent falls back to {} → value is undefined → targetValues is empty → no results
    const result = getReferringEntries({ collectionName: 'tags', entry: entryNoContent });

    expect(result).toHaveLength(0);
  });

  test('uses fieldName as effectiveKeyPath when typedKeyPath is undefined (lines 199, 208)', () => {
    // context.typedKeyPath is undefined → falls back to '' (line 199), then
    // baseKeyPath becomes '' → effectiveKeyPath falls back to fieldName (line 208)
    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' } }, // typedKeyPath is undefined
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return postsCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'posts') return [postEntry1];

      return [];
    });

    getEntrySummary.mockReturnValue('My Trip');

    // effectiveKeyPath becomes 'tag' (fieldName), matching postEntry1.content.tag = 'travel'
    // But postEntry1 has { tags: 'travel' } not { tag: 'travel' }, so no match
    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    // Content key 'tag' not in postEntry1 content, so no referring entries
    expect(result).toHaveLength(0);
  });

  test('falls back to first locale content when sourceLocale is missing (line 218)', () => {
    // Source collection has defaultLocale 'en' but entry only has 'fr' locale
    const enFrPostsCollection = {
      name: 'posts',
      label: 'Blog Posts',
      _type: 'entry',
      identifier_field: 'title',
      _i18n: { defaultLocale: 'en' },
    };

    /** @type {Entry} */
    const frOnlyEntry = {
      id: 'post-fr',
      slug: 'voyage',
      subPath: 'voyage',
      locales: {
        fr: {
          slug: 'voyage',
          path: 'content/posts/voyage.md',
          content: { title: 'Voyage', tag: 'travel' },
        },
      },
    };

    const relationFieldConfig = {
      widget: 'relation',
      name: 'tag',
      label: 'Tag',
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: relationFieldConfig,
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return enFrPostsCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'posts') return [frOnlyEntry];

      return [];
    });

    getEntrySummary.mockReturnValue('Voyage');

    // sourceLocale is 'en' but frOnlyEntry only has 'fr', so it falls back to Object.values()[0]
    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(frOnlyEntry);
  });

  test('falls back to collection name and field name when labels are absent (lines 230, 231)', () => {
    // Source collection has no label → uses sourceCollectionName (line 230)
    // fieldConfig has no label → uses fieldName (line 231)
    const unlabelledCollection = {
      name: 'posts',
      // label: intentionally omitted
      _type: 'entry',
      identifier_field: 'title',
      _i18n: { defaultLocale: '_default' },
    };

    const unlabelledFieldConfig = {
      widget: 'relation',
      name: 'tag',
      // label: intentionally omitted
      collection: 'tags',
      value_field: '{{slug}}',
    };

    collectors.relationFields = new Set([
      {
        fieldConfig: unlabelledFieldConfig,
        // typedKeyPath 'tags' matches postEntry1.content.tags = 'travel'
        context: { collection: { name: 'posts' }, typedKeyPath: 'tags' },
      },
    ]);

    getCollection.mockImplementation((name) => {
      if (name === 'tags') return tagsCollection;
      if (name === 'posts') return unlabelledCollection;

      return undefined;
    });

    getEntriesByCollection.mockImplementation((name) => {
      if (name === 'posts') return [postEntry1];

      return [];
    });

    getEntrySummary.mockReturnValue('My Trip');

    const result = getReferringEntries({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    // Falls back to collectionName since label is undefined
    expect(result[0].collectionLabel).toBe('posts');
    // Falls back to fieldName since label is undefined
    expect(result[0].fieldLabel).toBe('tag');
  });
});
