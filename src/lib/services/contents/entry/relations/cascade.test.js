// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  buildCascadeChanges,
  createRenamedEntry,
  getReplacementMap,
  replaceReferences,
} from '$lib/services/contents/entry/relations/cascade';

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

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/entry/changes', () => ({
  buildEntryUpdateChanges: vi.fn(async ({ entry }) => [
    { action: 'update', slug: entry.slug, path: `content/posts/${entry.slug}.md`, data: '' },
  ]),
  createSyntheticDraft: vi.fn((args) => ({ synthetic: true, ...args })),
  resolveCacheDB: vi.fn(() => undefined),
}));

vi.mock('$lib/services/contents/fields/relation/helpers', () => ({
  getEntryOptions: vi.fn(() => []),
}));

const { collectors } = await import('$lib/services/config');
const { getCollection } = await import('$lib/services/contents/collection');
const { getCollectionFile } = await import('$lib/services/contents/collection/files');
const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

const { isCollectionIndexFile } =
  await import('$lib/services/contents/collection/entries/index-file');

const { buildEntryUpdateChanges, createSyntheticDraft, resolveCacheDB } =
  await import('$lib/services/contents/entry/changes');

const { getEntryOptions } = await import('$lib/services/contents/fields/relation/helpers');

const tagsCollection = {
  name: 'tags',
  label: 'Tags',
  _type: 'entry',
  _i18n: {
    defaultLocale: '_default',
    allLocales: ['_default'],
    canonicalSlug: { key: 'translationKey' },
  },
};

const postsCollection = {
  name: 'posts',
  label: 'Blog Posts',
  _type: 'entry',
  _i18n: {
    defaultLocale: '_default',
    allLocales: ['_default'],
    canonicalSlug: { key: 'translationKey' },
  },
};

/** @type {Entry} */
const originalEntry = {
  id: 'tag-1',
  slug: 'travel',
  subPath: 'travel',
  locales: {
    _default: { slug: 'travel', path: 'content/tags/travel.md', content: { title: 'Travel' } },
  },
};

/** @type {Entry} */
const savingEntry = {
  id: 'tag-1',
  slug: 'travelling',
  subPath: 'travelling',
  locales: {
    _default: {
      slug: 'travelling',
      path: 'content/tags/travelling.md',
      content: { title: 'Travel' },
    },
  },
};

/**
 * Create a blog post entry.
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
      fieldConfig: { widget: 'relation', name: 'tag', collection: 'tags', ...fieldConfig },
      context: { collection: { name: 'posts' }, typedKeyPath: 'tag', ...context },
    },
  ]);
};

beforeEach(() => {
  vi.clearAllMocks();
  collectors.relationFields = new Set();
  getCollection.mockReturnValue(postsCollection);
  isCollectionIndexFile.mockReturnValue(false);
  // The stored value is the entry slug, so it follows the rename
  getEntryOptions.mockImplementation(({ refEntry }) => [
    { label: refEntry.slug, value: refEntry.slug },
  ]);
});

describe('createRenamedEntry()', () => {
  test('applies the new slug while keeping the original content', () => {
    expect(createRenamedEntry({ originalEntry, savingEntry })).toEqual({
      ...originalEntry,
      slug: 'travelling',
      locales: {
        _default: {
          slug: 'travelling',
          path: 'content/tags/travel.md',
          content: { title: 'Travel' },
        },
      },
    });
  });

  test('applies the new canonical slug', () => {
    const original = {
      ...originalEntry,
      locales: {
        en: { slug: 'travel', path: 'en/travel.md', content: { translationKey: 'travel' } },
        fr: { slug: 'voyage', path: 'fr/voyage.md', content: { translationKey: 'travel' } },
      },
    };

    const saving = {
      ...savingEntry,
      locales: {
        en: {
          slug: 'travelling',
          path: 'en/travelling.md',
          content: { translationKey: 'travelling' },
        },
        fr: { slug: 'voyage', path: 'fr/voyage.md', content: { translationKey: 'travelling' } },
      },
    };

    const renamed = createRenamedEntry({
      originalEntry: original,
      savingEntry: saving,
      canonicalSlugKey: 'translationKey',
    });

    expect(renamed.locales.en.content.translationKey).toBe('travelling');
    expect(renamed.locales.fr.content.translationKey).toBe('travelling');
    expect(renamed.locales.fr.slug).toBe('voyage');
  });

  test('keeps a locale that is not part of the saved entry', () => {
    const original = {
      ...originalEntry,
      locales: {
        ...originalEntry.locales,
        fr: { slug: 'voyage', path: 'fr/voyage.md', content: { title: 'Voyage' } },
      },
    };

    const renamed = createRenamedEntry({
      originalEntry: original,
      savingEntry,
      canonicalSlugKey: 'translationKey',
    });

    expect(renamed.locales.fr).toEqual(original.locales.fr);
  });

  test('leaves a locale without content alone', () => {
    const original = {
      ...originalEntry,
      locales: { _default: { slug: 'travel', path: 'content/tags/travel.md' } },
    };

    const saving = {
      ...savingEntry,
      locales: {
        _default: { slug: 'travelling', path: 'x.md', content: { translationKey: 'travelling' } },
      },
    };

    const renamed = createRenamedEntry({
      originalEntry: original,
      savingEntry: saving,
      canonicalSlugKey: 'translationKey',
    });

    expect(renamed.locales._default.content).toBeUndefined();
  });
});

describe('getReplacementMap()', () => {
  const fieldConfig = { widget: 'relation', name: 'tag', collection: 'tags' };

  test('maps the old value to the new one', () => {
    const map = getReplacementMap({
      fieldConfig,
      originalEntry,
      renamedEntry: createRenamedEntry({ originalEntry, savingEntry }),
      locale: '_default',
    });

    expect([...map]).toEqual([['travel', 'travelling']]);
  });

  test('is empty when the stored value does not depend on the slug', () => {
    getEntryOptions.mockReturnValue([{ label: 'Travel', value: 'Travel' }]);

    const map = getReplacementMap({
      fieldConfig,
      originalEntry,
      renamedEntry: createRenamedEntry({ originalEntry, savingEntry }),
      locale: '_default',
    });

    expect(map.size).toBe(0);
  });

  test('is empty when the value lists cannot be paired', () => {
    getEntryOptions.mockImplementation(({ refEntry }) =>
      refEntry.slug === 'travel'
        ? [{ label: 'a', value: 'a' }]
        : [
            { label: 'b', value: 'b' },
            { label: 'c', value: 'c' },
          ],
    );

    const map = getReplacementMap({
      fieldConfig,
      originalEntry,
      renamedEntry: createRenamedEntry({ originalEntry, savingEntry }),
      locale: '_default',
    });

    expect(map.size).toBe(0);
  });
});

describe('replaceReferences()', () => {
  const relation = { keyPath: 'tag', valuePattern: undefined, multiple: false };

  test('returns updated content when a reference is outdated', () => {
    expect(
      replaceReferences({
        content: { title: 'Trip', tag: 'travel' },
        relation,
        replacements: new Map([['travel', 'travelling']]),
      }),
    ).toEqual({ title: 'Trip', tag: 'travelling' });
  });

  test('returns undefined when nothing references the renamed entry', () => {
    expect(
      replaceReferences({
        content: { title: 'Trip', tag: 'food' },
        relation,
        replacements: new Map([['travel', 'travelling']]),
      }),
    ).toBeUndefined();
  });

  test('does not modify the original content', () => {
    const content = { tag: 'travel' };

    replaceReferences({ content, relation, replacements: new Map([['travel', 'travelling']]) });
    expect(content.tag).toBe('travel');
  });
});

describe('buildCascadeChanges()', () => {
  const baseArgs = { collection: tagsCollection, originalEntry, savingEntry };

  test('does nothing for a new entry', async () => {
    registerTagRelation();

    expect(await buildCascadeChanges({ ...baseArgs, originalEntry: undefined })).toEqual({
      changes: [],
      savingEntries: [],
    });
  });

  test('does nothing when the slug is unchanged', async () => {
    registerTagRelation();

    expect(await buildCascadeChanges({ ...baseArgs, savingEntry: originalEntry })).toEqual({
      changes: [],
      savingEntries: [],
    });
  });

  test('does nothing when no Relation field targets the collection', async () => {
    expect(await buildCascadeChanges(baseArgs)).toEqual({ changes: [], savingEntries: [] });
    expect(getEntriesByCollection).not.toHaveBeenCalled();
  });

  test('does nothing when no entry references the renamed entry', async () => {
    registerTagRelation();
    getEntriesByCollection.mockReturnValue([createPost('a', { tag: 'food' })]);

    expect(await buildCascadeChanges(baseArgs)).toEqual({ changes: [], savingEntries: [] });
    expect(buildEntryUpdateChanges).not.toHaveBeenCalled();
  });

  test('leaves references alone when the stored value does not depend on the slug', async () => {
    registerTagRelation({ fieldConfig: { value_field: 'title' } });
    getEntryOptions.mockReturnValue([{ label: 'Travel', value: 'Travel' }]);
    getEntriesByCollection.mockReturnValue([createPost('a', { tag: 'Travel' })]);

    expect(await buildCascadeChanges(baseArgs)).toEqual({ changes: [], savingEntries: [] });
  });

  test('rewrites the outdated references', async () => {
    registerTagRelation();
    getEntriesByCollection.mockReturnValue([
      createPost('my-trip', { title: 'My Trip', tag: 'travel' }),
      createPost('food-review', { title: 'Food Review', tag: 'food' }),
    ]);

    const { changes, savingEntries } = await buildCascadeChanges(baseArgs);

    expect(savingEntries).toHaveLength(1);
    expect(savingEntries[0].locales._default.content).toEqual({
      title: 'My Trip',
      tag: 'travelling',
    });
    expect(changes).toEqual([
      { action: 'update', slug: 'my-trip', path: 'content/posts/my-trip.md', data: '' },
    ]);
  });

  test('rewrites one item of a multi-value field', async () => {
    registerTagRelation({
      fieldConfig: { name: 'tags', multiple: true },
      context: { typedKeyPath: 'tags' },
    });
    getEntriesByCollection.mockReturnValue([
      createPost('a', { 'tags.0': 'food', 'tags.1': 'travel' }),
    ]);

    const { savingEntries } = await buildCascadeChanges(baseArgs);

    expect(savingEntries[0].locales._default.content).toEqual({
      'tags.0': 'food',
      'tags.1': 'travelling',
    });
  });

  test('rewrites a multi-value field nested in a list', async () => {
    registerTagRelation({
      fieldConfig: { name: 'tags', multiple: true },
      context: { typedKeyPath: 'blocks.*<promo>.tags' },
    });
    getEntriesByCollection.mockReturnValue([
      createPost('a', {
        'blocks.0.tags.0': 'travel',
        'blocks.0.tags.1': 'food',
        'blocks.1.title': 'No tags here',
        'blocks.2.tags.0': 'travel',
      }),
    ]);

    const { savingEntries } = await buildCascadeChanges(baseArgs);

    expect(savingEntries[0].locales._default.content).toEqual({
      'blocks.0.tags.0': 'travelling',
      'blocks.0.tags.1': 'food',
      'blocks.1.title': 'No tags here',
      'blocks.2.tags.0': 'travelling',
    });
  });

  test('rewrites every occurrence in a multi-value field', async () => {
    registerTagRelation({
      fieldConfig: { name: 'tags', multiple: true },
      context: { typedKeyPath: 'tags' },
    });
    getEntriesByCollection.mockReturnValue([
      createPost('a', { 'tags.0': 'travel', 'tags.1': 'food', 'tags.2': 'travel' }),
    ]);

    const { savingEntries } = await buildCascadeChanges(baseArgs);

    expect(savingEntries[0].locales._default.content).toEqual({
      'tags.0': 'travelling',
      'tags.1': 'food',
      'tags.2': 'travelling',
    });
  });

  test('rewrites references nested in a list', async () => {
    registerTagRelation({ context: { typedKeyPath: 'blocks.*<item>.tag' } });
    getEntriesByCollection.mockReturnValue([
      createPost('a', { 'blocks.0.tag': 'food', 'blocks.1.tag': 'travel' }),
    ]);

    const { savingEntries } = await buildCascadeChanges(baseArgs);

    expect(savingEntries[0].locales._default.content).toEqual({
      'blocks.0.tag': 'food',
      'blocks.1.tag': 'travelling',
    });
  });

  test('rewrites every locale of a referencing entry', async () => {
    registerTagRelation();
    getEntriesByCollection.mockReturnValue([
      {
        id: 'a',
        slug: 'a',
        subPath: 'a',
        locales: {
          en: { slug: 'a', path: 'en/a.md', content: { tag: 'travel' } },
          fr: { slug: 'a', path: 'fr/a.md', content: { tag: 'travel' } },
          de: { slug: 'a', path: 'de/a.md', content: { tag: 'food' } },
          es: { slug: 'a', path: 'es/a.md' },
        },
      },
    ]);

    const { savingEntries } = await buildCascadeChanges(baseArgs);

    expect(savingEntries[0].locales.en.content.tag).toBe('travelling');
    expect(savingEntries[0].locales.fr.content.tag).toBe('travelling');
    expect(savingEntries[0].locales.de.content.tag).toBe('food');
    expect(savingEntries[0].locales.es.content).toBeUndefined();
  });

  test('skips a locale whose values happen not to change', async () => {
    registerTagRelation({ fieldConfig: { value_field: '{{locale}}/{{slug}}' } });

    // `zz` is not in `allLocales`, so its map is resolved lazily — and it resolves to the same
    // value before and after the rename, leaving that locale’s file untouched
    getEntryOptions.mockImplementation(({ refEntry, locale }) =>
      locale === 'zz'
        ? [{ label: 'pinned', value: 'pinned' }]
        : [{ label: refEntry.slug, value: `${locale}/${refEntry.slug}` }],
    );

    getEntriesByCollection.mockReturnValue([
      {
        id: 'a',
        slug: 'a',
        subPath: 'a',
        locales: {
          _default: { slug: 'a', path: 'a.md', content: { tag: '_default/travel' } },
          zz: { slug: 'a', path: 'zz/a.md', content: { tag: 'pinned' } },
        },
      },
    ]);

    const { savingEntries } = await buildCascadeChanges(baseArgs);

    expect(savingEntries[0].locales._default.content.tag).toBe('_default/travelling');
    expect(savingEntries[0].locales.zz.content.tag).toBe('pinned');
  });

  test('writes an entry referenced through two fields only once', async () => {
    getCollection.mockReturnValue(postsCollection);

    collectors.relationFields = new Set([
      {
        fieldConfig: { widget: 'relation', name: 'tag', collection: 'tags' },
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
      {
        fieldConfig: { widget: 'relation', name: 'topic', collection: 'tags' },
        context: { collection: { name: 'posts' }, typedKeyPath: 'topic' },
      },
    ]);

    getEntriesByCollection.mockReturnValue([createPost('a', { tag: 'travel', topic: 'travel' })]);

    const { changes, savingEntries } = await buildCascadeChanges(baseArgs);

    expect(changes).toHaveLength(1);
    expect(savingEntries[0].locales._default.content).toEqual({
      tag: 'travelling',
      topic: 'travelling',
    });
  });

  test('skips the renamed entry itself', async () => {
    registerTagRelation({ context: { collection: { name: 'tags' } } });
    getCollection.mockReturnValue(tagsCollection);
    getEntriesByCollection.mockReturnValue([
      {
        ...originalEntry,
        locales: { _default: { ...originalEntry.locales._default, content: { tag: 'travel' } } },
      },
    ]);

    expect(await buildCascadeChanges(baseArgs)).toEqual({ changes: [], savingEntries: [] });
  });

  test('only visits the field’s own file in a file collection', async () => {
    const settingsFile = { name: 'general', fields: [] };

    getCollection.mockReturnValue({
      name: 'config',
      label: 'Config',
      _type: 'file',
      _i18n: { defaultLocale: '_default', allLocales: ['_default'] },
    });
    getCollectionFile.mockReturnValue(settingsFile);
    registerTagRelation({
      context: { collection: { name: 'config' }, collectionFile: { name: 'general' } },
    });

    getEntriesByCollection.mockReturnValue([
      { ...createPost('general', { tag: 'travel' }), id: 'config-general' },
      { ...createPost('other', { tag: 'travel' }), id: 'config-other' },
    ]);

    const { savingEntries } = await buildCascadeChanges(baseArgs);

    expect(savingEntries).toHaveLength(1);
    expect(savingEntries[0].id).toBe('config-general');
    expect(buildEntryUpdateChanges).toHaveBeenCalledWith(
      expect.objectContaining({ collectionFile: settingsFile }),
    );
  });

  test('marks the index file so its fields resolve correctly', async () => {
    registerTagRelation();
    isCollectionIndexFile.mockReturnValue(true);
    getEntriesByCollection.mockReturnValue([createPost('_index', { tag: 'travel' })]);

    await buildCascadeChanges(baseArgs);

    expect(createSyntheticDraft).toHaveBeenCalledWith(
      expect.objectContaining({ isIndexFile: true }),
    );
  });

  test('reuses the caller’s file cache database', async () => {
    const cacheDB = { get: vi.fn() };

    registerTagRelation();
    getEntriesByCollection.mockReturnValue([createPost('a', { tag: 'travel' })]);
    vi.mocked(resolveCacheDB).mockReturnValue(cacheDB);

    await buildCascadeChanges({ ...baseArgs, cacheDB });

    expect(resolveCacheDB).toHaveBeenCalledWith(cacheDB);
    expect(buildEntryUpdateChanges).toHaveBeenCalledWith(expect.objectContaining({ cacheDB }));
  });
});
