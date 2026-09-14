import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createMockEntry, initTestConfig } from '$lib/test/config';

import UsedEntries from './used-entries.svelte';

describe('UsedEntries', () => {
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
          name: 'pages',
          label: 'Pages',
          files: [
            {
              name: 'about',
              label: 'About Us',
              file: 'content/about.md',
              fields: [{ name: 'title', widget: 'string' }],
            },
          ],
        },
      ],
    });
  });

  test('links to each entry using the asset', async () => {
    window.location.hash = '#/assets';

    await render(UsedEntries, {
      entries: [
        createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello World' } } }),
        createMockEntry({ slug: 'about', folder: 'content', entry: { id: 'content/about' } }),
      ],
    });

    const links = page.getByRole('link');

    expect(links.elements().map((el) => el.textContent?.trim())).toEqual([
      'Posts › Hello World',
      'Pages › About Us',
    ]);

    await links.nth(0).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/hello');
  });

  test('shows a loading message until the entries are known', async () => {
    const props = $state({ entries: /** @type {any[] | undefined} */ (undefined) });

    await render(UsedEntries, props);
    await expect.element(page.getByRole('paragraph')).toHaveTextContent('Loading…');

    props.entries = [];
    await expect.element(page.getByRole('paragraph')).toHaveTextContent('None');
  });
});
