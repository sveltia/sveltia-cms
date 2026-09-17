// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * @import { Entry } from '$lib/types/private';
 */

const i18n = {
  i18nEnabled: false,
  allLocales: ['_default'],
  initialLocales: ['_default'],
  defaultLocale: '_default',
  canonicalSlug: { key: 'translationKey' },
};

const tagsCollection = {
  name: 'tags',
  label: 'Tags',
  _type: 'entry',
  folder: 'content/tags',
  fields: [{ name: 'title', widget: 'string' }],
  _i18n: i18n,
  _file: { format: 'yaml-frontmatter', extension: 'md' },
};

/**
 * Relation fields carrying the rules that removing a reference can trip: a required single-value
 * field, an optional one, a multi-value field with a minimum item count, and a required field
 * nested in a list.
 */
const relationFields = [
  { name: 'category', label: 'Category', widget: 'relation', collection: 'tags' },
  { name: 'topic', label: 'Topic', widget: 'relation', collection: 'tags', required: false },
  {
    name: 'tags',
    label: 'Tags',
    widget: 'relation',
    collection: 'tags',
    multiple: true,
    required: false,
    min: 2,
  },
];

const sectionTagField = {
  name: 'tag',
  label: 'Section Tag',
  widget: 'relation',
  collection: 'tags',
};

const postsCollection = {
  name: 'posts',
  label: 'Posts',
  _type: 'entry',
  folder: 'content/posts',
  fields: [
    { name: 'title', widget: 'string' },
    ...relationFields,
    {
      name: 'sections',
      widget: 'list',
      required: false,
      fields: [{ name: 'heading', widget: 'string' }, sectionTagField],
    },
  ],
  _i18n: i18n,
  _file: { format: 'yaml-frontmatter', extension: 'md' },
};

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key), locale: { current: 'en' } }));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: {} },
  collectors: { relationFields: new Set() },
}));

vi.mock('$lib/services/contents/collection', async (importOriginal) => ({
  ...(await importOriginal()),
  getCollection: vi.fn((name) => ({ tags: tagsCollection, posts: postsCollection })[name]),
}));

vi.mock('$lib/services/contents/collection/entries', async (importOriginal) => ({
  ...(await importOriginal()),
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/backends', () => ({
  backend: { current: undefined },
}));

vi.mock('$lib/services/workflow', () => ({
  getPublishedVersion: vi.fn(() => undefined),
}));

const { collectors } = await import('$lib/services/config');
const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');
const { fieldConfigCacheMap } = await import('$lib/services/contents/entry/fields');
const { planCascadeDelete } = await import('$lib/services/contents/entry/relations/cascade/delete');

/**
 * Build an entry.
 * @param {object} collection Collection.
 * @param {string} collection.folder Collection folder.
 * @param {string} slug Entry slug.
 * @param {Record<string, any>} content Flattened content.
 * @returns {Entry} Entry.
 */
const createEntry = ({ folder }, slug, content) => ({
  id: `${folder}/${slug}`,
  slug,
  subPath: slug,
  locales: { _default: { slug, path: `${folder}/${slug}.md`, content } },
});

/**
 * Build a post entry.
 * @param {string} slug Entry slug.
 * @param {Record<string, any>} content Flattened content.
 * @returns {Entry} Entry.
 */
const createPost = (slug, content) => createEntry(postsCollection, slug, content);
const travelTag = createEntry(tagsCollection, 'travel', { title: 'Travel' });
const foodTag = createEntry(tagsCollection, 'food', { title: 'Food' });
const techTag = createEntry(tagsCollection, 'tech', { title: 'Tech' });

/**
 * Load the given posts, along with the tags.
 * @param {Entry[]} posts Posts.
 */
const setPosts = (posts) => {
  getEntriesByCollection.mockImplementation(
    (name) => ({ tags: [travelTag, foodTag, techTag], posts })[name] ?? [],
  );
};

/**
 * The real relation helpers and field validator are used here, so that the validation rules a
 * Relation field can carry are checked the way a save of the referencing entry would check them.
 */
describe('planCascadeDelete() (integration)', () => {
  beforeEach(() => {
    fieldConfigCacheMap.clear();
    // What the configuration parser records for the fields above
    collectors.relationFields = new Set([
      ...relationFields.map((fieldConfig) => ({
        fieldConfig,
        context: { collection: postsCollection, typedKeyPath: fieldConfig.name },
      })),
      {
        fieldConfig: sectionTagField,
        context: { collection: postsCollection, typedKeyPath: 'sections.*.tag' },
      },
    ]);
  });

  test('removes references that leave the fields valid', () => {
    setPosts([
      createPost('my-trip', {
        title: 'My Trip',
        category: 'food',
        topic: 'travel',
        'tags.0': 'travel',
        'tags.1': 'food',
        'tags.2': 'tech',
        'sections.0.heading': 'Intro',
        'sections.0.tag': 'food',
      }),
    ]);

    const { targets, blockers } = planCascadeDelete({
      collection: tagsCollection,
      entries: [travelTag],
    });

    expect(blockers).toEqual([]);
    expect(targets).toHaveLength(1);
    expect(targets[0].collection).toBe(postsCollection);
    expect(targets[0].entry.locales._default.content).toEqual({
      title: 'My Trip',
      category: 'food',
      topic: '',
      'tags.0': 'food',
      'tags.1': 'tech',
      'sections.0.heading': 'Intro',
      'sections.0.tag': 'food',
    });
  });

  test('blocks the deletion when a required field would be left empty', () => {
    const post = createPost('my-trip', { title: 'My Trip', category: 'travel' });

    setPosts([post]);

    const { blockers } = planCascadeDelete({ collection: tagsCollection, entries: [travelTag] });

    expect(blockers).toEqual([
      {
        collectionName: 'posts',
        collectionLabel: 'Posts',
        fieldLabel: 'Category',
        entry: post,
        summary: 'My Trip',
        locale: '_default',
        keyPath: 'category',
        messages: ['validation.value_missing'],
      },
    ]);
  });

  test('blocks the deletion when a multi-value field would fall short of its minimum', () => {
    setPosts([
      createPost('my-trip', {
        title: 'My Trip',
        category: 'food',
        'tags.0': 'travel',
        'tags.1': 'food',
      }),
    ]);

    const { blockers } = planCascadeDelete({ collection: tagsCollection, entries: [travelTag] });

    expect(blockers).toEqual([
      expect.objectContaining({
        fieldLabel: 'Tags',
        keyPath: 'tags',
        messages: ['validation.range_underflow.add'],
      }),
    ]);
  });

  test('lets an optional multi-value field be emptied', () => {
    // The `min` option only applies to a field that has items: an optional field left empty is
    // not held to it
    setPosts([
      createPost('my-trip', {
        title: 'My Trip',
        category: 'tech',
        'tags.0': 'travel',
        'tags.1': 'food',
      }),
    ]);

    const { targets, blockers } = planCascadeDelete({
      collection: tagsCollection,
      entries: [travelTag, foodTag],
    });

    expect(blockers).toEqual([]);
    expect(targets[0].entry.locales._default.content).toEqual({
      title: 'My Trip',
      category: 'tech',
      tags: [],
    });
  });

  test('blocks the deletion when a required field nested in a list would be left empty', () => {
    setPosts([
      createPost('my-trip', {
        title: 'My Trip',
        category: 'food',
        'sections.0.heading': 'Intro',
        'sections.0.tag': 'food',
        'sections.1.heading': 'Outro',
        'sections.1.tag': 'travel',
      }),
    ]);

    const { blockers } = planCascadeDelete({ collection: tagsCollection, entries: [travelTag] });

    expect(blockers).toEqual([
      expect.objectContaining({ fieldLabel: 'Section Tag', keyPath: 'sections.1.tag' }),
    ]);
  });

  test('reports every entry that stands in the way', () => {
    setPosts([
      createPost('a', { title: 'A', category: 'travel' }),
      createPost('b', { title: 'B', category: 'food' }),
      createPost('c', { title: 'C', category: 'travel' }),
    ]);

    const { targets, blockers } = planCascadeDelete({
      collection: tagsCollection,
      entries: [travelTag],
    });

    expect(targets.map(({ entry }) => entry.slug)).toEqual(['a', 'c']);
    expect(blockers.map(({ summary }) => summary)).toEqual(['A', 'C']);
  });
});
