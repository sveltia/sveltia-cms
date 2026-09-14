import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection } from '$lib/services/contents/collection';
import { selectedEntries } from '$lib/services/contents/collection/entries';
import { env } from '$lib/services/user/env.svelte';
import { createMockEntry, initTestConfig } from '$lib/test/config';

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
        content: { _default: { title: 'Home', image: 'https://example.com/home.png' } },
      }),
      viewType: 'grid',
    });

    await expect
      .poll(() => container.querySelector('.image img')?.getAttribute('src'))
      .toBe('https://example.com/home.png');
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
});
