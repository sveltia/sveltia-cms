import { describe, expect, test } from 'vitest';

import {
  getItemIndexes,
  getListItemIndexes,
  hasChildKeys,
  indexContent,
  indexListItems,
} from '$lib/services/contents/entry/content-index';

describe('indexContent()', () => {
  test('should map each key path to its direct child segments', () => {
    const { childSegmentMap } = indexContent({ 'colors.0.name': 'red' });

    expect([...childSegmentMap]).toEqual([
      ['colors', new Set(['0'])],
      ['colors.0', new Set(['name'])],
    ]);
  });

  test('should merge the children of sibling keys', () => {
    const { childSegmentMap } = indexContent({
      'author.name': 'Kohei',
      'author.email': 'test@example.com',
      title: 'Hello',
    });

    expect(childSegmentMap.get('author')).toEqual(new Set(['name', 'email']));
    expect(childSegmentMap.has('title')).toBe(false);
  });

  test('should index empty content', () => {
    expect(indexContent({}).childSegmentMap.size).toBe(0);
  });
});

describe('hasChildKeys()', () => {
  test('should detect a key path with children', () => {
    const index = indexContent({ 'author.name': 'Kohei', title: 'Hello' });

    expect(hasChildKeys(index, 'author')).toBe(true);
    expect(hasChildKeys(index, 'title')).toBe(false);
    expect(hasChildKeys(index, 'unknown')).toBe(false);
  });
});

describe('getItemIndexes()', () => {
  test('should collect the numeric segments in ascending order', () => {
    const index = indexContent({
      'authors.10.name': 'J',
      'authors.2.name': 'K',
      'authors.0.name': 'L',
    });

    expect(getItemIndexes(index, 'authors')).toEqual([0, 2, 10]);
  });

  test('should ignore non-numeric segments', () => {
    const index = indexContent({ 'meta.0': 'a', 'meta.title': 'b' });

    expect(getItemIndexes(index, 'meta')).toEqual([0]);
  });

  test('should return an empty list for an unknown key path', () => {
    expect(getItemIndexes(indexContent({}), 'authors')).toEqual([]);
  });
});

describe('indexListItems()', () => {
  test('should record only the numeric segments', () => {
    const index = indexListItems({ 'authors.0.name': 'K', 'authors.1.name': 'L', title: 'Hello' });

    expect([...index]).toEqual([['authors', new Set([0, 1])]]);
  });

  test('should record a nested list', () => {
    const index = indexListItems({ 'sections.0.authors.2.name': 'K' });

    expect(index.get('sections')).toEqual(new Set([0]));
    expect(index.get('sections.0.authors')).toEqual(new Set([2]));
  });

  test('should record an item holding a primitive', () => {
    expect([...indexListItems({ 'tags.0': 'a', 'tags.1': 'b' })]).toEqual([
      ['tags', new Set([0, 1])],
    ]);
  });

  test('should index content with no list at all', () => {
    expect(indexListItems({ title: 'Hello', 'author.name': 'K' }).size).toBe(0);
  });
});

describe('getListItemIndexes()', () => {
  test('should return the indexes in ascending order', () => {
    const index = indexListItems({
      'authors.10.name': 'J',
      'authors.2.name': 'K',
      'authors.0.name': 'L',
    });

    expect(getListItemIndexes(index, 'authors')).toEqual([0, 2, 10]);
  });

  test('should return an empty list for an unknown key path', () => {
    expect(getListItemIndexes(indexListItems({}), 'authors')).toEqual([]);
  });
});
