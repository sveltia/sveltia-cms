import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { unpublishedEntries } from '$lib/services/workflow';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import FileList from './file-list.svelte';

describe('FileList', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'settings',
          label: 'Settings',
          files: [
            {
              name: 'general',
              label: 'General',
              icon: 'settings',
              file: 'data/general.yml',
              fields: [{ name: 'title', widget: 'string' }],
            },
            { name: 'social', file: 'data/social.yml', fields: [{ name: 'x', widget: 'string' }] },
          ],
        },
        {
          name: 'pages',
          label: 'Pages',
          files: [
            {
              name: 'home',
              label: 'Home',
              icon: 'home',
              file: 'content/home.md',
              summary: '{{theme}} **{{headline}}**',
              fields: [
                {
                  name: 'theme',
                  widget: 'select',
                  options: [{ label: 'Dark Mode', value: 'dark' }],
                },
                { name: 'headline', widget: 'string' },
              ],
            },
            {
              name: 'about',
              label: 'About',
              file: 'content/about.md',
              summary: '{{title}}!',
              fields: [{ name: 'title', widget: 'string' }],
            },
          ],
        },
      ],
    });
  });

  beforeEach(() => {
    setEntries([]);
    unpublishedEntries.current = [];
    window.location.hash = '#/collections/settings';
  });

  test('lists the files of the selected file collection, and opens one', async () => {
    selectedCollection.current = getCollection('settings');

    await render(FileList, {});

    const grid = page.getByRole('grid', { name: 'Files' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '2');
    await expect.poll(() => grid.getByRole('row').elements().length).toBe(2);
    expect(
      grid
        .getByRole('row')
        .elements()
        .map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['settings General', 'social']);

    await grid.getByRole('row').nth(1).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/settings/entries/social');
  });

  test('shows the workflow status of an unpublished file', async () => {
    selectedCollection.current = getCollection('settings');
    unpublishedEntries.current = /** @type {any} */ ([
      { id: 'x', workflow: { collectionName: 'settings', fileName: 'general', status: 'draft' } },
    ]);

    await render(FileList, {});

    await expect
      .element(page.getByRole('row', { name: /General/ }))
      .toHaveTextContent('settings General Draft');
  });

  test('shows the summary of a file with the `summary` option, formatted with its fields', async () => {
    setEntries([
      createMockEntry({
        slug: 'home',
        folder: 'content',
        content: { _default: { theme: 'dark', headline: 'Welcome' } },
      }),
    ]);
    selectedCollection.current = getCollection('pages');

    await render(FileList, {});

    const grid = page.getByRole('grid', { name: 'Files' });

    await expect.poll(() => grid.getByRole('row').elements().length).toBe(2);
    await expect.element(grid.getByRole('row').nth(0)).toHaveTextContent('home Dark Mode Welcome');
    expect(grid.getByRole('row').nth(0).element().querySelector('strong')?.textContent).toBe(
      'Welcome',
    );
    // A file that doesn’t exist yet is labelled
    await expect.element(grid.getByRole('row').nth(1)).toHaveTextContent('About');
  });

  test('updates a summary when the file is saved or created', async () => {
    selectedCollection.current = getCollection('pages');

    await render(FileList, {});

    const row = page.getByRole('grid', { name: 'Files' }).getByRole('row').nth(1);

    await expect.element(row).toHaveTextContent('About');

    setEntries([
      createMockEntry({ slug: 'about', folder: 'content', content: { _default: { title: 'Us' } } }),
    ]);
    await expect.element(row).toHaveTextContent('Us!');
  });

  test('reports an empty collection', async () => {
    selectedCollection.current = undefined;

    await render(FileList, {});
    await expect.element(page.getByText('No files available in this collection.')).toBeVisible();
  });
});
