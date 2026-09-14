import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { searchMode, searchTerms } from '$lib/services/search';

import QuickSearchBar from './quick-search-bar.svelte';

describe('QuickSearchBar', () => {
  beforeEach(() => {
    window.location.hash = '#/collections';
    searchTerms.current = '';
  });

  test('is hidden while there is nothing to search', async () => {
    searchMode.current = null;

    const { container } = await render(QuickSearchBar, {});

    expect(container.querySelector('input')).toBeNull();
  });

  test('searches the contents as the user types, and goes back when cleared', async () => {
    searchMode.current = 'contents';

    await render(QuickSearchBar, {});

    const input = page.getByRole('searchbox');

    await expect.element(input).toHaveAttribute('placeholder', 'Search for contents…');
    await input.fill('hello');

    await expect.poll(() => searchTerms.current).toBe('hello');
    await expect.poll(() => window.location.hash).toBe('#/search/hello');

    await page.getByRole('button', { name: 'Clear' }).click();
    await expect.poll(() => searchTerms.current).toBe('');
    await expect.poll(() => window.location.hash).toBe('#/collections');
  });

  test('restores the current search terms', async () => {
    searchMode.current = 'assets';
    searchTerms.current = 'photo';
    window.location.hash = '#/assets';

    await render(QuickSearchBar, {});

    await expect.element(page.getByRole('searchbox')).toHaveValue('photo');
    await expect
      .element(page.getByRole('searchbox'))
      .toHaveAttribute('placeholder', 'Search for assets…');

    // Clearing the terms away from the search page stays on the page
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect.poll(() => searchTerms.current).toBe('');
    expect(window.location.hash).toBe('#/assets');
  });
});
