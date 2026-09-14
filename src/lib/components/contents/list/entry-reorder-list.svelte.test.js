import { flushSync } from 'svelte';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import {
  reorderDirty,
  reorderedEntries,
  setReorderMode,
} from '$lib/services/contents/collection/view';
import { env } from '$lib/services/user/env.svelte';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import EntryReorderList from './entry-reorder-list.svelte';

describe('EntryReorderList', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          reorder: true,
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'order', widget: 'number' },
          ],
        },
      ],
    });
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    setEntries([
      createMockEntry({ slug: 'a', content: { _default: { title: 'A', order: 1 } } }),
      createMockEntry({ slug: 'b', content: { _default: { title: 'B', order: 2 } } }),
      createMockEntry({ slug: 'c', content: { _default: { title: 'C', order: 3 } } }),
    ]);
    selectedCollection.current = /** @type {any} */ (getCollection('posts'));
    setReorderMode(true);
    reorderDirty.current = false;
  });

  /**
   * Get the listed entry titles.
   * @returns {string[]} Titles.
   */
  const getTitles = () =>
    page
      .getByRole('row')
      .elements()
      .map((row) => row.querySelector('.title')?.textContent?.trim() ?? '');

  test('lists the entries in their stored order, and moves one with the buttons', async () => {
    await render(EntryReorderList, {
      collection: /** @type {any} */ (getCollection('posts')),
      viewType: 'list',
    });

    await expect.poll(getTitles).toEqual(['A', 'B', 'C']);
    expect(reorderedEntries.current.map(({ slug }) => slug)).toEqual(['a', 'b', 'c']);

    const rows = page.getByRole('row');

    // The first entry can only move down, the last only up
    await expect
      .element(rows.nth(0).getByRole('button', { name: 'Move Up' }))
      .toHaveAttribute('aria-disabled', 'true');
    await expect
      .element(rows.nth(2).getByRole('button', { name: 'Move Down' }))
      .toHaveAttribute('aria-disabled', 'true');

    await rows.nth(2).getByRole('button', { name: 'Move Up' }).click();

    await expect.poll(getTitles).toEqual(['A', 'C', 'B']);
    expect(reorderDirty.current).toBe(true);
    expect(reorderedEntries.current.map(({ slug }) => slug)).toEqual(['a', 'c', 'b']);
  });

  test('moves an entry down with the button', async () => {
    await render(EntryReorderList, {
      collection: /** @type {any} */ (getCollection('posts')),
      viewType: 'list',
    });

    await expect.poll(getTitles).toEqual(['A', 'B', 'C']);
    await page.getByRole('row').nth(0).getByRole('button', { name: 'Move Down' }).click();
    await expect.poll(getTitles).toEqual(['B', 'A', 'C']);
  });

  /**
   * Drag a row over another, then drop or cancel.
   * @param {Element} source Row being dragged.
   * @param {Element} target Row to drop on.
   * @param {object} [options] Options.
   * @param {boolean} [options.bottom] Whether to point at the bottom half of the target.
   * @param {boolean} [options.drop] Whether to drop, rather than cancelling the drag.
   * @returns {void}
   */
  const drag = (source, target, { bottom = true, drop = true } = {}) => {
    const dataTransfer = new DataTransfer();
    const rect = target.getBoundingClientRect();

    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    target.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientY: bottom ? rect.bottom - 1 : rect.top + 1,
      }),
    );

    if (drop) {
      target.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }),
      );
    }

    source.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
  };

  test('reorders the entries by dragging, previewing the move', async () => {
    await render(EntryReorderList, {
      collection: /** @type {any} */ (getCollection('posts')),
      viewType: 'list',
    });

    await expect.poll(getTitles).toEqual(['A', 'B', 'C']);

    const rows = page.getByRole('row').elements();

    drag(rows[0], rows[2]);
    await expect.poll(getTitles).toEqual(['B', 'C', 'A']);
    expect(reorderDirty.current).toBe(true);
  });

  test('puts the entries back when the drag is cancelled or dropped elsewhere', async () => {
    await render(EntryReorderList, {
      collection: /** @type {any} */ (getCollection('posts')),
      viewType: 'list',
    });

    await expect.poll(getTitles).toEqual(['A', 'B', 'C']);

    const rows = page.getByRole('row').elements();

    drag(rows[2], rows[0], { bottom: false, drop: false });
    await expect.poll(getTitles).toEqual(['A', 'B', 'C']);
    expect(reorderDirty.current).toBe(false);

    // Dropping where the drag started changes nothing either
    drag(rows[0], rows[0], { bottom: false });
    await expect.poll(getTitles).toEqual(['A', 'B', 'C']);
    expect(reorderDirty.current).toBe(false);
  });

  test('rejects a drop coming from outside the list', async () => {
    await render(EntryReorderList, {
      collection: /** @type {any} */ (getCollection('posts')),
      viewType: 'list',
    });

    await expect.poll(getTitles).toEqual(['A', 'B', 'C']);

    const [row] = page.getByRole('row').elements();
    const dataTransfer = new DataTransfer();
    const event = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer });

    row.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);

    row.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    await expect.poll(getTitles).toEqual(['A', 'B', 'C']);
  });

  test('drags without a data transfer', async () => {
    await render(EntryReorderList, {
      collection: /** @type {any} */ (getCollection('posts')),
      viewType: 'list',
    });

    await expect.poll(getTitles).toEqual(['A', 'B', 'C']);

    const [source, target] = page.getByRole('row').elements();
    const rect = target.getBoundingClientRect();

    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
    target.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.bottom - 1 }),
    );
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    await expect.poll(getTitles).toEqual(['B', 'A', 'C']);
    expect(reorderDirty.current).toBe(true);
  });

  test('keeps listing an entry that has gone from the collection', async () => {
    await render(EntryReorderList, {
      collection: /** @type {any} */ (getCollection('posts')),
      viewType: 'list',
    });

    await expect.poll(getTitles).toEqual(['A', 'B', 'C']);

    const rows = page.getByRole('row');

    await expect.element(rows.nth(2)).toHaveAttribute('aria-rowindex', '2');
    // The list is snapshotted when entering reorder mode, so a background update doesn’t change it
    setEntries([
      createMockEntry({ slug: 'a', content: { _default: { title: 'A', order: 1 } } }),
      createMockEntry({ slug: 'b', content: { _default: { title: 'B', order: 2 } } }),
    ]);
    await expect.element(rows.nth(2)).toHaveAttribute('aria-rowindex', '-1');
    expect(getTitles()).toEqual(['A', 'B', 'C']);
  });

  test('lists the entries group by group', async () => {
    await initTestConfig({
      collections: [
        {
          name: 'grouped',
          folder: 'content/grouped',
          reorder: { group: 'category' },
          view_groups: [{ name: 'category', label: 'Category', field: 'category' }],
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'category', widget: 'string' },
            { name: 'order', widget: 'number' },
          ],
        },
      ],
    });

    try {
      setEntries([
        createMockEntry({
          slug: 'a',
          folder: 'content/grouped',
          content: { _default: { title: 'A', category: 'News', order: 1 } },
        }),
        createMockEntry({
          slug: 'b',
          folder: 'content/grouped',
          content: { _default: { title: 'B', category: 'Events', order: 2 } },
        }),
      ]);
      selectedCollection.current = /** @type {any} */ (getCollection('grouped'));
      // Let the view be restored for the collection before reorder mode adjusts it
      flushSync();
      setReorderMode(true);

      await render(EntryReorderList, {
        collection: /** @type {any} */ (getCollection('grouped')),
        viewType: 'list',
      });

      await expect.element(page.getByRole('rowgroup', { name: 'News' })).toBeVisible();
      await expect.element(page.getByRole('rowgroup', { name: 'Events' })).toBeVisible();
    } finally {
      await initTestConfig({
        collections: [
          {
            name: 'posts',
            folder: 'content/posts',
            reorder: true,
            fields: [
              { name: 'title', widget: 'string' },
              { name: 'order', widget: 'number' },
            ],
          },
        ],
      });
    }
  });

  test('leaves the index file out', async () => {
    await initTestConfig({
      collections: [
        {
          name: 'pages',
          folder: 'content/pages',
          reorder: true,
          index_file: true,
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'order', widget: 'number' },
          ],
        },
      ],
    });

    try {
      setEntries([
        createMockEntry({
          slug: '_index',
          folder: 'content/pages',
          content: { _default: { title: 'Home', order: 0 } },
        }),
        createMockEntry({
          slug: 'about',
          folder: 'content/pages',
          content: { _default: { title: 'About', order: 1 } },
        }),
      ]);
      selectedCollection.current = /** @type {any} */ (getCollection('pages'));
      setReorderMode(true);

      await render(EntryReorderList, {
        collection: /** @type {any} */ (getCollection('pages')),
        viewType: 'list',
      });

      await expect.poll(getTitles).toEqual(['About']);
    } finally {
      await initTestConfig({
        collections: [
          {
            name: 'posts',
            folder: 'content/posts',
            reorder: true,
            fields: [
              { name: 'title', widget: 'string' },
              { name: 'order', widget: 'number' },
            ],
          },
        ],
      });
    }
  });
});
