import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { selectedEntries } from '$lib/services/contents/collection/entries';
import { env } from '$lib/services/user/env.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import EntryListItem from './entry-list-item.svelte';

describe('EntryListItem', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  test('opens the entry, and toggles its selection', async () => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    forkedRepository.current = undefined;
    selectedEntries.current = [];
    window.location.hash = '#/collections/posts';

    const entry = createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } });

    setEntries([entry]);
    selectedCollection.current = /** @type {any} */ (getCollection('posts'));

    await render(EntryListItem, {
      collection: /** @type {any} */ (getCollection('posts')),
      entry,
      viewType: 'list',
    });

    const row = page.getByRole('row');

    await expect.element(row).toHaveAttribute('aria-rowindex', '0');
    await page.getByRole('checkbox').click();
    await expect.poll(() => selectedEntries.current).toEqual([entry]);

    // The grid reports a selection change made with the keyboard on the row itself
    row.element().dispatchEvent(new CustomEvent('Change', { detail: { selected: false } }));
    await expect.poll(() => selectedEntries.current).toEqual([]);

    await row.click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/hello');
  });

  test('hides the checkbox from an Open Authoring contributor', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    try {
      const { container } = await render(EntryListItem, {
        collection: /** @type {any} */ (getCollection('posts')),
        entry: createMockEntry({ slug: 'a', content: { _default: { title: 'A' } } }),
        viewType: 'list',
      });

      expect(container.querySelector('.checkbox')).toBeNull();
    } finally {
      forkedRepository.current = undefined;
    }
  });
});
