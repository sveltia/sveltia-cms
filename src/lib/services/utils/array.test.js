import { describe, expect, test } from 'vitest';

import { splitIntoChunks, toggleListItem } from '$lib/services/utils/array';

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
