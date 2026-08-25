// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getBacklinks } from '$lib/services/contents/entry/relations/backlinks';

/**
 * @import { Entry } from '$lib/types/private';
 */

vi.mock('$lib/services/config', () => ({
  collectors: { relationFields: new Set() },
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFile: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn(() => 'Summary'),
}));

vi.mock('$lib/services/contents/fields/relation/helpers', () => ({
  getEntryOptions: vi.fn(() => []),
}));

const { collectors } = await import('$lib/services/config');
const { getCollection } = await import('$lib/services/contents/collection');
const { getCollectionFile } = await import('$lib/services/contents/collection/files');
const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');
const { getEntrySummary } = await import('$lib/services/contents/entry/summary');
const { getEntryOptions } = await import('$lib/services/contents/fields/relation/helpers');

const postsCollection = {
  name: 'posts',
  label: 'Blog Posts',
  _type: 'entry',
  _i18n: { defaultLocale: '_default' },
};

/** @type {Entry} */
const targetEntry = {
  id: 'tag-1',
  slug: 'travel',
  subPath: 'travel',
  locales: {
    _default: { slug: 'travel', path: 'content/tags/travel.md', content: { title: 'Travel' } },
  },
};

/**
 * Create a blog post entry referencing tags.
 * @param {string} id Entry ID and slug.
 * @param {Record<string, any>} content Flattened content.
 * @returns {Entry} Entry.
 */
const createPost = (id, content) => ({
  id,
  slug: id,
  subPath: id,
  locales: { _default: { slug: id, path: `content/posts/${id}.md`, content } },
});

/**
 * Register a single Relation field pointing at the `tags` collection.
 * @param {object} [options] Options.
 * @param {Record<string, any>} [options.fieldConfig] Field config overrides.
 * @param {Record<string, any>} [options.context] Parser context overrides.
 */
const registerTagRelation = ({ fieldConfig = {}, context = {} } = {}) => {
  collectors.relationFields = new Set([
    {
      fieldConfig: {
        widget: 'relation',
        name: 'tag',
        label: 'Tag',
        collection: 'tags',
        ...fieldConfig,
      },
      context: { collection: { name: 'posts' }, typedKeyPath: 'tag', ...context },
    },
  ]);
};

beforeEach(() => {
  vi.clearAllMocks();
  collectors.relationFields = new Set();
  getCollection.mockReturnValue(postsCollection);
  getEntrySummary.mockReturnValue('Summary');
  getEntryOptions.mockReturnValue([{ label: 'Travel', value: 'travel' }]);
});

describe('getBacklinks()', () => {
  test('returns nothing when no Relation field targets the collection', () => {
    expect(getBacklinks({ collectionName: 'tags', entry: targetEntry })).toEqual([]);
  });

  test('returns nothing when the target entry has no relation value', () => {
    registerTagRelation();
    getEntryOptions.mockReturnValue([]);
    getEntriesByCollection.mockReturnValue([createPost('a', { tag: 'travel' })]);

    expect(getBacklinks({ collectionName: 'tags', entry: targetEntry })).toEqual([]);
    expect(getEntriesByCollection).not.toHaveBeenCalled();
  });

  test('finds entries referencing the target through a single-value field', () => {
    registerTagRelation();

    const referring = createPost('my-trip', { title: 'My Trip', tag: 'travel' });
    const other = createPost('food-review', { title: 'Food Review', tag: 'food' });

    getEntriesByCollection.mockReturnValue([referring, other]);
    getEntrySummary.mockReturnValue('My Trip');

    expect(getBacklinks({ collectionName: 'tags', entry: targetEntry })).toEqual([
      {
        collectionName: 'posts',
        collectionLabel: 'Blog Posts',
        fieldLabel: 'Tag',
        entry: referring,
        summary: 'My Trip',
      },
    ]);
  });

  test('finds entries referencing the target through a multi-value field', () => {
    registerTagRelation({
      fieldConfig: { name: 'tags', multiple: true },
      context: { typedKeyPath: 'tags' },
    });

    const referring = createPost('travel-food', { 'tags.0': 'food', 'tags.1': 'travel' });

    getEntriesByCollection.mockReturnValue([referring, createPost('other', { 'tags.0': 'food' })]);

    const result = getBacklinks({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(referring);
  });

  test('finds entries referencing the target from within a list', () => {
    registerTagRelation({ context: { typedKeyPath: 'blocks.*<item>.tag' } });

    const referring = createPost('blocky', { 'blocks.0.title': 'Hi', 'blocks.1.tag': 'travel' });

    getEntriesByCollection.mockReturnValue([referring]);

    const result = getBacklinks({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(referring);
  });

  test('finds entries referencing the target through a multi-value field in a list', () => {
    registerTagRelation({
      fieldConfig: { name: 'tags', multiple: true },
      context: { typedKeyPath: 'blocks.*<promo>.tags' },
    });

    const referring = createPost('a', { 'blocks.0.tags.0': 'food', 'blocks.1.tags.0': 'travel' });

    getEntriesByCollection.mockReturnValue([
      referring,
      createPost('b', { 'blocks.0.tags.0': 'food' }),
    ]);

    const result = getBacklinks({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(referring);
  });

  test('matches any of the values identifying the target entry', () => {
    registerTagRelation({ fieldConfig: { value_field: '{{locale}}/{{slug}}' } });
    getEntryOptions.mockReturnValue([
      { label: 'Travel', value: 'en/travel' },
      { label: 'Travel', value: 'fr/travel' },
    ]);

    const referring = createPost('a', { tag: 'fr/travel' });

    getEntriesByCollection.mockReturnValue([referring, createPost('b', { tag: 'en/food' })]);

    const result = getBacklinks({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(referring);
  });

  test('excludes the target entry itself', () => {
    registerTagRelation({ context: { collection: { name: 'tags' } } });
    getCollection.mockReturnValue({ ...postsCollection, name: 'tags', label: 'Tags' });

    const selfReferring = { ...targetEntry };

    selfReferring.locales = {
      _default: { ...targetEntry.locales._default, content: { tag: 'travel' } },
    };

    getEntriesByCollection.mockReturnValue([selfReferring]);

    expect(getBacklinks({ collectionName: 'tags', entry: targetEntry })).toEqual([]);
  });

  test('only considers the field’s own file in a file collection', () => {
    getCollection.mockReturnValue({ name: 'config', label: 'Config', _type: 'file' });
    getCollectionFile.mockReturnValue({ name: 'general', _i18n: { defaultLocale: '_default' } });
    registerTagRelation({
      context: { collection: { name: 'config' }, collectionFile: { name: 'general' } },
    });

    const general = { ...createPost('general', { tag: 'travel' }), id: 'config-general' };
    const other = { ...createPost('other', { tag: 'travel' }), id: 'config-other' };

    getEntriesByCollection.mockReturnValue([general, other]);

    const result = getBacklinks({ collectionName: 'tags', entry: targetEntry });

    expect(result).toHaveLength(1);
    expect(result[0].entry).toBe(general);
  });

  test('falls back to the first locale when the default locale has no content', () => {
    registerTagRelation();
    getCollection.mockReturnValue({ ...postsCollection, _i18n: { defaultLocale: 'en' } });

    /** @type {Entry} */
    const referring = {
      id: 'fr-only',
      slug: 'fr-only',
      subPath: 'fr-only',
      locales: {
        fr: { slug: 'fr-only', path: 'content/fr/fr-only.md', content: { tag: 'travel' } },
      },
    };

    getEntriesByCollection.mockReturnValue([referring]);

    expect(getBacklinks({ collectionName: 'tags', entry: targetEntry })).toHaveLength(1);
  });

  test('skips entries with no content at all', () => {
    registerTagRelation();
    getEntriesByCollection.mockReturnValue([
      { id: 'empty', slug: 'empty', subPath: 'empty', locales: { _default: { slug: 'empty' } } },
    ]);

    expect(getBacklinks({ collectionName: 'tags', entry: targetEntry })).toEqual([]);
  });

  test('falls back to the collection and field names when labels are absent', () => {
    getCollection.mockReturnValue({ name: 'posts', _type: 'entry', _i18n: { defaultLocale: '_' } });
    registerTagRelation({ fieldConfig: { label: undefined } });
    getEntriesByCollection.mockReturnValue([
      {
        id: 'a',
        slug: 'a',
        subPath: 'a',
        locales: { _: { slug: 'a', content: { tag: 'travel' } } },
      },
    ]);

    const [backlink] = getBacklinks({ collectionName: 'tags', entry: targetEntry });

    expect(backlink.collectionLabel).toBe('posts');
    expect(backlink.fieldLabel).toBe('tag');
  });

  test('collects backlinks from multiple Relation fields', () => {
    getCollection.mockImplementation((name) =>
      name === 'posts'
        ? postsCollection
        : { name: 'pages', label: 'Pages', _i18n: { defaultLocale: '_default' } },
    );

    collectors.relationFields = new Set([
      {
        fieldConfig: { widget: 'relation', name: 'tag', label: 'Tag', collection: 'tags' },
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
      {
        fieldConfig: { widget: 'relation', name: 'topic', label: 'Topic', collection: 'tags' },
        context: { collection: { name: 'pages' }, typedKeyPath: 'topic' },
      },
    ]);

    getEntriesByCollection.mockImplementation((name) =>
      name === 'posts'
        ? [createPost('p', { tag: 'travel' })]
        : [createPost('g', { topic: 'travel' })],
    );

    const result = getBacklinks({ collectionName: 'tags', entry: targetEntry });

    expect(result.map(({ collectionName, fieldLabel }) => [collectionName, fieldLabel])).toEqual([
      ['posts', 'Tag'],
      ['pages', 'Topic'],
    ]);
  });
});
