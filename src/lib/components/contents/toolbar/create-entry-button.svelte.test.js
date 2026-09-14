import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { nestedFilterPath } from '$lib/services/contents/collection/nested';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import CreateEntryButton from './create-entry-button.svelte';

describe('CreateEntryButton', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'docs',
          folder: 'content/docs',
          nested: { depth: 3 },
          index_file: { name: '_index', label: 'Section Home', icon: 'home' },
          meta: { path: { widget: 'string', label: 'Path' } },
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
    });
  });

  beforeEach(() => {
    setEntries([createMockEntry({ slug: 'a', content: { _default: { title: 'A' } } })]);
    nestedFilterPath.current = '';
    window.location.hash = '#/collections/posts';
  });

  test('opens the editor for a new entry', async () => {
    selectedCollection.current = getCollection('posts');

    await render(CreateEntryButton, { collectionName: 'posts', label: 'New' });

    const button = page.getByRole('button', { name: 'Create New Entry' });

    await expect.element(button).toHaveTextContent('edit New');
    await button.click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/new');
    expect(window.history.state?.index).toBe(false);
  });

  test('starts the entry in the folder being browsed', async () => {
    selectedCollection.current = getCollection('docs');
    nestedFilterPath.current = 'guides';

    await render(CreateEntryButton, { collectionName: 'docs' });
    await page.getByRole('button', { name: 'Create New Entry' }).click();

    await expect.poll(() => window.location.hash).toBe('#/collections/docs/new?path=guides');
  });

  test('offers to create the index file of a nested collection', async () => {
    selectedCollection.current = getCollection('docs');

    await render(CreateEntryButton, { collectionName: 'docs', label: 'New' });

    // The split button’s dropdown lists the index file
    await page.getByRole('button', { name: 'More Options' }).click();
    await page.getByRole('menuitem', { name: 'Section Home' }).click();

    await expect.poll(() => window.location.hash).toBe('#/collections/docs/new');
    expect(window.history.state?.index).toBe(true);

    // A regular entry is offered too
    window.location.hash = '#/collections/docs';
    await page.getByRole('button', { name: 'More Options' }).click();
    await page.getByRole('menuitem', { name: 'Entry' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/docs/new');
    expect(window.history.state?.index).toBeFalsy();
  });
});
