import { Tree } from '@sveltia/ui';
import { sleep } from '@sveltia/utils/misc';
import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { nestedFilterPath } from '$lib/services/contents/collection/nested';
import { initTestConfig } from '$lib/test/config';

import NestedTreeItem from './nested-tree-item.svelte';

const node = {
  path: 'docs',
  label: 'Docs',
  children: [{ path: 'docs/guides', label: 'Guides', children: [] }],
};

describe('NestedTreeItem', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  test('shows the folder, opening the tree down to the folder being browsed', async () => {
    selectedCollection.current = getCollection('posts');
    nestedFilterPath.current = 'docs/guides';
    window.location.hash = '#/collections/posts/filter/docs/guides';

    await render(NestedTreeItem, { node, collectionName: 'posts' }, { wrapper: Tree });
    await sleep(150);

    const docs = page.getByRole('treeitem', { name: 'Docs' });
    const guides = page.getByRole('treeitem', { name: 'Guides' });

    await expect.element(docs).toHaveAttribute('aria-expanded', 'true');
    await expect.element(guides).toHaveAttribute('aria-selected', 'true');

    // Activating a folder navigates to it. The label is clicked, as the chevron toggles the tree
    await docs.getByText('Docs').click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/filter/docs');
  });
});
