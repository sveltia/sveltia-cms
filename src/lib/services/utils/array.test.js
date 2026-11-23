import { describe, expect, test } from 'vitest';

import { splitIntoChunks, splitIntoSizedChunks, toggleListItem } from '$lib/services/utils/array';

describe('toggleListItem()', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };

  test('adds a missing item', () => {
    expect(toggleListItem([a], b, true)).toEqual([a, b]);
  });

  test('removes a present item', () => {
    expect(toggleListItem([a, b], a, false)).toEqual([b]);
  });

  test('returns the same list when nothing changes', () => {
    const list = [a];

    expect(toggleListItem(list, a, true)).toBe(list);
    expect(toggleListItem(list, b, false)).toBe(list);
  });

  test('leaves the original list alone', () => {
    const list = [a];

    toggleListItem(list, b, true);
    toggleListItem(list, a, false);
    expect(list).toEqual([a]);
  });

  test('compares with the given function', () => {
    /**
     * Compare by ID.
     * @param {any} x One item.
     * @param {any} y Another item.
     * @returns {boolean} Result.
     */
    const isEqual = (x, y) => x.id === y.id;

    expect(toggleListItem([a], { id: 'a' }, true, isEqual)).toEqual([a]);
    expect(toggleListItem([a, b], { id: 'a' }, false, isEqual)).toEqual([b]);
  });
});

describe('splitIntoChunks()', () => {
  test('splits a list into chunks of the given size', () => {
    expect(splitIntoChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(splitIntoChunks([1, 2], 2)).toEqual([[1, 2]]);
    expect(splitIntoChunks([], 2)).toEqual([]);
  });
});

describe('splitIntoSizedChunks()', () => {
  /**
   * Get the size of a number item.
   * @param {number} n Item.
   * @returns {number} Size.
   */
  const getSize = (n) => n;

  test('closes a chunk at the item limit', () => {
    expect(splitIntoSizedChunks([1, 1, 1, 1, 1], { maxItems: 2, maxSize: 100, getSize })).toEqual([
      [1, 1],
      [1, 1],
      [1],
    ]);
  });

  test('closes a chunk before the item that would exceed the size limit', () => {
    expect(splitIntoSizedChunks([3, 4, 2, 5], { maxItems: 10, maxSize: 7, getSize })).toEqual([
      [3, 4],
      [2, 5],
    ]);
  });

  test('gives an item exceeding the size limit a chunk of its own', () => {
    expect(splitIntoSizedChunks([1, 20, 1], { maxItems: 10, maxSize: 5, getSize })).toEqual([
      [1],
      [20],
      [1],
    ]);
  });

  test('returns no chunks for an empty list', () => {
    expect(splitIntoSizedChunks([], { maxItems: 10, maxSize: 5, getSize })).toEqual([]);
  });
});
