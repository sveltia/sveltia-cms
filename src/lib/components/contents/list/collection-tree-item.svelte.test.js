import { Tree } from '@sveltia/ui';
import { sleep } from '@sveltia/utils/misc';
import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { nestedFilterPath } from '$lib/services/contents/collection/nested';
import { env } from '$lib/services/user/env.svelte';
import { unpublishedEntries } from '$lib/services/workflow';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import CollectionTreeItem from './collection-tree-item.svelte';

describe('CollectionTreeItem', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'pages',
          label: 'Pages',
          icon: 'web',
          folder: 'content/pages',
          nested: { depth: 3, subfolders: false },
          fields: [{ name: 'title', widget: 'string' }],
        },
        { name: 'notes', folder: 'content/notes', fields: [{ name: 'title', widget: 'string' }] },
        {
          name: 'sections',
          label: 'Sections',
          folder: 'content/sections',
          index_file: true,
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
    });
    setEntries([
      createMockEntry({
        slug: 'about',
        folder: 'content/pages',
        content: { _default: { title: 'About' } },
      }),
      createMockEntry({
        slug: 'docs/intro',
        folder: 'content/pages',
        content: { _default: { title: 'Intro' } },
      }),
      createMockEntry({
        slug: '_index',
        folder: 'content/sections',
        content: { _default: { title: 'Sections' } },
      }),
      createMockEntry({
        slug: 'first',
        folder: 'content/sections',
        content: { _default: { title: 'First' } },
      }),
    ]);
  });

  test('shows the collection with its entry count, and its folder tree once selected', async () => {
    env.isSmallScreen = false;
    selectedCollection.current = undefined;
    nestedFilterPath.current = '';
    window.location.hash = '#/collections';

    // A tree item is selected through its tree
    await render(
      CollectionTreeItem,
      { collection: /** @type {any} */ (getCollection('pages')) },
      { wrapper: Tree },
    );
    await sleep(150);

    const item = page.getByRole('treeitem', { name: 'Pages' });

    // The folder tree is rendered but collapsed
    await expect.element(item).toHaveTextContent('chevron_right web Pages 2 folder docs');
    await expect.element(item).toHaveAttribute('aria-expanded', 'false');

    await item.click();
    await expect.poll(() => window.location.hash).toBe('#/collections/pages');

    // Browsing the collection opens its folder tree
    selectedCollection.current = /** @type {any} */ (getCollection('pages'));
    await expect.element(item).toHaveAttribute('aria-expanded', 'true');
    await expect.element(item).toHaveAttribute('aria-selected', 'true');
    await expect.element(page.getByRole('treeitem', { name: 'docs' })).toBeVisible();

    await page.getByRole('treeitem', { name: 'docs' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/pages/filter/docs');
  });

  test('counts the unpublished entries in', async () => {
    env.isSmallScreen = false;
    selectedCollection.current = undefined;
    unpublishedEntries.current = [
      /** @type {any} */ ({
        ...createMockEntry({
          slug: 'team',
          folder: 'content/pages',
          content: { _default: { title: 'Team' } },
        }),
        workflow: {
          status: 'draft',
          collectionName: 'pages',
          pullRequest: { number: 1, branch: 'cms/pages/team' },
        },
      }),
      /** @type {any} */ ({
        ...createMockEntry({ slug: 'other', folder: 'content/other' }),
        workflow: {
          status: 'draft',
          collectionName: 'other',
          pullRequest: { number: 2, branch: 'cms/other/other' },
        },
      }),
    ];

    try {
      await render(
        CollectionTreeItem,
        { collection: /** @type {any} */ (getCollection('pages')) },
        { wrapper: Tree },
      );

      await expect
        .element(page.getByRole('treeitem', { name: 'Pages' }))
        .toHaveTextContent('chevron_right web Pages 3 folder docs');
    } finally {
      unpublishedEntries.current = [];
    }
  });

  test('leaves the index file out of the count', async () => {
    env.isSmallScreen = false;
    selectedCollection.current = undefined;

    await render(
      CollectionTreeItem,
      { collection: /** @type {any} */ (getCollection('sections')) },
      { wrapper: Tree },
    );

    // `content/sections/_index.md` is the collection’s own page, so only `first` is counted
    // @see https://github.com/sveltia/sveltia-cms/issues/1005
    await expect
      .element(page.getByRole('treeitem', { name: 'Sections' }))
      .toHaveTextContent('bookmark_manager Sections 1');
  });

  test('falls back to the collection name', async () => {
    await render(
      CollectionTreeItem,
      { collection: /** @type {any} */ (getCollection('notes')) },
      { wrapper: Tree },
    );

    await expect.element(page.getByRole('treeitem', { name: 'notes' })).toBeVisible();
  });
});
