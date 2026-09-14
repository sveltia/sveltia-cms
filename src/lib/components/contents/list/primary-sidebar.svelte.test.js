import { sleep } from '@sveltia/utils/misc';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { selectedCollection } from '$lib/services/contents/collection';
import { searchMode } from '$lib/services/search';
import { env } from '$lib/services/user/env.svelte';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import PrimarySidebar from './primary-sidebar.svelte';

/** @type {Partial<import('$lib/types/public').CmsConfig>} */
const config = {
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    },
    { divider: true },
    // A divider can be turned off
    { divider: false },
    {
      name: 'settings',
      label: 'Settings',
      files: [{ name: 'general', file: 'data/general.yml', fields: [{ name: 'x' }] }],
    },
    {
      name: 'secret',
      label: 'Secret',
      hide: true,
      folder: 'content/secret',
      fields: [{ name: 'title', widget: 'string' }],
    },
  ],
  singletons: [
    { name: 'about', label: 'About', file: 'data/about.yml', fields: [{ name: 'x' }] },
    { divider: false },
  ],
};

describe('PrimarySidebar', () => {
  beforeAll(async () => {
    await initTestConfig(config);
    setEntries([
      createMockEntry({ slug: 'a', content: { _default: { title: 'A' } } }),
      createMockEntry({ slug: 'b', content: { _default: { title: 'B' } } }),
    ]);
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    selectedCollection.current = undefined;
    window.location.hash = '#/collections';
  });

  test('lists the visible collections with their entry counts, and the singletons', async () => {
    await render(PrimarySidebar, {});

    const tree = page.getByRole('tree', { name: 'Collection List' });

    await expect.element(tree).toHaveAttribute('aria-controls', 'collection-container');
    await expect.poll(() => tree.getByRole('treeitem').elements().length).toBe(3);
    expect(
      tree
        .getByRole('treeitem')
        .elements()
        .map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['bookmark_manager Posts 2', 'bookmark_manager Settings 1', 'edit_document About']);
    expect(tree.element().querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(
      [...tree.element().querySelectorAll('[role="group"] > .label')].map((el) =>
        el.textContent?.trim(),
      ),
    ).toEqual(['Collections', 'Files']);
  });

  test('navigates to a collection', async () => {
    await render(PrimarySidebar, {});
    // A Sveltia UI tree starts handling clicks 100 ms after it’s mounted
    await sleep(150);
    await page.getByRole('treeitem', { name: 'Posts' }).click();

    await expect.poll(() => window.location.hash).toBe('#/collections/posts');
  });

  test('shows the page heading and search on a small screen', async () => {
    env.isSmallScreen = true;
    searchMode.current = 'contents';

    const { container } = await render(PrimarySidebar, {});

    expect(container.querySelector('h2')).toHaveTextContent('Contents');
    await expect.element(page.getByRole('searchbox')).toBeVisible();
  });

  test('searches from the small-screen search bar', async () => {
    env.isSmallScreen = true;
    searchMode.current = 'contents';

    await render(PrimarySidebar, {});
    await page.getByRole('searchbox').click();
    await expect.poll(() => window.location.hash).toBe('#/search');
  });

  test('lists the singletons like a file collection when there are no collections', async () => {
    await initTestConfig({
      collections: [],
      singletons: [
        { name: 'about', label: 'About', file: 'data/about.yml', fields: [{ name: 'x' }] },
        { divider: true },
        { name: 'contact', label: 'Contact', file: 'data/contact.yml', fields: [{ name: 'x' }] },
      ],
    });

    try {
      await render(PrimarySidebar, {});

      const tree = page.getByRole('tree', { name: 'Collection List' });
      const item = tree.getByRole('treeitem', { name: 'Files' });

      await expect.element(item).toHaveTextContent('bookmark_manager Files 2');
      expect(item.element().querySelector('.count')).toHaveAttribute('aria-label', '(2 entries)');
      expect(tree.element().querySelectorAll('[role="separator"]')).toHaveLength(0);
      expect(tree.getByRole('treeitem').elements()).toHaveLength(1);

      await sleep(150);
      await item.click();
      await expect.poll(() => window.location.hash).toBe('#/collections/_singletons');
    } finally {
      await initTestConfig(config);
    }
  });

  test('lists nothing when neither collections nor singletons are configured', async () => {
    await initTestConfig({ collections: undefined });

    try {
      await render(PrimarySidebar, {});

      const tree = page.getByRole('tree', { name: 'Collection List' });

      await expect.element(tree).toBeInTheDocument();
      expect(tree.getByRole('treeitem').elements()).toHaveLength(0);
    } finally {
      await initTestConfig(config);
    }
  });

  test('groups the singletons on a small screen even without collections', async () => {
    env.isSmallScreen = true;
    await initTestConfig({
      collections: [],
      singletons: [
        { name: 'about', label: 'About', file: 'data/about.yml', fields: [{ name: 'x' }] },
        { divider: true },
        { name: 'contact', label: 'Contact', file: 'data/contact.yml', fields: [{ name: 'x' }] },
      ],
    });

    try {
      await render(PrimarySidebar, {});

      const tree = page.getByRole('tree', { name: 'Collection List' });

      await expect.poll(() => tree.getByRole('treeitem').elements().length).toBe(2);
      expect(tree.element().querySelectorAll('[role="separator"]')).toHaveLength(1);
    } finally {
      await initTestConfig(config);
    }
  });
});
