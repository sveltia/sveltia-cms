// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  buildTargetChanges,
  compactList,
  dedupeBlockers,
  getFieldBlockers,
} from '$lib/services/contents/entry/cascade';

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

const { isCollectionIndexFile } =
  await import('$lib/services/contents/collection/entries/index-file');

const { validateAnyField } = await import('$lib/services/contents/draft/validate/fields');

const { getFieldValidationMessages } =
  await import('$lib/services/contents/draft/validate/messages');

const { buildEntryUpdateChanges, createSyntheticDraft, resolveCacheDB } =
  await import('$lib/services/contents/entry/changes');

const postsCollection = { name: 'posts', label: 'Blog Posts', _type: 'entry' };

/**
 * Create a blog post entry.
 * @param {string} id Entry ID and slug.
 * @param {Record<string, any>} [content] Flattened content.
 * @returns {object} Entry.
 */
const createPost = (id, content = {}) => ({
  id,
  slug: id,
  subPath: id,
  locales: { _default: { slug: id, path: `content/posts/${id}.md`, content } },
});

beforeEach(() => {
  vi.clearAllMocks();
  isCollectionIndexFile.mockReturnValue(false);
  validateAnyField.mockReturnValue({ valid: true });
  getFieldValidationMessages.mockReturnValue(['This field is required.']);
});

describe('compactList()', () => {
  test('removes the stale items and renumbers the rest', () => {
    const content = { title: 'A', 'tags.0': 'food', 'tags.1': 'travel', 'tags.2': 'tech' };

    compactList({ content, listKeyPath: 'tags', isStale: vi.fn((key) => key === 'tags.1') });

    expect(content).toEqual({ title: 'A', 'tags.0': 'food', 'tags.1': 'tech' });
  });

  test('passes the key and the value to the predicate', () => {
    const content = { 'tags.0': 'food', 'tags.1': 'travel' };
    const isStale = vi.fn(() => false);

    compactList({ content, listKeyPath: 'tags', isStale });

    expect(isStale.mock.calls).toEqual([
      ['tags.0', 'food'],
      ['tags.1', 'travel'],
    ]);
    expect(content).toEqual({ 'tags.0': 'food', 'tags.1': 'travel' });
  });

  test('stores an emptied list as an empty array', () => {
    const content = { title: 'A', 'tags.0': 'travel' };

    compactList({ content, listKeyPath: 'tags', isStale: vi.fn(() => true) });

    expect(content).toEqual({ title: 'A', tags: [] });
  });

  test('only touches the given list', () => {
    const content = {
      'blocks.0.tags.0': 'travel',
      'blocks.0.tags.1': 'food',
      'blocks.1.tags.0': 'travel',
    };

    compactList({
      content,
      listKeyPath: 'blocks.0.tags',
      isStale: vi.fn((_key, value) => value === 'travel'),
    });

    expect(content).toEqual({ 'blocks.0.tags.0': 'food', 'blocks.1.tags.0': 'travel' });
  });

  test('reads the keys as they are, not from a stale index', () => {
    // The same object is compacted twice; the second pass has to see the first pass’s keys
    const content = { 'a.0': 'x', 'a.1': 'y', 'b.0': 'x' };

    compactList({ content, listKeyPath: 'a', isStale: vi.fn((_key, value) => value === 'x') });
    compactList({ content, listKeyPath: 'a', isStale: vi.fn((_key, value) => value === 'y') });

    expect(content).toEqual({ a: [], 'b.0': 'x' });
  });
});

describe('getFieldBlockers()', () => {
  const fieldConfig = { widget: 'relation', name: 'tag', label: 'Tag', collection: 'tags' };
  const draft = { synthetic: true };
  const entry = createPost('a', { title: 'Post A', tag: 'travel' });
  const content = { title: 'Post A', tag: '' };

  const baseArgs = {
    draft,
    entry,
    collection: postsCollection,
    locale: '_default',
    content,
    fields: new Map([['tag', fieldConfig]]),
  };

  test('validates the field with a fresh validity map', () => {
    getFieldBlockers(baseArgs);

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
    expect(getFieldBlockers(baseArgs)).toEqual([]);
  });

  test('reports nothing for a field the validator skips', () => {
    validateAnyField.mockReturnValue(undefined);

    expect(getFieldBlockers(baseArgs)).toEqual([]);
  });

  test('describes an invalid field', () => {
    const validity = { valid: false, valueMissing: true };

    validateAnyField.mockReturnValue(validity);

    expect(getFieldBlockers(baseArgs)).toEqual([
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

    const [blocker] = getFieldBlockers({
      ...baseArgs,
      collection: { ...postsCollection, label: undefined },
      fields: new Map([['tag', { ...fieldConfig, label: undefined }]]),
    });

    expect(blocker.collectionLabel).toBe('posts');
    expect(blocker.fieldLabel).toBe('tag');
  });

  test('checks each field', () => {
    validateAnyField.mockReturnValueOnce({ valid: true }).mockReturnValueOnce({ valid: false });

    const blockers = getFieldBlockers({
      ...baseArgs,
      content: { 'blocks.0.tag': '', 'blocks.1.tag': '' },
      fields: new Map([
        ['blocks.0.tag', fieldConfig],
        ['blocks.1.tag', fieldConfig],
      ]),
    });

    expect(blockers.map(({ keyPath }) => keyPath)).toEqual(['blocks.1.tag']);
  });
});

describe('dedupeBlockers()', () => {
  test('keeps the first of the blockers for the same field in several locales', () => {
    const entry = createPost('a');

    const blockers = [
      { entry, keyPath: 'tag', locale: 'en' },
      { entry, keyPath: 'tag', locale: 'fr' },
      { entry, keyPath: 'tags', locale: 'en' },
      { entry: createPost('b'), keyPath: 'tag', locale: 'en' },
    ];

    expect(dedupeBlockers(blockers)).toEqual([blockers[0], blockers[2], blockers[3]]);
  });
});

describe('buildTargetChanges()', () => {
  test('does nothing without targets', async () => {
    expect(await buildTargetChanges({ targets: [] })).toEqual({ changes: [], savingEntries: [] });
    expect(resolveCacheDB).not.toHaveBeenCalled();
  });

  test('builds an update change per target', async () => {
    const targets = [
      { entry: createPost('a'), collection: postsCollection },
      { entry: createPost('b'), collection: postsCollection },
    ];

    const { changes, savingEntries } = await buildTargetChanges({ targets });

    expect(changes.map(({ path }) => path)).toEqual(['content/posts/a.md', 'content/posts/b.md']);
    expect(savingEntries).toEqual(targets.map(({ entry }) => entry));
    expect(createSyntheticDraft).toHaveBeenCalledWith({
      collection: postsCollection,
      collectionFile: undefined,
      isIndexFile: false,
    });
  });

  test('passes the collection file along', async () => {
    const collection = { name: 'config', _type: 'file' };
    const collectionFile = { name: 'general' };

    await buildTargetChanges({
      targets: [{ entry: createPost('general'), collection, collectionFile }],
    });

    expect(buildEntryUpdateChanges).toHaveBeenCalledWith(
      expect.objectContaining({ collection, collectionFile }),
    );
    expect(createSyntheticDraft).toHaveBeenCalledWith(
      expect.objectContaining({ collection, collectionFile }),
    );
  });

  test('marks the index file so its fields resolve correctly', async () => {
    isCollectionIndexFile.mockReturnValue(true);

    await buildTargetChanges({
      targets: [{ entry: createPost('_index'), collection: postsCollection }],
    });

    expect(createSyntheticDraft).toHaveBeenCalledWith(
      expect.objectContaining({ isIndexFile: true }),
    );
  });

  test('reuses the caller’s file cache database', async () => {
    const cacheDB = { get: vi.fn() };

    resolveCacheDB.mockReturnValue(cacheDB);

    await buildTargetChanges({
      targets: [{ entry: createPost('a'), collection: postsCollection }],
      cacheDB,
    });

    expect(resolveCacheDB).toHaveBeenCalledWith(cacheDB);
    expect(buildEntryUpdateChanges).toHaveBeenCalledWith(expect.objectContaining({ cacheDB }));
  });
});
