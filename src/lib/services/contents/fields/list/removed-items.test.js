import { describe, expect, test } from 'vitest';

import {
  addRemovedItem,
  dropRestoredItem,
  getNestedExpanderStates,
  shiftRemovedItems,
} from './removed-items';

/**
 * @import { RemovedListItem } from '$lib/types/private';
 */

/**
 * Create a removed item.
 * @param {string} id ID.
 * @param {number} index Position.
 * @returns {RemovedListItem} Removed item.
 */
const createItem = (id, index) => ({
  id,
  index,
  values: { _default: { name: id } },
  expanded: true,
  nestedExpanderStates: [],
});

/**
 * Get the ID and position of each removed item.
 * @param {RemovedListItem[]} items Removed items.
 * @returns {[string, number][]} IDs and positions.
 */
const summarize = (items) => items.map(({ id, index }) => [id, index]);

describe('Test addRemovedItem()', () => {
  test('adds the first removed item', () => {
    expect(summarize(addRemovedItem([], createItem('a', 2)))).toEqual([['a', 2]]);
  });

  test('puts the item after those in the same place and before the later ones', () => {
    const items = [createItem('a', 0), createItem('b', 1), createItem('c', 2)];

    // `c` was shown after the removed item, so it moves up along with the items after it
    expect(summarize(addRemovedItem(items, createItem('d', 1)))).toEqual([
      ['a', 0],
      ['b', 1],
      ['d', 1],
      ['c', 1],
    ]);
  });

  test('puts the item at the end if nothing is shown after it', () => {
    const items = [createItem('a', 0)];

    expect(summarize(addRemovedItem(items, createItem('b', 3)))).toEqual([
      ['a', 0],
      ['b', 3],
    ]);
  });

  test('doesn’t modify the given list', () => {
    const items = [createItem('a', 2)];

    addRemovedItem(items, createItem('b', 0));
    expect(summarize(items)).toEqual([['a', 2]]);
  });
});

describe('Test shiftRemovedItems()', () => {
  test('moves the removed items after a new item down', () => {
    const items = [createItem('a', 0), createItem('b', 1), createItem('c', 2)];

    expect(summarize(shiftRemovedItems(items, 1))).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 3],
    ]);
  });
});

describe('Test dropRestoredItem()', () => {
  test('removes the restored item and moves the ones after it down', () => {
    const items = [createItem('a', 1), createItem('b', 1), createItem('c', 2)];

    expect(summarize(dropRestoredItem(items, 'b'))).toEqual([
      ['a', 1],
      ['c', 3],
    ]);
  });

  test('ignores an unknown item', () => {
    const items = [createItem('a', 1)];

    expect(summarize(dropRestoredItem(items, 'x'))).toEqual([['a', 1]]);
  });
});

describe('Test getNestedExpanderStates()', () => {
  test('returns the states nested in the item', () => {
    const states = {
      'authors#': true,
      'authors.1': false,
      'authors.1.details#': false,
      'authors.1.books.0': true,
      'authors.10.details#': true,
      'authors.2.details#': true,
      'authors-extra.1.details#': true,
    };

    expect(getNestedExpanderStates(states, 'authors', 1)).toEqual([
      ['.details#', false],
      ['.books.0', true],
    ]);
  });
});
