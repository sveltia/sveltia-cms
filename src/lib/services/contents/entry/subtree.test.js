import { describe, expect, test } from 'vitest';

import {
  deleteSubtree,
  getSubtree,
  getSubtreeEntries,
  hasSubtree,
  isPlaceholder,
  setSubtree,
} from '$lib/services/contents/entry/subtree';

describe('isPlaceholder()', () => {
  test('should detect empty objects and arrays', () => {
    expect(isPlaceholder({})).toBe(true);
    expect(isPlaceholder([])).toBe(true);
  });

  test('should reject anything else', () => {
    expect(isPlaceholder({ a: 1 })).toBe(false);
    expect(isPlaceholder(['a'])).toBe(false);
    expect(isPlaceholder('')).toBe(false);
    expect(isPlaceholder(null)).toBe(false);
    expect(isPlaceholder(undefined)).toBe(false);
    expect(isPlaceholder(0)).toBe(false);
  });
});

describe('getSubtreeEntries()', () => {
  test('should put the object placeholder first', () => {
    const entries = getSubtreeEntries('snippet', { code: 'a', lang: 'js' });

    expect(Object.keys(entries)).toEqual(['snippet', 'snippet.code', 'snippet.lang']);
    expect(entries.snippet).toEqual({});
  });

  test('should put the array placeholder first', () => {
    const entries = getSubtreeEntries('tags', ['a', 'b']);

    expect(Object.keys(entries)).toEqual(['tags', 'tags.0', 'tags.1']);
    expect(entries.tags).toEqual([]);
  });

  test('should flatten nested values', () => {
    expect(getSubtreeEntries('meta', { author: { name: 'Kohei' } })).toEqual({
      meta: {},
      'meta.author.name': 'Kohei',
    });
  });

  test('should keep the placeholder for an empty value', () => {
    expect(getSubtreeEntries('tags', [])).toEqual({ tags: [] });
    expect(getSubtreeEntries('meta', {})).toEqual({ meta: {} });
  });
});

describe('getSubtree()', () => {
  test('should assemble an object', () => {
    const valueMap = { snippet: {}, 'snippet.code': 'a', 'snippet.lang': 'js' };

    expect(getSubtree(valueMap, 'snippet')).toEqual({ code: 'a', lang: 'js' });
  });

  test('should assemble an array', () => {
    const valueMap = { tags: [], 'tags.0': 'a', 'tags.1': 'b' };

    expect(getSubtree(valueMap, 'tags')).toEqual(['a', 'b']);
  });

  test('should assemble an array even when the placeholder is missing', () => {
    expect(getSubtree({ 'tags.0': 'a', 'tags.1': 'b' }, 'tags')).toEqual(['a', 'b']);
  });

  test('should keep numeric keys as an object when the placeholder says so', () => {
    // This is what the placeholder is for: without it, `unflatten()` would build an array
    const valueMap = { kv: {}, 'kv.0': 'a', 'kv.1': 'b' };

    expect(getSubtree(valueMap, 'kv')).toEqual({ 0: 'a', 1: 'b' });
  });

  test('should survive a placeholder written after its children', () => {
    const valueMap = { 'snippet.code': 'a', 'snippet.lang': 'js', snippet: {} };

    expect(getSubtree(valueMap, 'snippet')).toEqual({ code: 'a', lang: 'js' });
  });

  test('should ignore a non-placeholder value at the key path', () => {
    const valueMap = { snippet: 'scalar', 'snippet.code': 'a' };

    expect(getSubtree(valueMap, 'snippet')).toEqual({ code: 'a' });
  });

  test('should return undefined when there are no children', () => {
    expect(getSubtree({ snippet: {} }, 'snippet')).toBeUndefined();
    expect(getSubtree({}, 'snippet')).toBeUndefined();
  });

  test('should not pick up a sibling with a shared prefix', () => {
    const valueMap = { 'tag.0': 'a', 'tags.0': 'b' };

    expect(getSubtree(valueMap, 'tag')).toEqual(['a']);
    expect(getSubtree(valueMap, 'tags')).toEqual(['b']);
  });
});

describe('hasSubtree()', () => {
  test('should detect a scalar value of its own', () => {
    expect(hasSubtree({ title: 'Hello' }, 'title')).toBe(true);
    expect(hasSubtree({ title: '' }, 'title')).toBe(true);
    expect(hasSubtree({ title: null }, 'title')).toBe(true);
  });

  test('should detect descendants', () => {
    const valueMap = { 'authors.0.name': 'Kohei', 'authors.0.role': 'dev' };

    expect(hasSubtree(valueMap, 'authors')).toBe(true);
    expect(hasSubtree(valueMap, 'authors.0')).toBe(true);
  });

  test('should reject a missing key path', () => {
    const valueMap = { 'authors.0.name': 'Kohei' };

    expect(hasSubtree(valueMap, 'authors.1')).toBe(false);
    expect(hasSubtree(valueMap, 'tags')).toBe(false);
  });

  test('should reject an empty container left behind as a placeholder', () => {
    expect(hasSubtree({ authors: [] }, 'authors')).toBe(false);
    expect(hasSubtree({ meta: {} }, 'meta')).toBe(false);
  });

  test('should accept a placeholder that still has descendants', () => {
    expect(hasSubtree({ authors: [], 'authors.0.name': 'Kohei' }, 'authors')).toBe(true);
  });

  test('should not match a key path that merely shares a prefix', () => {
    expect(hasSubtree({ 'authors.0.name': 'Kohei' }, 'author')).toBe(false);
    expect(hasSubtree({ 'authors.10.name': 'Kohei' }, 'authors.1')).toBe(false);
  });
});

describe('deleteSubtree()', () => {
  test('should drop the key path and everything below it', () => {
    const valueMap = { title: 'x', tags: [], 'tags.0': 'a', 'tags.1': 'b' };

    deleteSubtree(valueMap, 'tags');
    expect(valueMap).toEqual({ title: 'x' });
  });

  test('should not drop a sibling with a shared prefix', () => {
    const valueMap = { tag: 'x', 'tags.0': 'a' };

    deleteSubtree(valueMap, 'tags');
    expect(valueMap).toEqual({ tag: 'x' });
  });
});

describe('setSubtree()', () => {
  test('should replace the existing subtree', () => {
    const valueMap = { title: 'x', tags: [], 'tags.0': 'a', 'tags.1': 'b' };

    setSubtree(valueMap, 'tags', ['c']);
    expect(valueMap).toEqual({ title: 'x', tags: [], 'tags.0': 'c' });
  });

  test('should drop keys the new value no longer has', () => {
    const valueMap = { snippet: {}, 'snippet.code': 'a', 'snippet.lang': 'js' };

    setSubtree(valueMap, 'snippet', { code: 'b' });
    expect(valueMap).toEqual({ snippet: {}, 'snippet.code': 'b' });
  });

  test('should round-trip through getSubtree', () => {
    /** @type {Record<string, any>} */
    const valueMap = {};
    const value = { author: { name: 'Kohei' }, tags: ['a', 'b'] };

    setSubtree(valueMap, 'meta', value);
    expect(getSubtree(valueMap, 'meta')).toEqual(value);
  });
});
