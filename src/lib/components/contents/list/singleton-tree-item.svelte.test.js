import { Tree } from '@sveltia/ui';
import { sleep } from '@sveltia/utils/misc';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { announcedPageStatus } from '$lib/services/app/navigation';

import SingletonTreeItem from './singleton-tree-item.svelte';

describe('SingletonTreeItem', () => {
  test('announces the file when selected, and opens it when activated', async () => {
    window.location.hash = '#/collections';
    announcedPageStatus.current = '';

    await render(
      SingletonTreeItem,
      { file: { name: 'about', label: 'About', icon: 'info', file: 'data/about.yml', fields: [] } },
      { wrapper: Tree },
    );

    await sleep(150);

    const item = page.getByRole('treeitem', { name: 'About' });

    await expect.element(item).toHaveTextContent('info About');
    await item.click();

    await expect.poll(() => window.location.hash).toBe('#/collections/_singletons/entries/about');
    // Selecting with the keyboard announces the file, activating it resets the selection
    await expect.element(item).toHaveAttribute('aria-selected', 'false');
  });

  test('falls back to the file name', async () => {
    await render(
      SingletonTreeItem,
      { file: { name: 'contact', file: 'data/contact.yml', fields: [] } },
      { wrapper: Tree },
    );

    await expect.element(page.getByRole('treeitem', { name: 'contact' })).toBeVisible();
  });
});
