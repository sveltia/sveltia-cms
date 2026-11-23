import { describe, expect, test, vi } from 'vitest';

import { getValueOwnerField } from './owner-field';

/**
 * @import { Field } from '$lib/types/public';
 */

/** @type {Field[]} */
const fields = [
  { name: 'title', widget: 'string' },
  { name: 'metadata', widget: 'keyvalue' },
  { name: 'tags', widget: 'list' },
  { name: 'links', widget: 'list', fields: [{ name: 'url', widget: 'string' }] },
  { name: 'snippet', widget: 'code' },
  { name: 'script', widget: 'code', output_code_only: true },
];

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(() => ({ name: 'posts', _type: 'entry', fields })),
}));

describe('Test getValueOwnerField()', () => {
  const args = { collectionName: 'posts' };

  test('should resolve the field owning a KeyValue pair, a list item or a Code value', () => {
    expect(getValueOwnerField({ ...args, keyPath: 'metadata.foo' })).toEqual({
      keyPath: 'metadata',
      fieldConfig: fields[1],
    });
    expect(getValueOwnerField({ ...args, keyPath: 'tags.0' })).toEqual({
      keyPath: 'tags',
      fieldConfig: fields[2],
    });
    expect(getValueOwnerField({ ...args, keyPath: 'snippet.lang' })).toEqual({
      keyPath: 'snippet',
      fieldConfig: fields[4],
    });
  });

  test('should return `undefined` for a value that no field owns', () => {
    expect(getValueOwnerField({ ...args, keyPath: 'title' })).toBeUndefined();
    expect(getValueOwnerField({ ...args, keyPath: 'unknown.foo' })).toBeUndefined();
    expect(getValueOwnerField({ ...args, keyPath: 'title.foo' })).toBeUndefined();
    // A list with subfields has fields of its own, and a list item index is numeric
    expect(getValueOwnerField({ ...args, keyPath: 'links.0' })).toBeUndefined();
    expect(getValueOwnerField({ ...args, keyPath: 'tags.foo' })).toBeUndefined();
    // A Code field that outputs the code only stores a string
    expect(getValueOwnerField({ ...args, keyPath: 'script.code' })).toBeUndefined();
  });
});
