import { Tree } from '@sveltia/ui';
import { sleep } from '@sveltia/utils/misc';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ParentFolderTreeItem from './parent-folder-tree-item.svelte';

const node = {
  path: '',
  label: 'Pages',
  children: [
    {
      path: 'docs',
      label: 'Docs',
      children: [{ path: 'docs/guides', label: 'Guides', children: [] }],
    },
    { path: 'about', label: 'About', children: [] },
  ],
};

describe('ParentFolderTreeItem', () => {
  test('renders the folders, opening the branch holding the selected one', async () => {
    const onSelectPath = vi.fn();

    await render(
      ParentFolderTreeItem,
      { node, selectedPath: 'docs/guides', onSelectPath },
      { wrapper: Tree },
    );

    const root = page.getByRole('treeitem', { name: 'Pages' });
    const docs = page.getByRole('treeitem', { name: 'Docs' });
    const guides = page.getByRole('treeitem', { name: 'Guides' });
    const about = page.getByRole('treeitem', { name: 'About' });

    await expect.element(root).toHaveAttribute('aria-expanded', 'true');
    expect(root.element().textContent).toContain('bookmark_manager Pages');
    await expect.element(docs).toHaveAttribute('aria-expanded', 'true');
    await expect.element(guides).toHaveAttribute('aria-selected', 'true');
    expect(about.element().textContent).toContain('folder About');
    expect(about.element().querySelector('[role="group"]')).toBeNull();

    await sleep(150);
    await about.getByText('About').click();
    expect(onSelectPath).toHaveBeenCalledWith('about');
  });

  test('keeps the other branches closed', async () => {
    await render(
      ParentFolderTreeItem,
      { node, selectedPath: 'about', onSelectPath: vi.fn() },
      { wrapper: Tree },
    );

    await expect
      .element(page.getByRole('treeitem', { name: 'Docs' }))
      .toHaveAttribute('aria-expanded', 'false');
  });
});
