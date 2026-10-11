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

describe('UsedEntries with collections sharing a folder', () => {
  beforeAll(async () => {
    const fields = [
      { name: 'title', widget: 'string' },
      { name: 'lang', widget: 'string' },
    ];

    await initTestConfig({
      collections: [
        {
          name: 'en',
          label: 'English',
          folder: 'content/posts',
          filter: { field: 'lang', value: 'en' },
          fields,
        },
        {
          name: 'fr',
          label: 'French',
          folder: 'content/posts',
          filter: { field: 'lang', value: 'fr' },
          fields,
        },
        { name: 'archive', label: 'Archive', folder: 'content/posts', hide: true, fields },
      ],
    });
  });

  test('links only to the collections listing the entry', async () => {
    await render(UsedEntries, {
      entries: [
        createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello', lang: 'en' } } }),
      ],
    });

    // The French collection filters the entry out, and the archive is hidden, so neither can
    // open it
    expect(
      page
        .getByRole('link')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['English › Hello']);
  });

  test('leaves out an entry no collection lists', async () => {
    await render(UsedEntries, {
      entries: [
        createMockEntry({ slug: 'old', content: { _default: { title: 'Old', lang: 'de' } } }),
      ],
    });

    await expect.element(page.getByRole('paragraph')).toHaveTextContent('None');
    expect(page.getByRole('link').elements()).toHaveLength(0);
  });
});
