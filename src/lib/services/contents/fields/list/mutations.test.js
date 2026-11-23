import { describe, expect, test } from 'vitest';

import {
  insertListItem,
  moveListItem,
  removeListItem,
  restoreListItem,
} from '$lib/services/contents/fields/list/mutations';

/**
 * Create a list of object items and their expander states.
 * @returns {{ valueList: any[], expanderStateList: boolean[] }} Target.
 */
const createTarget = () => ({
  valueList: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
  expanderStateList: [true, false, true],
});

describe('insertListItem()', () => {
  test('inserts an expanded item at the index', () => {
    const target = createTarget();

    insertListItem(target, { index: 1, item: { title: 'new' } });
    expect(target.valueList.map(({ title }) => title)).toEqual(['a', 'new', 'b', 'c']);
    expect(target.expanderStateList).toEqual([true, true, false, true]);
  });

  test('replaces the item at the index', () => {
    const target = createTarget();

    insertListItem(target, { index: 1, item: { title: 'new' }, replace: true });
    expect(target.valueList.map(({ title }) => title)).toEqual(['a', 'new', 'c']);
    expect(target.expanderStateList).toEqual([true, true, true]);
  });
});

describe('removeListItem()', () => {
  test('removes the item and returns it, tagging the others', () => {
    const target = createTarget();
    const removed = removeListItem(target, { index: 1, keyPath: 'list', tagItems: true });

    expect(removed.title).toBe('b');
    expect(target.valueList.map(({ title }) => title)).toEqual(['a', 'c']);
    expect(target.expanderStateList).toEqual([true, true]);
    expect(target.valueList[1].__sc_item_id).toEqual(expect.any(String));
  });

  test('leaves primitive items untagged and returns nothing for a missing index', () => {
    const target = { valueList: ['a', 'b'], expanderStateList: [] };

    expect(removeListItem(target, { index: 5, keyPath: 'list', tagItems: false })).toBeUndefined();
    expect(removeListItem(target, { index: 0, keyPath: 'list', tagItems: false })).toBe('a');
    expect(target.valueList).toEqual(['b']);
  });
});

describe('restoreListItem()', () => {
  test('puts the item back with its expander state', () => {
    const target = createTarget();

    restoreListItem(target, {
      index: 0,
      item: { title: 'z' },
      expanded: false,
      keyPath: 'list',
      tagItems: true,
    });
    expect(target.valueList.map(({ title }) => title)).toEqual(['z', 'a', 'b', 'c']);
    expect(target.expanderStateList).toEqual([false, true, false, true]);
  });

  test('leaves primitive items untagged', () => {
    const target = { valueList: ['b'], expanderStateList: [] };

    restoreListItem(target, {
      index: 0,
      item: 'a',
      expanded: true,
      keyPath: 'list',
      tagItems: false,
    });
    expect(target.valueList).toEqual(['a', 'b']);
  });
});

describe('moveListItem()', () => {
  test('moves the item and its expander state', () => {
    const target = createTarget();

    moveListItem(target, { from: 0, to: 2, keyPath: 'list', tagItems: true });
    expect(target.valueList.map(({ title }) => title)).toEqual(['b', 'c', 'a']);
    expect(target.expanderStateList).toEqual([false, true, true]);
  });

  test('moves a primitive item with no expander states', () => {
    const target = { valueList: ['a', 'b'], expanderStateList: [] };

    moveListItem(target, { from: 1, to: 0, keyPath: 'list', tagItems: false });
    expect(target.valueList).toEqual(['b', 'a']);
    expect(target.expanderStateList).toEqual([]);
  });
});
