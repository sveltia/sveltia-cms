// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';

import {
  createValueMap,
  getSubtreeVersion,
  getValueMapVersion,
} from '$lib/services/contents/draft/create/versioned-map.svelte';
import { createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * Wait for the pending effects to run.
 * @returns {Promise<void>} Promise.
 */
const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

describe('contents/draft/create/versioned-map', () => {
  test('counts the writes and deletions as the version of the map', () => {
    const valueMap = createValueMap({ title: 'A' });

    expect(getValueMapVersion(valueMap)).toBe(0);

    valueMap.title = 'B';
    // Writing the same value again isn’t a change
    valueMap.title = 'B';
    expect(valueMap.title).toBe('B');
    expect(getValueMapVersion(valueMap)).toBe(1);

    delete valueMap.title;
    // Nor is deleting a key that isn’t there
    delete valueMap.missing;
    expect(getValueMapVersion(valueMap)).toBe(2);
    expect(getValueMapVersion({})).toBeUndefined();
  });

  test('calls the hooks after a write or a deletion', () => {
    const onSet = vi.fn();
    const onDelete = vi.fn();
    const valueMap = createValueMap({ title: 'A' }, { onSet, onDelete });

    valueMap.title = 'B';
    delete valueMap.title;

    expect(onSet).toHaveBeenCalledWith(expect.any(Object), 'title', 'B');
    expect(onDelete).toHaveBeenCalledWith(expect.any(Object), 'title');
  });

  test('lists the keys in the order they were last written in', () => {
    const valueMap = createValueMap({ a: 1, b: 2 });

    delete valueMap.a;
    valueMap.a = 3;

    expect(Object.keys(valueMap)).toEqual(['b', 'a']);
  });

  test('makes an effect depend on a subtree only', async () => {
    const valueMap = createValueMap({
      title: 'Page',
      'items.0.name': 'A',
      'items.1.name': 'B',
    });

    const runs = { items: 0, item: 0, title: 0 };

    const cleanup = createRootEffect(() => {
      getSubtreeVersion(valueMap, 'items');
      runs.items += 1;
    });

    const cleanup2 = createRootEffect(() => {
      getSubtreeVersion(valueMap, 'items.0');
      runs.item += 1;
    });

    const cleanup3 = createRootEffect(() => {
      getSubtreeVersion(valueMap, 'title');
      runs.title += 1;
    });

    await settle();
    expect(runs).toEqual({ items: 1, item: 1, title: 1 });

    // A change below a key path updates it and the key paths above it
    valueMap['items.0.name'] = 'C';
    await settle();
    expect(runs).toEqual({ items: 2, item: 2, title: 1 });

    // But not the other subtrees
    valueMap['items.1.name'] = 'D';
    await settle();
    expect(runs).toEqual({ items: 3, item: 2, title: 1 });

    // A key path added later counts as well, and so does a deletion
    valueMap['items.2.name'] = 'E';
    delete valueMap['items.0.name'];
    await settle();
    expect(runs).toEqual({ items: 4, item: 3, title: 1 });

    valueMap.title = 'Page 2';
    await settle();
    expect(runs).toEqual({ items: 4, item: 3, title: 2 });

    cleanup();
    cleanup2();
    cleanup3();
  });

  test('stands in the version of the whole map for a key path without a value', async () => {
    const valueMap = createValueMap({ title: 'Page' });
    let runs = 0;

    const cleanup = createRootEffect(() => {
      getSubtreeVersion(valueMap, 'tags');
      runs += 1;
    });

    await settle();
    expect(getSubtreeVersion(valueMap, 'tags')).toBe(0);

    // Any change updates it, as there is no subtree version to depend on yet
    valueMap.title = 'Page 2';
    await settle();
    expect(runs).toBe(2);
    expect(getSubtreeVersion({}, 'tags')).toBeUndefined();

    cleanup();
  });
});
