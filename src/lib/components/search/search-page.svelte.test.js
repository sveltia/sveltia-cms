import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { searchMode, searchTerms } from '$lib/services/search';
import { initTestConfig } from '$lib/test/config';

import SearchPage from './search-page.svelte';

describe('SearchPage', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  test('takes the search terms from the URL and searches the contents by default', async () => {
    window.location.hash = '#/search/hello';
    searchMode.current = null;
    searchTerms.current = '';

    await render(SearchPage, {});

    await expect.poll(() => searchTerms.current).toBe('hello');
    expect(searchMode.current).toBe('contents');
    await expect
      .element(page.getByRole('group', { name: 'Search Results for “\u2068hello\u2069”' }))
      .toBeVisible();
  });

  test('follows a change to the URL', async () => {
    window.location.hash = '#/search/hello';
    searchMode.current = 'assets';

    await render(SearchPage, {});
    window.location.hash = '#/search/world';

    await expect.poll(() => searchTerms.current).toBe('world');
    expect(searchMode.current).toBe('assets');

    // The terms are left alone without any in the URL
    window.location.hash = '#/search';
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(searchTerms.current).toBe('world');
  });
});
