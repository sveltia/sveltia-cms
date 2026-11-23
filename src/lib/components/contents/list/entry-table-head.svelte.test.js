import { flushSync } from 'svelte';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { currentView } from '$lib/services/contents/collection/view/settings';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import EntryTableHead from './entry-table-head.svelte';

describe('EntryTableHead', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          thumbnail: 'image',
          sortable_fields: ['title', 'date'],
          fields: [
            { name: 'title', label: 'Title', widget: 'string' },
            { name: 'date', label: 'Date', widget: 'datetime' },
            { name: 'draft', label: 'Draft', widget: 'boolean' },
            { name: 'image', widget: 'image' },
          ],
        },
        {
          name: 'notes',
          folder: 'content/notes',
          summary: '{{title}} ({{date}})',
          sortable_fields: ['date'],
          fields: [
            { name: 'title', label: 'Title', widget: 'string' },
            { name: 'date', label: 'Date', widget: 'datetime' },
          ],
        },
        {
          name: 'events',
          folder: 'content/events',
          sortable_fields: ['date'],
          fields: [
            { name: 'title', label: 'Title', widget: 'string' },
            { name: 'date', label: 'Date', widget: 'datetime' },
          ],
        },
      ],
    });
  });

  /**
   * Select a collection, and set the view once the effect restoring the saved one has run.
   * @param {string} name Collection name.
   * @param {any} [sort] Sort conditions.
   * @returns {any} Collection.
   */
  const selectCollection = (name, sort) => {
    const collection = getCollection(name);

    selectedCollection.current = collection;
    flushSync();
    currentView.current = { type: 'table', sort };

    return collection;
  };

  /**
   * Get the text of each column header, leaving out the sort icon’s name.
   * @returns {(string | undefined)[]} Header text.
   */
  const getHeaderText = () =>
    page
      .getByRole('columnheader')
      .elements()
      .map((el) => {
        const clone = /** @type {Element} */ (el.cloneNode(true));

        clone.querySelectorAll('.icon').forEach((icon) => icon.remove());

        return clone.textContent?.trim();
      });

  beforeEach(() => {
    setEntries([
      createMockEntry({ slug: 'a', content: { _default: { title: 'A' } } }),
      createMockEntry({
        slug: 'b',
        folder: 'content/notes',
        content: { _default: { title: 'B' } },
      }),
    ]);
  });

  test('renders a header for the checkbox, image, each column and the status', async () => {
    const collection = selectCollection('posts');

    const { container } = await render(EntryTableHead, {
      collection,
      columns: [
        { key: '_summary', label: 'Title' },
        { key: 'date', label: 'Date' },
        { key: 'draft', label: 'Draft' },
      ],
      showCheckbox: true,
    });

    await expect.element(page.getByRole('row')).toHaveAttribute('aria-rowindex', '1');
    expect(getHeaderText()).toEqual(['', '', 'Title', 'Date', 'Draft', '']);
    expect(
      [...container.querySelectorAll('[role="columnheader"]')].map((el) =>
        ['checkbox', 'image', 'title', 'column', 'status'].find((name) =>
          el.classList.contains(name),
        ),
      ),
    ).toEqual(['checkbox', 'image', 'title', 'column', 'column', 'status']);
  });

  test('leaves out the checkbox and image headers when the rows have no such cells', async () => {
    const collection = selectCollection('notes');

    await render(EntryTableHead, {
      collection,
      columns: [{ key: '_summary', label: 'Summary' }],
      showCheckbox: false,
    });

    await expect.element(page.getByRole('row')).toBeInTheDocument();
    expect(getHeaderText()).toEqual(['Summary', '']);
  });

  test('sorts the entries by a column that can be sorted', async () => {
    const collection = selectCollection('posts', { key: 'title', order: 'ascending' });

    await render(EntryTableHead, {
      collection,
      columns: [
        { key: '_summary', label: 'Title' },
        { key: 'date', label: 'Date' },
        { key: 'draft', label: 'Draft' },
      ],
      showCheckbox: true,
    });

    // Without a summary template, the summary column sorts by the identifier field
    const title = page.getByRole('columnheader', { name: 'Title' });
    const date = page.getByRole('columnheader', { name: 'Date' });
    const draft = page.getByRole('columnheader', { name: 'Draft' });

    await expect.element(title).toHaveAttribute('aria-sort', 'ascending');
    // A column that can be sorted but isn’t has a sort button without `aria-sort`
    await expect.element(date).not.toHaveAttribute('aria-sort');
    await expect.element(date.getByRole('button')).toBeInTheDocument();
    // A column without a sort key can’t be sorted
    await expect.element(draft).not.toHaveAttribute('aria-sort');
    expect(draft.getByRole('button').elements()).toHaveLength(0);

    await title.getByRole('button').click();
    await expect
      .poll(() => currentView.current.sort)
      .toEqual({ key: 'title', order: 'descending' });
    await expect.element(title).toHaveAttribute('aria-sort', 'descending');

    await date.getByRole('button').click();
    await expect.poll(() => currentView.current.sort).toEqual({ key: 'date', order: 'ascending' });
    await expect.element(date).toHaveAttribute('aria-sort', 'ascending');
    await expect.element(title).not.toHaveAttribute('aria-sort');
    // The rest of the view is kept
    expect(currentView.current.type).toBe('table');
  });

  test('sorts the summary column by the summary with a summary template', async () => {
    const collection = selectCollection('notes');

    await render(EntryTableHead, {
      collection,
      columns: [{ key: '_summary', label: 'Summary' }],
      showCheckbox: false,
    });

    const summary = page.getByRole('columnheader', { name: 'Summary' });

    await expect.element(summary).not.toHaveAttribute('aria-sort');
    await summary.getByRole('button').click();
    await expect
      .poll(() => currentView.current.sort)
      .toEqual({ key: '_summary', order: 'ascending' });
  });

  test('leaves the summary column unsorted without a sort key for it', async () => {
    // No summary template, and the identifier field isn’t one of the sort keys
    const collection = selectCollection('events');

    const { container } = await render(EntryTableHead, {
      collection,
      columns: [
        { key: '_summary', label: 'Title' },
        { key: 'date', label: 'Date' },
      ],
      showCheckbox: false,
    });

    const title = page.getByRole('columnheader', { name: 'Title' });

    await expect.element(title).toBeInTheDocument();
    expect(title.getByRole('button').elements()).toHaveLength(0);
    expect(title.element()).toHaveClass('title');
    await expect
      .element(page.getByRole('columnheader', { name: 'Date' }).getByRole('button'))
      .toBeInTheDocument();
    expect(container.querySelector('.sortable.column')).not.toBeNull();
  });
});
