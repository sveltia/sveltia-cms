// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getEntryRelationValues,
  getReferencingRelationFields,
  getRelationKeyPaths,
  getRelationValues,
  resolveRelationKeyPath,
} from '$lib/services/contents/entry/relations';

vi.mock('$lib/services/config', () => ({
  collectors: { relationFields: new Set() },
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFile: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/relation/helpers', () => ({
  getEntryOptions: vi.fn(() => []),
}));

const { collectors } = await import('$lib/services/config');
const { getCollection } = await import('$lib/services/contents/collection');
const { getCollectionFile } = await import('$lib/services/contents/collection/files');
const { getEntryOptions } = await import('$lib/services/contents/fields/relation/helpers');

beforeEach(() => {
  vi.clearAllMocks();
  collectors.relationFields = new Set();
});

describe('resolveRelationKeyPath()', () => {
  test('uses the typed key path as is when it has no annotation or wildcard', () => {
    expect(
      resolveRelationKeyPath({ fieldConfig: { name: 'tag' }, context: { typedKeyPath: 'tag' } }),
    ).toEqual({ keyPath: 'tag', valuePattern: undefined });
  });

  test('falls back to the field name when the typed key path is missing', () => {
    expect(resolveRelationKeyPath({ fieldConfig: { name: 'tag' }, context: {} })).toEqual({
      keyPath: 'tag',
      valuePattern: undefined,
    });
  });

  test('strips type annotations while keeping wildcards', () => {
    const { keyPath, valuePattern } = resolveRelationKeyPath({
      fieldConfig: { name: 'tag' },
      context: { typedKeyPath: 'blocks.*<item>.tag' },
    });

    expect(keyPath).toBe('blocks.*.tag');
    expect(valuePattern?.source).toBe('^blocks\\.\\d+\\.tag$');
    expect(valuePattern?.test('blocks.0.tag')).toBe(true);
    expect(valuePattern?.test('blocks.0.title')).toBe(false);
  });

  test('appends an item index for a multi-value field nested in a list', () => {
    const { valuePattern } = resolveRelationKeyPath({
      fieldConfig: { name: 'tags', multiple: true },
      context: { typedKeyPath: 'blocks.*.tags' },
    });

    expect(valuePattern?.test('blocks.0.tags.1')).toBe(true);
    expect(valuePattern?.test('blocks.0.tags')).toBe(false);
  });
});

describe('getRelationKeyPaths()', () => {
  test('returns the key path itself for a single-value field', () => {
    expect(getRelationKeyPaths({ content: { tag: 'travel' }, keyPath: 'tag' })).toEqual(['tag']);
  });

  test('returns nothing when the value is absent', () => {
    expect(getRelationKeyPaths({ content: { tag: undefined }, keyPath: 'tag' })).toEqual([]);
    expect(getRelationKeyPaths({ content: { tag: null }, keyPath: 'tag' })).toEqual([]);
    expect(getRelationKeyPaths({ content: {}, keyPath: 'tag' })).toEqual([]);
  });

  test('keeps falsy but valid values', () => {
    expect(getRelationKeyPaths({ content: { tag: '' }, keyPath: 'tag' })).toEqual(['tag']);
    expect(getRelationKeyPaths({ content: { tag: 0 }, keyPath: 'tag' })).toEqual(['tag']);
  });

  test('expands a multi-value field into one key path per item', () => {
    expect(
      getRelationKeyPaths({
        content: { 'tags.0': 'travel', 'tags.1': 'food', title: 'Trip' },
        keyPath: 'tags',
        multiple: true,
      }),
    ).toEqual(['tags.0', 'tags.1']);
  });

  test('skips absent items of a multi-value field', () => {
    expect(
      getRelationKeyPaths({
        content: { 'tags.0': 'travel', 'tags.1': null },
        keyPath: 'tags',
        multiple: true,
      }),
    ).toEqual(['tags.0']);
  });

  test('expands a wildcard key path against the content', () => {
    const { keyPath, valuePattern } = resolveRelationKeyPath({
      fieldConfig: { name: 'tag' },
      context: { typedKeyPath: 'blocks.*.tag' },
    });

    expect(
      getRelationKeyPaths({
        content: {
          'blocks.0.tag': 'travel',
          'blocks.1.tag': 'food',
          'blocks.1.title': 'Food',
          'other.0.tag': 'travel',
        },
        keyPath,
        valuePattern,
      }),
    ).toEqual(['blocks.0.tag', 'blocks.1.tag']);
  });

  test('expands a multi-value field nested in a list', () => {
    const { keyPath, valuePattern } = resolveRelationKeyPath({
      fieldConfig: { name: 'tags', multiple: true },
      context: { typedKeyPath: 'blocks.*.tags' },
    });

    expect(
      getRelationKeyPaths({
        content: { 'blocks.0.tags.0': 'travel', 'blocks.0.tags.1': 'food', 'blocks.1.tags.0': 'a' },
        keyPath,
        valuePattern,
        multiple: true,
      }),
    ).toEqual(['blocks.0.tags.0', 'blocks.0.tags.1', 'blocks.1.tags.0']);
  });
});

describe('getRelationValues()', () => {
  test('resolves the stored values', () => {
    expect(
      getRelationValues({
        content: { 'tags.0': 'travel', 'tags.1': 'food' },
        keyPath: 'tags',
        multiple: true,
      }),
    ).toEqual(['travel', 'food']);
  });
});

describe('getEntryRelationValues()', () => {
  test('maps the entry’s options to their stored values', () => {
    const fieldConfig = { widget: 'relation', name: 'tag', collection: 'tags' };
    const entry = { id: 'tag-1', slug: 'travel' };

    getEntryOptions.mockReturnValue([
      { label: 'Travel', value: 'travel' },
      { label: 'Voyage', value: 'fr/travel' },
    ]);

    expect(getEntryRelationValues({ fieldConfig, entry, locale: 'en' })).toEqual([
      'travel',
      'fr/travel',
    ]);

    expect(getEntryOptions).toHaveBeenCalledWith({ locale: 'en', fieldConfig, refEntry: entry });
  });
});

describe('getReferencingRelationFields()', () => {
  const postsCollection = { name: 'posts', label: 'Blog Posts', _type: 'entry' };

  test('returns nothing when no Relation field targets the collection', () => {
    collectors.relationFields = new Set([
      {
        fieldConfig: { name: 'tag', collection: 'categories' },
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    expect(getReferencingRelationFields({ collectionName: 'tags' })).toEqual([]);
  });

  test('resolves the source collection and key path', () => {
    getCollection.mockReturnValue(postsCollection);

    collectors.relationFields = new Set([
      {
        fieldConfig: { name: 'tags', collection: 'tags', multiple: true },
        context: { collection: { name: 'posts' }, typedKeyPath: 'tags' },
      },
    ]);

    expect(getReferencingRelationFields({ collectionName: 'tags' })).toEqual([
      {
        fieldConfig: { name: 'tags', collection: 'tags', multiple: true },
        sourceCollection: postsCollection,
        sourceCollectionFile: undefined,
        keyPath: 'tags',
        valuePattern: undefined,
        multiple: true,
      },
    ]);
  });

  test('omits fields whose source collection is no longer configured', () => {
    getCollection.mockReturnValue(undefined);

    collectors.relationFields = new Set([
      {
        fieldConfig: { name: 'tag', collection: 'tags' },
        context: { collection: { name: 'gone' }, typedKeyPath: 'tag' },
      },
    ]);

    expect(getReferencingRelationFields({ collectionName: 'tags' })).toEqual([]);
  });

  test('omits fields with no source collection in the parser context', () => {
    collectors.relationFields = new Set([
      {
        fieldConfig: { name: 'tag', collection: 'tags' },
        context: { typedKeyPath: 'tag' },
      },
    ]);

    expect(getReferencingRelationFields({ collectionName: 'tags' })).toEqual([]);
    expect(getCollection).not.toHaveBeenCalled();
  });

  test('resolves the source collection file', () => {
    const settingsFile = { name: 'settings', fields: [] };

    getCollection.mockReturnValue({ name: 'config', label: 'Config' });
    getCollectionFile.mockReturnValue(settingsFile);

    collectors.relationFields = new Set([
      {
        fieldConfig: { name: 'tag', collection: 'tags' },
        context: {
          collection: { name: 'config' },
          collectionFile: { name: 'settings' },
          typedKeyPath: 'tag',
        },
      },
    ]);

    const [resolved] = getReferencingRelationFields({ collectionName: 'tags' });

    expect(resolved.sourceCollectionFile).toBe(settingsFile);
    expect(getCollectionFile).toHaveBeenCalledWith({ name: 'config', label: 'Config' }, 'settings');
  });

  test('keeps a field targeting the same file of a file collection', () => {
    getCollection.mockReturnValue(postsCollection);

    collectors.relationFields = new Set([
      {
        fieldConfig: { name: 'tag', collection: 'settings', file: 'general' },
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    expect(
      getReferencingRelationFields({ collectionName: 'settings', fileName: 'general' }),
    ).toHaveLength(1);
  });

  test('drops a field targeting another file of the same file collection', () => {
    getCollection.mockReturnValue(postsCollection);

    collectors.relationFields = new Set([
      {
        fieldConfig: { name: 'tag', collection: 'settings', file: 'general' },
        context: { collection: { name: 'posts' }, typedKeyPath: 'tag' },
      },
    ]);

    expect(getReferencingRelationFields({ collectionName: 'settings', fileName: 'other' })).toEqual(
      [],
    );
  });
});
