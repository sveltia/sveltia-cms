import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { selectedEntries } from '$lib/services/contents/collection/entries';
import { reordering, setReorderMode } from '$lib/services/contents/collection/view';
import { env } from '$lib/services/user/env.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import PrimaryToolbar from './primary-toolbar.svelte';

describe('PrimaryToolbar', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          description: 'Blog *posts*',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'sorted',
          label: 'Sorted',
          folder: 'content/sorted',
          reorder: true,
          limit: 3,
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'locked',
          label: 'Locked',
          folder: 'content/locked',
          create: false,
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'full',
          label: 'Full',
          folder: 'content/full',
          limit: 1,
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'settings',
          label: 'Settings',
          files: [{ name: 'general', file: 'data/general.yml', fields: [{ name: 'x' }] }],
        },
      ],
    });
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    forkedRepository.current = undefined;
    selectedEntries.current = [];
    setReorderMode(false);
    setEntries([
      createMockEntry({ slug: 'a', content: { _default: { title: 'A' } } }),
      createMockEntry({
        slug: 'b',
        folder: 'content/sorted',
        content: { _default: { title: 'B' } },
      }),
      createMockEntry({
        slug: 'c',
        folder: 'content/sorted',
        content: { _default: { title: 'C' } },
      }),
      createMockEntry({
        slug: 'd',
        folder: 'content/full',
        content: { _default: { title: 'D' } },
      }),
    ]);
  });

  test('shows the collection with its description and the entry actions', async () => {
    selectedCollection.current = getCollection('posts');

    const { container } = await render(PrimaryToolbar, {});
    const toolbar = page.getByRole('toolbar', { name: 'Collection' });

    await expect.element(toolbar).toBeVisible();
    expect(container.querySelector('h2')).toHaveTextContent('Posts');
    expect(container.querySelector('.description em')).toHaveTextContent('posts');

    await expect
      .element(toolbar.getByRole('button', { name: 'Delete Selected Entries' }))
      .toHaveAttribute('aria-disabled', 'true');
    await expect.element(toolbar.getByRole('button', { name: 'Create New Entry' })).toBeVisible();
    expect(toolbar.getByRole('button', { name: 'Reorder Entries' }).elements()).toHaveLength(0);

    selectedEntries.current = [createMockEntry({ slug: 'a' })];
    await expect
      .element(toolbar.getByRole('button', { name: 'Delete Selected Entry' }))
      .toHaveAttribute('aria-disabled', 'false');

    // Deleting needs confirmation
    await toolbar.getByRole('button', { name: 'Delete Selected Entry' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

    await expect.element(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();

    // Creating an entry opens the editor
    window.location.hash = '#/collections/posts';
    await toolbar.getByRole('button', { name: 'Create New Entry' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/new');
  });

  test('explains when the entry limit is reached', async () => {
    selectedCollection.current = getCollection('full');

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'info You cannot add new entries to this collection because it has reached its limit of ' +
          '1 entries.',
      );
  });

  test('offers reordering, and warns when nearing the entry limit', async () => {
    selectedCollection.current = getCollection('sorted');

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'info This collection is nearing its limit of 3 entries. You can only create 1 more entry.',
      );

    await page.getByRole('button', { name: 'Reorder Entries' }).click();
    expect(reordering.current).toBe(true);
    await expect
      .element(page.getByRole('button', { name: 'Done Reordering Entries' }))
      .toBeVisible();
  });

  test('explains when creation is disabled', async () => {
    selectedCollection.current = getCollection('locked');

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'info Creating new entries in this collection is disabled by the administrator.',
      );
  });

  test('hides the entry actions for a file collection', async () => {
    selectedCollection.current = getCollection('settings');

    await render(PrimaryToolbar, {});

    await expect.element(page.getByRole('toolbar')).toBeVisible();
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  test('shows a back button on a small screen', async () => {
    env.isSmallScreen = true;
    selectedCollection.current = getCollection('posts');
    window.location.hash = '#/collections/posts';

    await render(PrimaryToolbar, {});
    await page.getByRole('button', { name: 'Back to Collection List' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections');
  });

  test('offers no floating button on a small screen when nothing can be created', async () => {
    env.isSmallScreen = true;
    selectedCollection.current = getCollection('full');

    await render(PrimaryToolbar, {});

    await expect.element(page.getByRole('alert')).toBeVisible();
    expect(page.getByRole('button', { name: 'Create' }).elements()).toHaveLength(0);
  });

  test('renders nothing without a collection', async () => {
    selectedCollection.current = undefined;

    const { container } = await render(PrimaryToolbar, {});

    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });
});
