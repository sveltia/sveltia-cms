import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createMockEntry, initTestConfig, TEST_IMAGE_URL } from '$lib/test/config';

import EntryResultItem from './entry-result-item.svelte';

describe('EntryResultItem', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'photos',
          label: 'Photos',
          folder: 'content/photos',
          thumbnail: 'image',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'image', widget: 'image' },
          ],
        },
        {
          name: 'settings',
          label: 'Settings',
          files: [
            {
              name: 'general',
              label: 'General',
              file: 'data/general.yml',
              fields: [{ name: 'title', widget: 'string' }],
            },
          ],
        },
      ],
    });
  });

  test('shows an entry with its collection, and opens it at the matching field', async () => {
    window.location.hash = '#/search/hello';

    const entry = createMockEntry({
      slug: 'hello-world',
      content: { _default: { title: 'Hello, world!' } },
    });

    const { container } = await render(EntryResultItem, {
      result: { entry, points: 1, locale: '_default', keyPath: 'title' },
    });

    await expect.element(page.getByRole('row')).toHaveTextContent('Posts Hello, world!');
    expect(container.querySelector('.collection')).toHaveTextContent('Posts');

    await page.getByRole('row').click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/hello-world');
    expect(window.history.state?.highlight).toEqual({ locale: '_default', keyPath: 'title' });
  });

  test('shows the thumbnail of an entry', async () => {
    const entry = createMockEntry({
      slug: 'sunset',
      folder: 'content/photos',
      content: { _default: { title: 'Sunset', image: TEST_IMAGE_URL } },
    });

    const { container } = await render(EntryResultItem, {
      result: { entry, points: 1, locale: '_default', keyPath: 'title' },
    });

    await expect
      .poll(() => container.querySelector('.image img')?.getAttribute('src'))
      .toBe(TEST_IMAGE_URL);
  });

  test('shows a file of a file collection by its label', async () => {
    const entry = createMockEntry({
      slug: 'general',
      folder: 'data',
      extension: 'yml',
      content: { _default: { title: 'My Site' } },
    });

    await render(EntryResultItem, { result: { entry, points: 1 } });

    await expect.element(page.getByRole('row')).toHaveTextContent('Settings General');
  });
});
