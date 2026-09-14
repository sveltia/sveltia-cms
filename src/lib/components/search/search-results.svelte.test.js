import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { announcedPageStatus } from '$lib/services/app/navigation';
import { searchMode, searchTerms } from '$lib/services/search';
import { env } from '$lib/services/user/env.svelte';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import SearchResults from './search-results.svelte';

describe('SearchResults', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    window.location.hash = '#/search/hello';
    setEntries([
      createMockEntry({ slug: 'hello-world', content: { _default: { title: 'Hello, world!' } } }),
      createMockEntry({ slug: 'goodbye', content: { _default: { title: 'Goodbye' } } }),
    ]);
  });

  test('lists the entries matching the terms, and announces the count', async () => {
    searchMode.current = 'contents';
    searchTerms.current = 'hello';

    await render(SearchResults, {});

    await expect.element(page.getByRole('toolbar')).toHaveTextContent('Search Results');

    const grid = page.getByRole('grid', { name: 'Entries' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '1');
    await expect.element(grid.getByRole('row')).toHaveTextContent('Posts Hello, world!');
    expect(announcedPageStatus.current).toBe(
      'You’re now viewing search results for “\u2068hello\u2069”. We’ve found one entry.',
    );

    await grid.getByRole('row').click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/hello-world');
  });

  test('reports when nothing matches', async () => {
    searchMode.current = 'contents';
    searchTerms.current = 'nothing';

    await render(SearchResults, {});
    await expect.element(page.getByText('No entries found.')).toBeVisible();
  });

  test('lists the assets matching the terms', async () => {
    searchMode.current = 'assets';
    searchTerms.current = 'photo';

    await render(SearchResults, {});
    await expect.element(page.getByText('No files found.')).toBeVisible();
    expect(announcedPageStatus.current).toBe(
      'You’re now viewing search results for “\u2068photo\u2069”. We couldn’t find any assets.',
    );
  });

  test('hides the heading on a small screen', async () => {
    env.isSmallScreen = true;
    searchMode.current = 'contents';

    await render(SearchResults, {});
    expect(page.getByRole('toolbar').elements()).toHaveLength(0);
  });
});
