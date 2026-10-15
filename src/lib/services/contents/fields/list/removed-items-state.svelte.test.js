// @ts-nocheck
import { describe, expect, test } from 'vitest';

import { createRemovedItemsState } from '$lib/services/contents/fields/list/removed-items-state.svelte';

/**
 * Create a removed item.
 * @param {string} id ID.
 * @param {number} index Index.
 * @returns {any} Removed item.
 */
const createItem = (id, index) => ({
  id,
  index,
  values: {},
  expanded: true,
  nestedExpanderStates: [],
});

/**
 * Create the state, with the locale and the item keys that can be changed.
 * @returns {{ context: { locale: string, keys: (string | number)[] }, state: any }} Result.
 */
const setup = () => {
  const context = { locale: 'en', keys: [0, 1, 2] };

  /* eslint-disable jsdoc/require-jsdoc */
  const state = createRemovedItemsState({
    getLocale: () => context.locale,
    getItemKeys: () => context.keys,
  });
  /* eslint-enable jsdoc/require-jsdoc */

  return { context, state };
};

describe('createRemovedItemsState()', () => {
  test('shows nothing until the list has been manipulated here', () => {
    const { state } = setup();

    state.add(createItem('a', 1));

    expect(state.shown).toEqual([]);
    expect(state.byIndex.size).toBe(0);
  });

  test('shows the removed items grouped by position while the list is as left', () => {
    const { state } = setup();

    state.add(createItem('a', 1));
    state.remember([1, 2, 3], 'en');
    state.add(createItem('b', 1));

    expect(state.shown.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(state.byIndex.get(1).map(({ id }) => id)).toEqual(['a', 'b']);
  });

  test('ignores the list of another locale', () => {
    const { state } = setup();

    state.add(createItem('a', 1));
    state.remember([1, 2, 3], 'fr');

    expect(state.shown).toEqual([]);
  });

  test('hides the removed items once the locale or the list changes', () => {
    const { context, state } = setup();

    state.add(createItem('a', 1));
    state.remember([1, 2, 3], 'en');
    context.keys = [0, 1];

    expect(state.shown).toEqual([]);

    context.keys = [0, 1, 2];

    expect(state.shown).toHaveLength(1);

    context.locale = 'fr';

    expect(state.shown).toEqual([]);
  });

  test('keys object items by their IDs', () => {
    const { context, state } = setup();

    context.keys = ['x', 'y'];
    state.add(createItem('a', 1));
    state.remember([{ __sc_item_id: 'x' }, { __sc_item_id: 'y' }], 'en');

    expect(state.shown).toHaveLength(1);
  });

  test('shifts, then drops the removed items', () => {
    const { state } = setup();

    state.add(createItem('a', 0));
    state.remember([1, 2, 3], 'en');
    state.add(createItem('b', 2));
    state.shift(0);

    expect(state.shown.map(({ index }) => index)).toEqual([0, 3]);

    state.drop('a');

    expect(state.shown.map(({ id, index }) => [id, index])).toEqual([['b', 4]]);
  });
});
