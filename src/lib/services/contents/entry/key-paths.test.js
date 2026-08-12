import { describe, expect, test } from 'vitest';

import { getKeysByPrefix, getListItemKeys } from '$lib/services/contents/entry/key-paths';

describe('getKeysByPrefix()', () => {
  test('returns the keys under the prefix in the value map’s own order', () => {
    const valueMap = {
      'item.0.zebra': 'z',
      'item.0.apple': 'a',
      title: 'Hello',
      'item.0.mango': 'm',
    };

    // Insertion order, not alphabetical — callers rely on this to pick the “first” field
    expect(getKeysByPrefix(valueMap, 'item.0.')).toEqual([
      'item.0.zebra',
      'item.0.apple',
      'item.0.mango',
    ]);
  });

  test('does not confuse adjacent numeric indexes', () => {
    const valueMap = {
      'item.1.name': 'one',
      'item.10.name': 'ten',
      'item.11.name': 'eleven',
      'item.2.name': 'two',
    };

    expect(getKeysByPrefix(valueMap, 'item.1.')).toEqual(['item.1.name']);
    expect(getKeysByPrefix(valueMap, 'item.10.')).toEqual(['item.10.name']);
  });

  test('returns an empty array when nothing matches', () => {
    expect(getKeysByPrefix({ title: 'Hello' }, 'item.0.')).toEqual([]);
    expect(getKeysByPrefix({}, 'item.0.')).toEqual([]);
  });

  test('reuses the index for the same value map', () => {
    const valueMap = { 'item.0.name': 'a', 'item.1.name': 'b' };

    expect(getKeysByPrefix(valueMap, 'item.')).toEqual(['item.0.name', 'item.1.name']);
    // Second call goes through the cached index and must agree
    expect(getKeysByPrefix(valueMap, 'item.')).toEqual(['item.0.name', 'item.1.name']);
  });
});

describe('getListItemKeys()', () => {
  test('returns the direct numeric children of the key path in value map order', () => {
    const valueMap = {
      title: 'Hello',
      'authors.0': 'a',
      'authors.1': 'b',
      'authors.2': 'c',
    };

    expect(getListItemKeys(valueMap, 'authors')).toEqual(['authors.0', 'authors.1', 'authors.2']);
  });

  test('does not return grandchildren', () => {
    const valueMap = {
      'sections.0.heading': 'One',
      'sections.0.tags.0': 'x',
      'sections.1.heading': 'Two',
    };

    // `sections.0.heading` is not a direct numeric child, but `sections.0.tags.0` is one of
    // `sections.0.tags`
    expect(getListItemKeys(valueMap, 'sections')).toEqual([]);
    expect(getListItemKeys(valueMap, 'sections.0.tags')).toEqual(['sections.0.tags.0']);
  });

  test('returns an empty array for an unknown key path', () => {
    expect(getListItemKeys({ 'authors.0': 'a' }, 'editors')).toEqual([]);
    expect(getListItemKeys({}, 'authors')).toEqual([]);
  });

  test('reuses the index for the same value map', () => {
    const valueMap = { 'authors.0': 'a', 'authors.1': 'b' };

    expect(getListItemKeys(valueMap, 'authors')).toEqual(['authors.0', 'authors.1']);
    // Second call goes through the cached index and must agree
    expect(getListItemKeys(valueMap, 'authors')).toEqual(['authors.0', 'authors.1']);
  });
});
