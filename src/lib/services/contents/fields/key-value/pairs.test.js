import { describe, expect, test, vi } from 'vitest';

import { getKeyValueField, getPairsFromContent, setPairs } from './pairs';

/**
 * @import { Field } from '$lib/types/public';
 */

/** @type {Field[]} */
const fields = [
  { name: 'title', widget: 'string' },
  { name: 'metadata', widget: 'keyvalue', i18n: 'duplicate_keys' },
  {
    name: 'sections',
    widget: 'list',
    fields: [{ name: 'attrs', widget: 'keyvalue' }],
  },
];

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(() => ({ name: 'posts', _type: 'entry', fields })),
}));

describe('Test getPairsFromContent()', () => {
  test('should extract the pairs stored under the key path, in insertion order', () => {
    const content = {
      title: 'Hello',
      'metadata.b': '2',
      'metadata.a': '1',
      'metadata.': 'empty key',
      'other.a': 'x',
    };

    expect(getPairsFromContent(content, 'metadata')).toEqual([
      ['b', '2'],
      ['a', '1'],
      ['', 'empty key'],
    ]);
  });

  test('should return an empty array when the field holds no pairs', () => {
    expect(getPairsFromContent({ title: 'Hello', metadata: null }, 'metadata')).toEqual([]);
  });
});

describe('Test setPairs()', () => {
  test('should replace the existing pairs, leaving other fields alone', () => {
    const content = {
      title: 'Hello',
      'metadata.old': 'x',
      'other.old': 'y',
    };

    setPairs(content, 'metadata', [
      ['a', '1'],
      ['b', '2'],
    ]);

    expect(content).toEqual({
      title: 'Hello',
      'metadata.a': '1',
      'metadata.b': '2',
      'other.old': 'y',
    });
  });

  test('should remove the `null` placeholder once there are pairs', () => {
    const content = { metadata: null };

    setPairs(content, 'metadata', [['a', '1']]);

    expect(content).toEqual({ 'metadata.a': '1' });
  });

  test('should keep the `null` placeholder while there are no pairs', () => {
    const content = { metadata: null, 'metadata.a': '1' };

    setPairs(content, 'metadata', []);

    expect(content).toEqual({ metadata: null });
  });

  test('should not touch a non-null value stored at the key path', () => {
    const content = { metadata: {} };

    setPairs(content, 'metadata', [['a', '1']]);

    expect(content).toEqual({ metadata: {}, 'metadata.a': '1' });
  });
});

describe('Test getKeyValueField()', () => {
  test('should resolve the KeyValue field a pair belongs to', () => {
    expect(getKeyValueField({ collectionName: 'posts', keyPath: 'metadata.foo' })).toEqual(
      fields[1],
    );
    expect(getKeyValueField({ collectionName: 'posts', keyPath: 'metadata.' })).toEqual(fields[1]);
  });

  test('should resolve a KeyValue field nested in a list item', () => {
    expect(getKeyValueField({ collectionName: 'posts', keyPath: 'sections.0.attrs.foo' })).toEqual({
      name: 'attrs',
      widget: 'keyvalue',
    });
  });

  test('should return `undefined` for a top-level key path', () => {
    expect(getKeyValueField({ collectionName: 'posts', keyPath: 'metadata' })).toBeUndefined();
    expect(getKeyValueField({ collectionName: 'posts', keyPath: 'title' })).toBeUndefined();
  });

  test('should return `undefined` when the parent is not a KeyValue field', () => {
    expect(getKeyValueField({ collectionName: 'posts', keyPath: 'sections.0' })).toBeUndefined();
    expect(getKeyValueField({ collectionName: 'posts', keyPath: 'unknown.foo' })).toBeUndefined();
  });
});
