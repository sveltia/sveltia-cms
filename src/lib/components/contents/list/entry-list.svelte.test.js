import { flushSync } from 'svelte';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { setReorderMode } from '$lib/services/contents/collection/view';
import { entryListSettings } from '$lib/services/contents/collection/view/settings';
import { env } from '$lib/services/user/env.svelte';
import { unpublishedEntries } from '$lib/services/workflow';
import { createMockEntry, initTestConfig, setEntries, TEST_IMAGE_URL } from '$lib/test/config';

import EntryList from './entry-list.svelte';

describe('EntryList', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          thumbnail: 'image',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'category', widget: 'string' },
            { name: 'image', widget: 'image' },
          ],
          view_filters: [{ label: 'Nothing', field: 'title', pattern: 'nothing' }],
        },
      ],
    });
  });

  /**
   * Select the collection, with the given saved view. The view is restored from the settings when
   * the collection is selected.
   * @param {any} [view] View settings.
   */
  const selectCollection = (view = { type: 'list' }) => {
    entryListSettings.current = { posts: view };
    selectedCollection.current = getCollection('posts');
  };

  beforeEach(() => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    selectedCollection.current = undefined;
    unpublishedEntries.current = [];
    setReorderMode(false);
    window.location.hash = '#/collections/posts';
  });

  test('lists the entries of the selected collection', async () => {
    setEntries([
      createMockEntry({
        slug: 'hello',
        content: { _default: { title: 'Hello', image: TEST_IMAGE_URL } },
      }),
      createMockEntry({ slug: 'world', content: { _default: { title: 'World' } } }),
      // An entry stored in another locale only is listed as well
      createMockEntry({ slug: 'bonjour', content: { fr: { title: 'Bonjour' } } }),
    ]);
    selectCollection();

    await render(EntryList, {});

    const grid = page.getByRole('grid', { name: 'Entries' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '3');
    await expect.poll(() => grid.getByRole('row').elements().length).toBe(3);
    expect(
      grid
        .getByRole('row')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Bonjour', 'Hello', 'World']);

    // The thumbnail is shown in the view’s size
    await expect
      .poll(() => grid.element().querySelector('.image img')?.getAttribute('src'))
      .toBe(TEST_IMAGE_URL);
    expect(grid.element().querySelector('.image .preview')).toHaveClass('icon');

    await grid.getByRole('row', { name: 'World' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/world');
  });

  test('lists the unpublished entries ahead of the published ones', async () => {
    setEntries([createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } })]);
    unpublishedEntries.current = [
      /** @type {any} */ ({
        ...createMockEntry({
          slug: 'draft',
          content: { _default: { title: 'Draft', image: TEST_IMAGE_URL } },
        }),
        workflow: {
          status: 'draft',
          collectionName: 'posts',
          pullRequest: { number: 1, branch: 'cms/posts/draft' },
        },
      }),
    ];
    selectCollection();

    await render(EntryList, {});

    const grid = page.getByRole('grid', { name: 'Entries' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '2');
    await expect.poll(() => grid.getByRole('row').elements().length).toBe(2);
    await expect
      .poll(() =>
        grid
          .getByRole('columnheader')
          .elements()
          .map((el) => el.textContent?.trim()),
      )
      .toEqual(['Unpublished Entries', 'Published Entries']);
    await expect
      .poll(() => grid.element().querySelector('.image img')?.getAttribute('src'))
      .toBe(TEST_IMAGE_URL);
  });

  test('shows the reorder list while reordering', async () => {
    await initTestConfig({
      collections: [
        {
          name: 'sorted',
          label: 'Sorted',
          folder: 'content/sorted',
          reorder: true,
          thumbnail: 'image',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'order', widget: 'number' },
            { name: 'image', widget: 'image' },
          ],
        },
      ],
    });

    try {
      setEntries([
        createMockEntry({
          slug: 'a',
          folder: 'content/sorted',
          content: { _default: { title: 'A', order: 1, image: TEST_IMAGE_URL } },
        }),
      ]);
      entryListSettings.current = { sorted: { type: 'grid' } };
      selectedCollection.current = getCollection('sorted');
      // Selecting a collection leaves the reorder mode, so enter it once that has settled
      flushSync();
      setReorderMode(true);

      await render(EntryList, {});

      // The reorder list is always a list
      const grid = page.getByRole('grid', { name: 'Entries' });

      await expect.element(grid).not.toHaveClass('grid-view');
      await expect.element(grid.getByRole('button', { name: 'Move Up' })).toBeInTheDocument();
      await expect
        .poll(() => grid.element().querySelector('.image img')?.getAttribute('src'))
        .toBe(TEST_IMAGE_URL);
    } finally {
      setReorderMode(false);
      await initTestConfig({
        collections: [
          {
            name: 'posts',
            label: 'Posts',
            folder: 'content/posts',
            fields: [
              { name: 'title', widget: 'string' },
              { name: 'category', widget: 'string' },
            ],
            view_filters: [{ label: 'Nothing', field: 'title', pattern: 'nothing' }],
          },
        ],
      });
    }
  });

  test('groups the entries as configured in the view', async () => {
    setEntries([
      createMockEntry({ slug: 'a', content: { _default: { title: 'A', category: 'news' } } }),
      createMockEntry({ slug: 'b', content: { _default: { title: 'B', category: 'blog' } } }),
    ]);
    selectCollection({ type: 'grid', group: { field: 'category' } });

    const { container } = await render(EntryList, {});

    await expect.poll(() => container.querySelectorAll('[role="rowgroup"]').length).toBe(2);
    expect(container.querySelector('.grid-view')).not.toBeNull();
    expect(
      [...container.querySelectorAll('[role="columnheader"]')].map((header) =>
        header.textContent?.trim(),
      ),
    ).toEqual(['blog', 'news']);
  });

  test('offers to create an entry when there is none', async () => {
    setEntries([]);
    selectCollection();

    await render(EntryList, {});

    await expect.element(page.getByText('This collection has no entries yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Create New Entry' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/new');
  });

  test('reports when the filter matches nothing', async () => {
    setEntries([createMockEntry({ slug: 'a', content: { _default: { title: 'A' } } })]);
    selectCollection({ type: 'list', filters: [{ field: 'title', pattern: 'nothing' }] });

    await render(EntryList, {});
    await expect.element(page.getByText('No entries found.')).toBeVisible();
  });

  test('reports a missing collection', async () => {
    selectedCollection.current = undefined;

    await render(EntryList, {});
    await expect.element(page.getByText('Collection not found.')).toBeVisible();
  });
});
