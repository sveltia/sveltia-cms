import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { searchTerms } from '$lib/services/search';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import EntryResults from './entry-results.svelte';

describe('EntryResults', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  test('lists the matching entries', async () => {
    searchTerms.current = 'hello';
    setEntries([
      createMockEntry({ slug: 'hello-world', content: { _default: { title: 'Hello, world!' } } }),
      createMockEntry({ slug: 'goodbye', content: { _default: { title: 'Goodbye' } } }),
    ]);

    await render(EntryResults, {});

    const grid = page.getByRole('grid', { name: 'Entries' });

    await expect.element(grid).toHaveAttribute('aria-rowcount', '1');
    await expect.element(grid.getByRole('row')).toHaveTextContent('Posts Hello, world!');
  });

  test('reports when nothing matches', async () => {
    searchTerms.current = 'nothing';

    await render(EntryResults, {});
    await expect.element(page.getByText('No entries found.')).toBeVisible();

    // Nothing is reported without search terms
    searchTerms.current = '';
    await expect.poll(() => page.getByText('No entries found.').elements().length).toBe(0);
  });
});
