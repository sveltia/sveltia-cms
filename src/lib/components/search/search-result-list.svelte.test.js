import { createRawSnippet } from 'svelte';
import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { announcedPageStatus } from '$lib/services/app/navigation';
import { searchTerms } from '$lib/services/search';
import { initTestConfig } from '$lib/test/config';

import SearchResultList from './search-result-list.svelte';

/**
 * Render the list with the given items.
 * @param {{ id: string, name: string }[]} items Matching items.
 * @returns {Promise<any>} Render result.
 */
const renderList = (items) =>
  render(SearchResultList, {
    items,
    itemKey: 'id',
    label: 'Entries',
    emptyMessage: 'No entries found.',
    statusMessageKey: 'viewing_entry_search_results',
    renderItem: createRawSnippet((/** @type {() => { name: string }} */ item) => ({
      /**
       * Render the item.
       * @returns {string} HTML.
       */
      render: () => `<div role="row">${item().name}</div>`,
    })),
  });

describe('SearchResultList', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  test('lists the items in a group named after the result type, and announces the count', async () => {
    searchTerms.current = 'hello';

    await renderList([{ id: 'a', name: 'Hello, world!' }]);

    await expect.element(page.getByRole('group', { name: 'Entries' })).toBeInTheDocument();

    const grid = page.getByRole('grid', { name: 'Entries' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '1');
    await expect.element(grid.getByRole('row')).toHaveTextContent('Hello, world!');
    expect(announcedPageStatus.current).toBe(
      'You’re now viewing search results for “\u2068hello\u2069”. We’ve found one entry.',
    );
  });

  test('reports when nothing matches', async () => {
    searchTerms.current = 'nothing';

    await renderList([]);
    await expect.element(page.getByText('No entries found.')).toBeVisible();
    expect(page.getByRole('grid').elements()).toHaveLength(0);

    // Nothing is reported without search terms
    searchTerms.current = '';
    await expect.poll(() => page.getByText('No entries found.').elements().length).toBe(0);
  });
});
