import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection } from '$lib/services/contents/collection';
import { selectedEntries } from '$lib/services/contents/collection/entries';
import { env } from '$lib/services/user/env.svelte';
import { createMockEntry, initTestConfig, TEST_IMAGE_URL } from '$lib/test/config';

import EntryListItemCells from './entry-list-item-cells.svelte';

describe('EntryListItemCells', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          summary: '{{title}} by {{author}}',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'author', widget: 'string' },
          ],
        },
        {
          name: 'pages',
          folder: 'content/pages',
          thumbnail: 'image',
          index_file: true,
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'image', widget: 'image' },
          ],
        },
        {
          name: 'items',
          folder: 'content/items',
          thumbnail: 'image',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'draft', widget: 'boolean' },
            { name: 'image', widget: 'image' },
          ],
        },
      ],
    });
  });

  test('shows the entry summary, a selection checkbox and the workflow status', async () => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    selectedEntries.current = [];

    const onSelect = vi.fn();

    const entry = createMockEntry({
      slug: 'a',
      content: { _default: { title: 'Hello', author: 'Melvin' } },
      entry: { workflow: /** @type {any} */ ({ status: 'pending_review' }) },
    });

    const { container } = await render(EntryListItemCells, {
      collection: /** @type {any} */ (getCollection('posts')),
      entry,
      viewType: 'list',
      showCheckbox: true,
      onSelect,
    });

    expect(container.querySelector('.title')).toHaveTextContent('Hello by Melvin');
    expect(container.querySelector('.status')).toHaveTextContent('In Review');

    const checkbox = page.getByRole('checkbox');

    await expect.element(checkbox).not.toBeChecked();
    await checkbox.click();
    expect(onSelect).toHaveBeenCalledWith(true);

    selectedEntries.current = [entry];
    await expect.element(checkbox).toBeChecked();
  });

  test('hides the checkbox on a small screen', async () => {
    env.isSmallScreen = true;

    const { container } = await render(EntryListItemCells, {
      collection: /** @type {any} */ (getCollection('posts')),
      entry: createMockEntry({ slug: 'a', content: { _default: { title: 'Hello' } } }),
      viewType: 'list',
      showCheckbox: true,
    });

    expect(container.querySelector('.checkbox')).toBeNull();
  });

  test('shows the thumbnail, and marks the index file', async () => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;

    const { container } = await render(EntryListItemCells, {
      collection: /** @type {any} */ (getCollection('pages')),
      entry: createMockEntry({
        slug: '_index',
        folder: 'content/pages',
        content: { _default: { title: 'Home', image: TEST_IMAGE_URL } },
      }),
      viewType: 'grid',
    });

    await expect
      .poll(() => container.querySelector('.image img')?.getAttribute('src'))
      .toBe(TEST_IMAGE_URL);
    expect(container.querySelector('.image .preview')).toHaveClass('tile');
    expect(container.querySelector('.title .icon.home')).not.toBeNull();

    // A missing image leaves the cell empty
    const { container: other } = await render(EntryListItemCells, {
      collection: /** @type {any} */ (getCollection('pages')),
      entry: createMockEntry({
        slug: 'about',
        folder: 'content/pages',
        content: { _default: { title: 'About' } },
      }),
      viewType: 'list',
    });

    await expect.poll(() => other.querySelector('.image')).not.toBeNull();
    expect(other.querySelector('.image img')).toBeNull();
    expect(other.querySelector('.icon.home')).toBeNull();
  });

  test('shows the thumbnail as an icon in the list view', async () => {
    const { container } = await render(EntryListItemCells, {
      collection: /** @type {any} */ (getCollection('pages')),
      entry: createMockEntry({
        slug: 'about',
        folder: 'content/pages',
        content: { _default: { title: 'About', image: TEST_IMAGE_URL } },
      }),
      viewType: 'list',
    });

    await expect.poll(() => container.querySelector('.image .preview')).not.toBeNull();
    expect(container.querySelector('.image .preview')).toHaveClass('icon');
  });

  test('shows a cell for each column in the table view', async () => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;

    const collection = /** @type {any} */ (getCollection('items'));

    /** @type {any[]} */
    const columns = [
      { key: '_summary', label: 'Title' },
      { key: 'draft', label: 'Draft', fieldConfig: { name: 'draft', widget: 'boolean' } },
      { key: 'slug', label: 'Slug' },
    ];

    const { container } = await render(EntryListItemCells, {
      collection,
      entry: createMockEntry({
        slug: 'hello',
        folder: 'content/items',
        content: { _default: { title: 'Hello', draft: true, image: TEST_IMAGE_URL } },
      }),
      viewType: 'table',
      columns,
    });

    // The thumbnail is shown as an icon, as in the list view
    await expect.poll(() => container.querySelector('.image .preview')).not.toBeNull();
    expect(container.querySelector('.image .preview')).toHaveClass('icon');
    // The summary column uses the title cell
    expect(container.querySelector('.title')).toHaveTextContent('Hello');
    expect(
      [...container.querySelectorAll('.column')].map((el) => el.getAttribute('data-key')),
    ).toEqual(['draft', 'slug']);

    // A Boolean field that’s on is shown as a check mark
    const check = page.getByRole('img', { name: 'Yes' });

    await expect.element(check).toBeInTheDocument();
    expect(check.element().closest('[data-key]')?.getAttribute('data-key')).toBe('draft');
    expect(container.querySelector('[data-key="slug"]')).toHaveTextContent('hello');

    // A Boolean field that’s off leaves the cell empty
    const { container: other } = await render(EntryListItemCells, {
      collection,
      entry: createMockEntry({
        slug: 'world',
        folder: 'content/items',
        content: { _default: { title: 'World', draft: false } },
      }),
      viewType: 'table',
      columns,
    });

    await expect.poll(() => other.querySelector('[data-key="draft"]')).not.toBeNull();
    expect(other.querySelector('[data-key="draft"]')?.textContent?.trim()).toBe('');
    expect(other.querySelector('[data-key="draft"] .icon')).toBeNull();
    expect(other.querySelector('[data-key="slug"]')).toHaveTextContent('world');
  });

  test('shows no column cells without columns in the table view', async () => {
    const { container } = await render(EntryListItemCells, {
      collection: /** @type {any} */ (getCollection('posts')),
      entry: createMockEntry({ slug: 'a', content: { _default: { title: 'Hello' } } }),
      viewType: 'table',
    });

    await expect.poll(() => container.querySelector('.status')).not.toBeNull();
    expect(container.querySelector('.title')).toBeNull();
    expect(container.querySelector('.column')).toBeNull();
  });
});
