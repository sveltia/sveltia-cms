import { flushSync } from 'svelte';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { OTHER_GROUP_NAME } from '$lib/services/common/view';
import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { setBulkEditMode, setReorderMode } from '$lib/services/contents/collection/view';
import { currentView, entryListSettings } from '$lib/services/contents/collection/view/settings';
import { env } from '$lib/services/user/env.svelte';
import { unpublishedEntries } from '$lib/services/workflow';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockEntry, initTestConfig, setEntries, TEST_IMAGE_URL } from '$lib/test/config';

import EntryList from './entry-list.svelte';

/**
 * Configuration of the collection the tests list the entries of.
 */
const POSTS = {
  name: 'posts',
  label: 'Posts',
  folder: 'content/posts',
  thumbnail: 'image',
  // The columns of the table view
  summary_fields: ['summary', 'category'],
  fields: [
    { name: 'title', label: 'Title', widget: 'string' },
    { name: 'category', label: 'Category', widget: 'string' },
    { name: 'image', widget: 'image' },
  ],
  view_filters: [{ label: 'Nothing', field: 'title', pattern: 'nothing' }],
  // A saved group is only restored while it’s still configured
  view_groups: [{ label: 'Category', field: 'category' }],
};

/**
 * Configuration of a collection without the table view columns configured.
 */
const NOTES = {
  name: 'notes',
  label: 'Notes',
  folder: 'content/notes',
  fields: [{ name: 'title', label: 'Title', widget: 'string' }],
};

describe('EntryList', () => {
  beforeAll(async () => {
    await initTestConfig({ collections: [structuredClone(POSTS), structuredClone(NOTES)] });
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
    env.isLargeScreen = true;
    forkedRepository.current = undefined;
    selectedCollection.current = undefined;
    unpublishedEntries.current = [];
    setReorderMode(false);
    setBulkEditMode(false);
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
    // The French entry has no title in the default locale to sort by, so it comes last
    expect(
      grid
        .getByRole('row')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Hello', 'World', 'Bonjour']);

    // The thumbnail is shown in the view’s size
    await expect
      .poll(() => grid.element().querySelector('.image img')?.getAttribute('src'))
      .toBe(TEST_IMAGE_URL);
    expect(grid.element().querySelector('.image .preview')).toHaveClass('icon');

    await grid.getByRole('row', { name: 'World' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/world');
  });

  test('shows the entries in a table with a header row in the table view', async () => {
    setEntries([
      createMockEntry({
        slug: 'hello',
        content: { _default: { title: 'Hello', category: 'news', image: TEST_IMAGE_URL } },
      }),
      createMockEntry({ slug: 'world', content: { _default: { title: 'World' } } }),
    ]);
    // The table view is the default
    selectCollection({ sort: { key: 'title', order: 'ascending' } });

    const { container } = await render(EntryList, {});
    const grid = page.getByRole('grid', { name: 'Entries' });

    // The header row is counted
    await expect.element(grid).toHaveAttribute('aria-rowcount', '3');
    expect(container.querySelector('.table-view')).not.toBeNull();
    await expect.poll(() => grid.getByRole('row').elements().length).toBe(3);
    await expect.element(grid.getByRole('row').first()).toHaveAttribute('aria-rowindex', '1');

    // A header for the checkbox, the image, each column and the status
    const headers = grid.getByRole('columnheader');

    await expect.poll(() => headers.elements().length).toBe(5);
    await expect
      .element(grid.getByRole('columnheader', { name: 'Title' }))
      .toHaveAttribute('aria-sort', 'ascending');
    // The category isn’t a sort key
    expect(
      grid.getByRole('columnheader', { name: 'Category' }).getByRole('button').elements(),
    ).toHaveLength(0);

    // Each row has a cell for each column
    await expect
      .poll(() => container.querySelector('[data-key="category"]')?.textContent?.trim())
      .toBe('news');
    expect(grid.element().querySelector('.image .preview')).toHaveClass('icon');

    // The header sorts the entries
    await grid.getByRole('columnheader', { name: 'Title' }).getByRole('button').click();
    await expect
      .poll(() => currentView.current.sort)
      .toEqual({ key: 'title', order: 'descending' });
    await expect
      .poll(() =>
        grid
          .getByRole('row')
          .elements()
          .slice(1)
          .map((el) => el.querySelector('.title')?.textContent?.trim()),
      )
      .toEqual(['World', 'Hello']);
    // The data rows come after the header row
    expect(
      grid
        .getByRole('row')
        .elements()
        .slice(1)
        .map((el) => el.getAttribute('aria-rowindex'))
        .sort(),
    ).toEqual(['2', '3']);
  });

  test('renders the rows of the table view in the same update as a sort', async () => {
    setEntries([
      createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } }),
      createMockEntry({ slug: 'world', content: { _default: { title: 'World' } } }),
    ]);
    selectCollection({ sort: { key: 'title', order: 'ascending' } });

    await render(EntryList, {});

    const grid = page.getByRole('grid', { name: 'Entries' });

    await expect.poll(() => grid.getByRole('row').elements().length).toBe(3);

    // Without the rows for a moment, the table’s columns, sized to fit the cells, would collapse
    currentView.current = { ...currentView.current, sort: { key: 'title', order: 'descending' } };
    flushSync();

    expect(
      grid
        .getByRole('row')
        .elements()
        .slice(1)
        .map((el) => el.querySelector('.title')?.textContent?.trim()),
    ).toEqual(['World', 'Hello']);
  });

  test('keeps the rendered groups when the view is switched', async () => {
    setEntries([
      createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } }),
      createMockEntry({ slug: 'world', content: { _default: { title: 'World' } } }),
    ]);
    selectCollection({ sort: { key: 'title', order: 'ascending' } });

    const { container } = await render(EntryList, {});

    await expect.poll(() => container.querySelectorAll('.grid-body').length).toBe(1);

    const body = container.querySelector('.grid-body');

    // Rendering the groups anew would load their rows from the first chunk again
    currentView.current = { ...currentView.current, type: 'list' };
    flushSync();
    expect(container.querySelector('.list-view')).not.toBeNull();
    expect(container.querySelector('.grid-body')).toBe(body);

    currentView.current = { ...currentView.current, type: 'table' };
    flushSync();
    expect(container.querySelector('.table-view')).not.toBeNull();
    expect(container.querySelector('.grid-body')).toBe(body);
  });

  test('leaves out the checkbox header from an Open Authoring contributor', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    try {
      setEntries([createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } })]);
      selectCollection({ type: 'table' });

      const { container } = await render(EntryList, {});

      await expect.poll(() => container.querySelector('[role="columnheader"]')).not.toBeNull();
      expect(container.querySelector('[role="columnheader"].checkbox')).toBeNull();
      expect(container.querySelector('[role="gridcell"].checkbox')).toBeNull();
    } finally {
      forkedRepository.current = undefined;
    }
  });

  test('shows the list view by default without the table columns configured', async () => {
    setEntries([
      createMockEntry({
        slug: 'hello',
        folder: 'content/notes',
        content: { _default: { title: 'Hello' } },
      }),
    ]);
    entryListSettings.current = {};
    selectedCollection.current = getCollection('notes');

    const { container } = await render(EntryList, {});
    const grid = page.getByRole('grid', { name: 'Entries' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '1');
    expect(container.querySelector('.list-view')).not.toBeNull();
    expect(container.querySelector('.table-view')).toBeNull();
    expect(grid.getByRole('columnheader').elements()).toHaveLength(0);

    // A table view saved before the columns were removed from the configuration isn’t offered
    currentView.current = { ...currentView.current, type: 'table' };
    flushSync();
    expect(container.querySelector('.list-view')).not.toBeNull();
    expect(container.querySelector('.table-view')).toBeNull();
  });

  test('shows the table view as a list on a smaller screen', async () => {
    env.isLargeScreen = false;
    setEntries([createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } })]);
    selectCollection({ type: 'table' });

    const { container } = await render(EntryList, {});
    const grid = page.getByRole('grid', { name: 'Entries' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '1');
    expect(container.querySelector('.list-view')).not.toBeNull();
    await expect.poll(() => grid.getByRole('row').elements().length).toBe(1);
    expect(grid.getByRole('columnheader').elements()).toHaveLength(0);
    expect(container.querySelector('.title')).toHaveTextContent('Hello');
    expect(container.querySelector('.column')).toBeNull();
  });

  test('starts again from the top when the entries are sorted differently', async () => {
    setEntries(
      Array.from({ length: 80 }, (_, index) =>
        createMockEntry({
          slug: `post-${index}`,
          content: { _default: { title: `Post ${String(index).padStart(2, '0')}` } },
        }),
      ),
    );
    selectCollection({ type: 'list', sort: { key: 'title', order: 'ascending' } });

    // A short list container, so the rows are loaded a chunk at a time as it’s scrolled
    const target = document.createElement('div');

    // In view, as the rows are loaded once the end of the list is visible in the viewport
    Object.assign(target.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '600px',
      height: '300px',
      display: 'flex',
    });
    document.body.appendChild(target);

    try {
      await render(EntryList, { target });

      const grid = page.getByRole('grid', { name: 'Entries' });

      await expect.poll(() => grid.getByRole('row').elements().length).toBe(25);

      // The view around the grid is what scrolls
      const container = /** @type {HTMLElement} */ (grid.element().closest('.list-view'));

      // Scroll to the end until every row is loaded. The jump is instant: with the smooth scrolling
      // Sveltia UI gives every element, Chrome would finish the last scroll after the list has been
      // scrolled back to the top below, moving it down again
      await expect
        .poll(() => {
          container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });

          return grid.getByRole('row').elements().length;
        })
        .toBe(80);

      currentView.current = { ...currentView.current, sort: { key: 'title', order: 'descending' } };

      // The first chunk of the new order is shown from the top, rather than every row loaded so far
      await expect
        .poll(() => grid.getByRole('row').elements()[0]?.textContent?.trim())
        .toBe('Post 79');
      expect(grid.getByRole('row').elements()).toHaveLength(25);
      expect(container.scrollTop).toBe(0);
    } finally {
      target.remove();
    }
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
      await initTestConfig({ collections: [structuredClone(POSTS)] });
    }
  });

  test('shows the bulk editor while bulk editing', async () => {
    setEntries([
      createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } }),
      createMockEntry({ slug: 'world', content: { _default: { title: 'World' } } }),
    ]);
    selectCollection();
    // Selecting a collection leaves the bulk edit mode, so enter it once that has settled
    flushSync();
    setBulkEditMode(true);

    await render(EntryList, {});

    const table = page.getByRole('table', { name: 'Bulk Editor' });

    await expect.element(table).toHaveAttribute('aria-rowcount', '3');
    expect(page.getByRole('grid').elements()).toHaveLength(0);
    await expect
      .poll(() =>
        table
          .getByRole('rowheader')
          .elements()
          .map((el) => el.textContent?.trim()),
      )
      .toEqual(['Hello', 'World']);

    // Leaving the mode brings the entry list back
    setBulkEditMode(false);
    await expect.element(page.getByRole('grid', { name: 'Entries' })).toBeVisible();
    expect(page.getByRole('table').elements()).toHaveLength(0);
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
    // Each group has an expander in the caption
    expect(
      [...container.querySelectorAll('[role="columnheader"] button[aria-expanded]')].map((button) =>
        button.querySelector('.label')?.textContent?.trim(),
      ),
    ).toEqual(['blog', 'news']);
  });

  test('collapses and expands a group, remembering the state in the view', async () => {
    setEntries([
      createMockEntry({ slug: 'a', content: { _default: { title: 'A', category: 'news' } } }),
      createMockEntry({ slug: 'b', content: { _default: { title: 'B', category: 'blog' } } }),
      createMockEntry({ slug: 'c', content: { _default: { title: 'C' } } }),
    ]);
    selectCollection({
      type: 'list',
      group: { field: 'category' },
      collapsedGroups: { '["category"]': ['news'] },
    });

    await render(EntryList, {});

    const grid = page.getByRole('grid', { name: 'Entries' });
    const blog = grid.getByRole('button', { name: 'blog' });
    const news = grid.getByRole('button', { name: 'news' });
    // The entry without a category is in the Other group, shown with its localized label
    const other = grid.getByRole('button', { name: 'Other' });

    // The saved state is restored
    await expect.element(blog).toHaveAttribute('aria-expanded', 'true');
    await expect.element(news).toHaveAttribute('aria-expanded', 'false');
    await expect.element(other).toHaveAttribute('aria-expanded', 'true');
    await expect.element(grid.getByRole('row', { name: 'B' })).toBeInTheDocument();
    await expect.element(grid.getByRole('row', { name: 'C' })).toBeInTheDocument();
    expect(grid.getByRole('row', { name: 'A' }).elements()).toHaveLength(0);

    await blog.click();
    await expect.element(blog).toHaveAttribute('aria-expanded', 'false');
    expect(grid.getByRole('row', { name: 'B' }).elements()).toHaveLength(0);
    expect(currentView.current.collapsedGroups).toEqual({ '["category"]': ['news', 'blog'] });

    await news.click();
    await expect.element(news).toHaveAttribute('aria-expanded', 'true');
    await expect.element(grid.getByRole('row', { name: 'A' })).toBeInTheDocument();
    expect(currentView.current.collapsedGroups).toEqual({ '["category"]': ['blog'] });

    // The Other group is saved under its stable name rather than the label
    await other.click();
    await expect.element(other).toHaveAttribute('aria-expanded', 'false');
    expect(grid.getByRole('row', { name: 'C' }).elements()).toHaveLength(0);
    expect(currentView.current.collapsedGroups).toEqual({
      '["category"]': ['blog', OTHER_GROUP_NAME],
    });
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
