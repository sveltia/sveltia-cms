// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  buildCascadeDeleteChanges,
  getBlockers,
  getDeletedValues,
  getDeletedVersions,
  planCascadeDelete,
  removeReferences,
} from '$lib/services/contents/entry/relations/cascade/delete';

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

vi.mock('$lib/services/contents/draft/validate/fields', () => ({
  validateAnyField: vi.fn(() => ({ valid: true })),
}));

vi.mock('$lib/services/contents/draft/validate/messages', () => ({
  getFieldValidationMessages: vi.fn(() => ['This field is required.']),
}));

vi.mock('$lib/services/contents/entry/changes', () => ({
  buildEntryUpdateChanges: vi.fn(async ({ entry }) => [
    { action: 'update', slug: entry.slug, path: `content/posts/${entry.slug}.md`, data: '' },
  ]),
  createSyntheticDraft: vi.fn((args) => ({ synthetic: true, ...args })),
  resolveCacheDB: vi.fn(() => undefined),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn((collection, entry) => entry.locales._default?.content?.title ?? ''),
}));

vi.mock('$lib/services/contents/fields/relation/helpers', () => ({
  getEntryOptions: vi.fn(() => []),
}));

vi.mock('$lib/services/workflow', () => ({
  getPublishedVersion: vi.fn(() => undefined),
}));

const { collectors } = await import('$lib/services/config');
const { getCollection } = await import('$lib/services/contents/collection');
const { getCollectionFile } = await import('$lib/services/contents/collection/files');
const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

const { isCollectionIndexFile } =
  await import('$lib/services/contents/collection/entries/index-file');

const { validateAnyField } = await import('$lib/services/contents/draft/validate/fields');

const { getFieldValidationMessages } =
  await import('$lib/services/contents/draft/validate/messages');

const { buildEntryUpdateChanges, createSyntheticDraft } =
  await import('$lib/services/contents/entry/changes');

const { getEntryOptions } = await import('$lib/services/contents/fields/relation/helpers');
const { getPublishedVersion } = await import('$lib/services/workflow');

const tagsCollection = {
  name: 'tags',
  label: 'Tags',
  _type: 'entry',
  _i18n: { defaultLocale: '_default', allLocales: ['_default'] },
};

const postsCollection = {
  name: 'posts',
  label: 'Blog Posts',
  _type: 'entry',
  _i18n: { defaultLocale: '_default', allLocales: ['_default'] },
};

/**
 * Create a tag entry.
 * @param {string} slug Entry slug.
 * @returns {Entry} Entry.
 */
const createTag = (slug) => ({
  id: `tag-${slug}`,
  slug,
  subPath: slug,
  locales: { _default: { slug, path: `content/tags/${slug}.md`, content: { title: slug } } },
});

const travelTag = createTag('travel');
const foodTag = createTag('food');

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
  collectors.relationFields.add({
    fieldConfig: { widget: 'relation', name: 'tag', collection: 'tags', ...fieldConfig },
    context: { collection: { name: 'posts' }, typedKeyPath: 'tag', ...context },
  });
};

/** Field config of a single-value `tag` field, as resolved. */
const singleRelation = { keyPath: 'tag', valuePattern: undefined, multiple: false };
/** Field config of a multi-value `tags` field, as resolved. */
const multiRelation = { keyPath: 'tags', valuePattern: undefined, multiple: true };

beforeEach(() => {
  vi.clearAllMocks();
  collectors.relationFields = new Set();
  getCollection.mockReturnValue(postsCollection);
  isCollectionIndexFile.mockReturnValue(false);
  validateAnyField.mockReturnValue({ valid: true });
  getFieldValidationMessages.mockReturnValue(['This field is required.']);
  getPublishedVersion.mockReturnValue(undefined);
  // The stored value is the entry slug
  getEntryOptions.mockImplementation(({ refEntry }) => [
    { label: refEntry.slug, value: refEntry.slug },
  ]);
});

describe('getDeletedValues()', () => {
  test('collects the values of every deleted entry', () => {
    const fieldConfig = { widget: 'relation', name: 'tag', collection: 'tags' };

    expect(
      getDeletedValues({ fieldConfig, entries: [travelTag, foodTag], locale: '_default' }),
    ).toEqual(new Set(['travel', 'food']));
    expect(getEntryOptions).toHaveBeenCalledWith({
      fieldConfig,
      refEntry: travelTag,
      locale: '_default',
    });
  });

  test('is empty when the entries have no value in the field', () => {
    getEntryOptions.mockReturnValue([]);

    expect(getDeletedValues({ fieldConfig: {}, entries: [travelTag], locale: '_default' })).toEqual(
      new Set(),
    );
  });
});

describe('getDeletedVersions()', () => {
  test('returns the entries as they are when none has another version', () => {
    const entries = [travelTag, foodTag];

    expect(getDeletedVersions(entries)).toBe(entries);
  });

  test('appends the published version of an unpublished entry', () => {
    const renamedTag = { ...createTag('trips'), workflow: {} };

    getPublishedVersion.mockImplementation((entry) =>
      entry === renamedTag ? travelTag : undefined,
    );

    expect(getDeletedVersions([renamedTag, foodTag])).toEqual([renamedTag, foodTag, travelTag]);
  });

  test('does not list a version twice', () => {
    const renamedTag = { ...createTag('trips'), workflow: {} };
    const draftTag = { ...createTag('trips-2'), workflow: {} };

    getPublishedVersion.mockReturnValue(travelTag);

    expect(getDeletedVersions([renamedTag, draftTag, travelTag])).toEqual([
      renamedTag,
      draftTag,
      travelTag,
    ]);
    expect(getDeletedVersions([renamedTag, draftTag])).toEqual([renamedTag, draftTag, travelTag]);
  });
});

describe('removeReferences()', () => {
  const values = new Set(['travel']);

  test('returns undefined when nothing references the deleted entries', () => {
    expect(
      removeReferences({ content: { title: 'A', tag: 'food' }, relation: singleRelation, values }),
    ).toBeUndefined();
  });

  test('empties a single-value field', () => {
    expect(
      removeReferences({
        content: { title: 'A', tag: 'travel' },
        relation: singleRelation,
        values,
      }),
    ).toEqual({ content: { title: 'A', tag: '' }, fieldKeyPaths: ['tag'] });
  });

  test('empties a single-value field holding a number as the editor does', () => {
    expect(
      removeReferences({
        content: { title: 'A', author: 3 },
        relation: { ...singleRelation, keyPath: 'author' },
        values: new Set([3]),
      }),
    ).toEqual({ content: { title: 'A', author: null }, fieldKeyPaths: ['author'] });
  });

  test('empties every occurrence of a single-value field nested in a list', () => {
    const content = { 'blocks.0.tag': 'travel', 'blocks.1.tag': 'food', 'blocks.2.tag': 'travel' };

    expect(
      removeReferences({
        content,
        relation: {
          keyPath: 'blocks.*.tag',
          valuePattern: /^blocks\.\d+\.tag$/,
          multiple: false,
        },
        values,
      }),
    ).toEqual({
      content: { 'blocks.0.tag': '', 'blocks.1.tag': 'food', 'blocks.2.tag': '' },
      fieldKeyPaths: ['blocks.0.tag', 'blocks.2.tag'],
    });
  });

  test('removes an item from a multi-value field and renumbers the rest', () => {
    expect(
      removeReferences({
        content: { title: 'A', 'tags.0': 'food', 'tags.1': 'travel', 'tags.2': 'tech' },
        relation: multiRelation,
        values,
      }),
    ).toEqual({
      content: { title: 'A', 'tags.0': 'food', 'tags.1': 'tech' },
      fieldKeyPaths: ['tags'],
    });
  });

  test('removes every item holding a deleted value', () => {
    expect(
      removeReferences({
        content: { 'tags.0': 'travel', 'tags.1': 'food', 'tags.2': 'travel' },
        relation: multiRelation,
        values,
      }).content,
    ).toEqual({ 'tags.0': 'food' });
  });

  test('removes the values of several deleted entries at once', () => {
    expect(
      removeReferences({
        content: { 'tags.0': 'travel', 'tags.1': 'food', 'tags.2': 'tech' },
        relation: multiRelation,
        values: new Set(['travel', 'food']),
      }).content,
    ).toEqual({ 'tags.0': 'tech' });
  });

  test('stores an emptied multi-value field as an empty list', () => {
    expect(
      removeReferences({
        content: { title: 'A', 'tags.0': 'travel' },
        relation: multiRelation,
        values,
      }),
    ).toEqual({ content: { title: 'A', tags: [] }, fieldKeyPaths: ['tags'] });
  });

  test('compacts each affected list of a multi-value field nested in a list', () => {
    const content = {
      'blocks.0.tags.0': 'travel',
      'blocks.0.tags.1': 'food',
      'blocks.1.tags.0': 'food',
      'blocks.2.tags.0': 'travel',
    };

    expect(
      removeReferences({
        content,
        relation: {
          keyPath: 'blocks.*.tags',
          valuePattern: /^blocks\.\d+\.tags\.\d+$/,
          multiple: true,
        },
        values,
      }),
    ).toEqual({
      content: { 'blocks.0.tags.0': 'food', 'blocks.1.tags.0': 'food', 'blocks.2.tags': [] },
      fieldKeyPaths: ['blocks.0.tags', 'blocks.2.tags'],
    });
  });

  test('does not modify the original content', () => {
    const content = { 'tags.0': 'travel', 'tags.1': 'food' };

    removeReferences({ content, relation: multiRelation, values });

    expect(content).toEqual({ 'tags.0': 'travel', 'tags.1': 'food' });
  });
});

describe('getBlockers()', () => {
  const fieldConfig = { widget: 'relation', name: 'tag', label: 'Tag', collection: 'tags' };
  const relation = { fieldConfig, sourceCollection: postsCollection, ...singleRelation };
  const draft = { synthetic: true };
  const entry = createPost('a', { title: 'Post A', tag: 'travel' });
  const content = { title: 'Post A', tag: '' };

  const baseArgs = {
    draft,
    entry,
    relation,
    locale: '_default',
    content,
    fieldKeyPaths: ['tag'],
  };

  test('validates the field with a fresh validity map', () => {
    getBlockers(baseArgs);

    expect(validateAnyField).toHaveBeenCalledWith({
      draft,
      locale: '_default',
      keyPath: 'tag',
      value: '',
      valueMap: content,
      validities: { _default: {} },
    });
  });

  test('reports nothing for a valid field', () => {
    expect(getBlockers(baseArgs)).toEqual([]);
  });

  test('reports nothing for a field the validator skips', () => {
    validateAnyField.mockReturnValue(undefined);

    expect(getBlockers(baseArgs)).toEqual([]);
  });

  test('describes an invalid field', () => {
    const validity = { valid: false, valueMissing: true };

    validateAnyField.mockReturnValue(validity);

    expect(getBlockers(baseArgs)).toEqual([
      {
        collectionName: 'posts',
        collectionLabel: 'Blog Posts',
        fieldLabel: 'Tag',
        entry,
        summary: 'Post A',
        locale: '_default',
        keyPath: 'tag',
        messages: ['This field is required.'],
      },
    ]);
    expect(getFieldValidationMessages).toHaveBeenCalledWith({ validity, fieldConfig });
  });

  test('falls back to the collection and field names', () => {
    validateAnyField.mockReturnValue({ valid: false });

    const [blocker] = getBlockers({
      ...baseArgs,
      relation: {
        ...relation,
        fieldConfig: { ...fieldConfig, label: undefined },
        sourceCollection: { ...postsCollection, label: undefined },
      },
    });

    expect(blocker.collectionLabel).toBe('posts');
    expect(blocker.fieldLabel).toBe('tag');
  });

  test('checks each field', () => {
    validateAnyField.mockReturnValueOnce({ valid: true }).mockReturnValueOnce({ valid: false });

    const blockers = getBlockers({
      ...baseArgs,
      content: { 'blocks.0.tag': '', 'blocks.1.tag': '' },
      fieldKeyPaths: ['blocks.0.tag', 'blocks.1.tag'],
    });

    expect(blockers.map(({ keyPath }) => keyPath)).toEqual(['blocks.1.tag']);
  });
});

describe('planCascadeDelete()', () => {
  const baseArgs = { collection: tagsCollection, entries: [travelTag] };
  const emptyPlan = { targets: [], blockers: [] };

  test('does nothing without entries', () => {
    registerTagRelation();

    expect(planCascadeDelete({ ...baseArgs, entries: [] })).toEqual(emptyPlan);
    expect(getEntriesByCollection).not.toHaveBeenCalled();
  });

  test('does nothing when no Relation field targets the collection', () => {
    expect(planCascadeDelete(baseArgs)).toEqual(emptyPlan);
    expect(getEntriesByCollection).not.toHaveBeenCalled();
  });

  test('does nothing when the deleted entries have no value in the field', () => {
    registerTagRelation();
    getEntryOptions.mockReturnValue([]);

    expect(planCascadeDelete(baseArgs)).toEqual(emptyPlan);
    expect(getEntriesByCollection).not.toHaveBeenCalled();
  });

  test('does nothing when no entry references the deleted entries', () => {
    registerTagRelation();
    getEntriesByCollection.mockReturnValue([createPost('a', { tag: 'food' })]);

    expect(planCascadeDelete(baseArgs)).toEqual(emptyPlan);
    expect(validateAnyField).not.toHaveBeenCalled();
  });

  test('removes the references', () => {
    registerTagRelation();
    getEntriesByCollection.mockReturnValue([
      createPost('my-trip', { title: 'My Trip', tag: 'travel' }),
      createPost('food-review', { title: 'Food Review', tag: 'food' }),
    ]);

    const { targets, blockers } = planCascadeDelete(baseArgs);

    expect(blockers).toEqual([]);
    expect(targets).toEqual([
      {
        entry: createPost('my-trip', { title: 'My Trip', tag: '' }),
        collection: postsCollection,
        collectionFile: undefined,
      },
    ]);
  });

  test('removes the references to every deleted entry', () => {
    registerTagRelation({
      fieldConfig: { name: 'tags', multiple: true },
      context: { typedKeyPath: 'tags' },
    });
    getEntriesByCollection.mockReturnValue([
      createPost('a', { 'tags.0': 'travel', 'tags.1': 'food', 'tags.2': 'tech' }),
    ]);

    const { targets } = planCascadeDelete({ ...baseArgs, entries: [travelTag, foodTag] });

    expect(targets[0].entry.locales._default.content).toEqual({ 'tags.0': 'tech' });
  });

  test('validates the field that lost a reference', () => {
    registerTagRelation();
    getEntriesByCollection.mockReturnValue([createPost('a', { tag: 'travel' })]);

    planCascadeDelete(baseArgs);

    expect(createSyntheticDraft).toHaveBeenCalledWith({
      collection: postsCollection,
      collectionFile: undefined,
      isIndexFile: false,
    });
    expect(validateAnyField).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ synthetic: true }),
        keyPath: 'tag',
        value: '',
        valueMap: { tag: '' },
      }),
    );
  });

  test('reports a field that would be left invalid', () => {
    registerTagRelation({ fieldConfig: { label: 'Tag' } });
    validateAnyField.mockReturnValue({ valid: false, valueMissing: true });
    getEntriesByCollection.mockReturnValue([createPost('a', { title: 'Post A', tag: 'travel' })]);

    const { targets, blockers } = planCascadeDelete(baseArgs);

    // The target is still there, for the count of affected entries
    expect(targets).toHaveLength(1);
    expect(blockers).toEqual([
      expect.objectContaining({
        collectionName: 'posts',
        fieldLabel: 'Tag',
        summary: 'Post A',
        keyPath: 'tag',
        messages: ['This field is required.'],
      }),
    ]);
  });

  test('reports a field invalid in several locales once', () => {
    const i18nCollection = {
      ...postsCollection,
      _i18n: { defaultLocale: 'en', allLocales: ['en', 'fr'] },
    };

    getCollection.mockReturnValue(i18nCollection);
    registerTagRelation();
    validateAnyField.mockReturnValue({ valid: false });
    getEntriesByCollection.mockReturnValue([
      {
        ...createPost('a', {}),
        locales: {
          en: { slug: 'a', path: 'en/a.md', content: { tag: 'travel' } },
          fr: { slug: 'a', path: 'fr/a.md', content: { tag: 'travel' } },
        },
      },
    ]);

    const { blockers } = planCascadeDelete(baseArgs);

    expect(blockers).toHaveLength(1);
    expect(blockers[0].locale).toBe('en');
  });

  test('removes references in every locale of a referencing entry', () => {
    const i18nCollection = {
      ...postsCollection,
      _i18n: { defaultLocale: 'en', allLocales: ['en', 'fr'] },
    };

    getCollection.mockReturnValue(i18nCollection);
    registerTagRelation();
    // The stored value depends on the locale of the entry holding the field
    getEntryOptions.mockImplementation(({ refEntry, locale }) => [
      { label: refEntry.slug, value: `${locale}/${refEntry.slug}` },
    ]);
    getEntriesByCollection.mockReturnValue([
      {
        ...createPost('a', {}),
        locales: {
          en: { slug: 'a', path: 'en/a.md', content: { tag: 'en/travel' } },
          fr: { slug: 'a', path: 'fr/a.md', content: { tag: 'fr/travel' } },
          // An entry can have a locale that’s no longer configured
          de: { slug: 'a', path: 'de/a.md', content: { tag: 'de/travel' } },
          // Or one without content
          es: { slug: 'a', path: 'es/a.md' },
        },
      },
    ]);

    const { targets } = planCascadeDelete(baseArgs);

    expect(targets[0].entry.locales).toEqual({
      en: { slug: 'a', path: 'en/a.md', content: { tag: '' } },
      fr: { slug: 'a', path: 'fr/a.md', content: { tag: '' } },
      de: { slug: 'a', path: 'de/a.md', content: { tag: '' } },
      es: { slug: 'a', path: 'es/a.md' },
    });
  });

  test('skips a locale whose value is not stored', () => {
    const i18nCollection = {
      ...postsCollection,
      _i18n: { defaultLocale: 'en', allLocales: ['en', 'fr'] },
    };

    getCollection.mockReturnValue(i18nCollection);
    registerTagRelation();
    getEntryOptions.mockImplementation(({ refEntry, locale }) =>
      locale === 'en' ? [{ label: refEntry.slug, value: refEntry.slug }] : [],
    );
    getEntriesByCollection.mockReturnValue([
      {
        ...createPost('a', {}),
        locales: {
          en: { slug: 'a', path: 'en/a.md', content: { tag: 'travel' } },
          fr: { slug: 'a', path: 'fr/a.md', content: { tag: 'travel' } },
        },
      },
    ]);

    const { targets } = planCascadeDelete(baseArgs);

    expect(targets[0].entry.locales.en.content.tag).toBe('');
    expect(targets[0].entry.locales.fr.content.tag).toBe('travel');
  });

  test('writes an entry referenced through two fields only once', () => {
    registerTagRelation({ fieldConfig: { name: 'primary' }, context: { typedKeyPath: 'primary' } });
    registerTagRelation({
      fieldConfig: { name: 'tags', multiple: true },
      context: { typedKeyPath: 'tags' },
    });
    getEntriesByCollection.mockReturnValue([
      createPost('a', { primary: 'travel', 'tags.0': 'travel', 'tags.1': 'food' }),
    ]);

    const { targets } = planCascadeDelete(baseArgs);

    expect(targets).toHaveLength(1);
    expect(targets[0].entry.locales._default.content).toEqual({ primary: '', 'tags.0': 'food' });
  });

  test('removes the references to the published version of a renamed entry', () => {
    // Under Editorial Workflow, the pull request renamed `travel` to `trips`; the published posts
    // still reference `travel`, while one the pull request rewrote references `trips`
    const renamedTag = {
      ...createTag('trips'),
      workflow: { previousPaths: ['content/tags/travel.md'] },
    };

    getPublishedVersion.mockImplementation((entry) =>
      entry === renamedTag ? travelTag : undefined,
    );
    registerTagRelation();
    getEntriesByCollection.mockReturnValue([
      createPost('a', { tag: 'travel' }),
      createPost('b', { tag: 'trips' }),
      createPost('c', { tag: 'food' }),
    ]);

    const { targets } = planCascadeDelete({ ...baseArgs, entries: [renamedTag] });

    expect(targets.map(({ entry }) => entry.id)).toEqual(['a', 'b']);
  });

  test('skips the deleted entries themselves', () => {
    registerTagRelation({
      fieldConfig: { name: 'related' },
      context: { collection: { name: 'tags' }, typedKeyPath: 'related' },
    });
    getCollection.mockReturnValue(tagsCollection);
    getEntriesByCollection.mockReturnValue([
      // A deleted entry referencing another deleted entry needs no rewrite
      {
        ...travelTag,
        locales: { _default: { ...travelTag.locales._default, content: { related: 'food' } } },
      },
      {
        ...foodTag,
        locales: { _default: { ...foodTag.locales._default, content: { related: 'travel' } } },
      },
      createTag('tech'),
    ]);

    expect(planCascadeDelete({ ...baseArgs, entries: [travelTag, foodTag] })).toEqual(emptyPlan);
  });

  test('only visits the field’s own file in a file collection', () => {
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

    const { targets } = planCascadeDelete(baseArgs);

    expect(targets).toHaveLength(1);
    expect(targets[0].entry.id).toBe('config-general');
    expect(targets[0].collectionFile).toBe(settingsFile);
    expect(createSyntheticDraft).toHaveBeenCalledWith(
      expect.objectContaining({ collectionFile: settingsFile }),
    );
  });

  test('only considers the fields pointing at the deleted file', () => {
    registerTagRelation({ fieldConfig: { file: 'other' } });
    getEntriesByCollection.mockReturnValue([createPost('a', { tag: 'travel' })]);

    expect(
      planCascadeDelete({ ...baseArgs, collectionFile: { name: 'general', fields: [] } }),
    ).toEqual(emptyPlan);
  });

  test('marks the index file so its fields resolve correctly', () => {
    registerTagRelation();
    isCollectionIndexFile.mockReturnValue(true);
    getEntriesByCollection.mockReturnValue([createPost('_index', { tag: 'travel' })]);

    planCascadeDelete(baseArgs);

    expect(createSyntheticDraft).toHaveBeenCalledWith(
      expect.objectContaining({ isIndexFile: true }),
    );
  });
});

describe('buildCascadeDeleteChanges()', () => {
  test('does nothing without targets', async () => {
    expect(await buildCascadeDeleteChanges({ targets: [] })).toEqual({
      changes: [],
      savingEntries: [],
    });
    expect(buildEntryUpdateChanges).not.toHaveBeenCalled();
  });

  test('builds the update changes for the targets', async () => {
    const cacheDB = { get: vi.fn() };
    const entry = createPost('a', { tag: '' });

    const { changes, savingEntries } = await buildCascadeDeleteChanges({
      targets: [{ entry, collection: postsCollection }],
      cacheDB,
    });

    expect(changes).toEqual([
      { action: 'update', slug: 'a', path: 'content/posts/a.md', data: '' },
    ]);
    expect(savingEntries).toEqual([entry]);
    expect(buildEntryUpdateChanges).toHaveBeenCalledWith(
      expect.objectContaining({ collection: postsCollection, entry }),
    );
  });
});
