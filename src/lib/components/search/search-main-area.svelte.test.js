import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { searchMode, searchTerms } from '$lib/services/search';
import { env } from '$lib/services/user/env.svelte';
import { initTestConfig } from '$lib/test/config';

import SearchMainArea from './search-main-area.svelte';

describe('SearchMainArea', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  test('shows the results only on a large screen', async () => {
    env.isSmallScreen = false;
    searchMode.current = 'contents';
    searchTerms.current = 'hello';

    await render(SearchMainArea, {});

    await expect.element(page.getByText('No entries found.')).toBeVisible();
    expect(page.getByRole('search').elements()).toHaveLength(0);
  });

  test('adds a back button and the search bar on a small screen', async () => {
    env.isSmallScreen = true;
    searchMode.current = 'assets';
    searchTerms.current = 'photo';
    window.location.hash = '#/search/photo';

    await render(SearchMainArea, {});

    await expect.element(page.getByRole('search').getByRole('searchbox')).toHaveValue('photo');
    await page.getByRole('button', { name: 'Back to Asset Folder List' }).click();

    await expect.poll(() => window.location.hash).toBe('#/assets');
    expect(searchTerms.current).toBe('');

    // Or back to the collection list
    searchMode.current = 'contents';
    searchTerms.current = 'hello';
    window.location.hash = '#/search/hello';
    await render(SearchMainArea, {});
    await page.getByRole('button', { name: 'Back to Collection List' }).nth(1).click();
    await expect.poll(() => window.location.hash).toBe('#/collections');
  });
});
