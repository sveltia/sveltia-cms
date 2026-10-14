import { beforeAll, beforeEach, describe, expect, onTestFinished, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { lockedBranch } from '$lib/services/backends/branch-access';
import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { selectedEntries } from '$lib/services/contents/collection/entries';
import {
  bulkEditing,
  reordering,
  setBulkEditMode,
  setReorderMode,
} from '$lib/services/contents/collection/view';
import { env } from '$lib/services/user/env.svelte';
import { unpublishedEntries } from '$lib/services/workflow';
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
          name: 'single',
          label: 'Single',
          folder: 'content/single',
          limit: 1,
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'closed',
          label: 'Closed',
          folder: 'content/closed',
          limit: 0,
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'bulk',
          label: 'Bulk',
          folder: 'content/bulk',
          bulk_edit: true,
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'settings',
          label: 'Settings',
          files: [{ name: 'general', file: 'data/general.yml', fields: [{ name: 'x' }] }],
        },
        {
          name: 'frozen',
          label: 'Frozen',
          folder: 'content/frozen',
          readonly: true,
          reorder: true,
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'frozen_settings',
          label: 'Frozen Settings',
          readonly: true,
          files: [{ name: 'general', file: 'data/frozen.yml', fields: [{ name: 'x' }] }],
        },
      ],
    });
  });

  beforeEach(() => {
    env.isSmallScreen = false;
    forkedRepository.current = undefined;
    lockedBranch.current = undefined;
    selectedEntries.current = [];
    setReorderMode(false);
    setBulkEditMode(false);
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
      createMockEntry({
        slug: 'e',
        folder: 'content/bulk',
        content: { _default: { title: 'E' } },
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
      .element(page.getByRole('status'))
      .toHaveTextContent(
        'info Information You cannot add new entries to this collection because it has reached its limit of ' +
          '1 entry.',
      );
  });

  test('offers reordering, and warns when nearing the entry limit', async () => {
    selectedCollection.current = getCollection('sorted');

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(
        'info Information This collection is nearing its limit of 3 entries. You can only create 1 more entry.',
      );

    await page.getByRole('button', { name: 'Reorder Entries' }).click();
    expect(reordering.current).toBe(true);
    await expect
      .element(page.getByRole('button', { name: 'Done Reordering Entries' }))
      .toBeVisible();
  });

  test('keeps the focus near the buttons as the reorder mode is entered and left', async () => {
    selectedCollection.current = getCollection('sorted');

    await render(PrimaryToolbar, {});

    const reorder = page.getByRole('button', { name: 'Reorder Entries' });

    // The Done button is disabled until something has moved, so the Cancel button takes the focus
    await reorder.click();
    await expect
      .element(page.getByRole('button', { name: 'Cancel Reordering Entries' }))
      .toHaveFocus();

    await page.getByRole('button', { name: 'Cancel Reordering Entries' }).click();
    expect(reordering.current).toBe(false);
    await expect.element(reorder).toHaveFocus();
  });

  test('offers bulk editing only when the collection allows it', async () => {
    selectedCollection.current = getCollection('posts');

    await render(PrimaryToolbar, {});

    await expect.element(page.getByRole('button', { name: 'Create New Entry' })).toBeVisible();
    expect(page.getByRole('button', { name: 'Edit Entries in Bulk' }).elements()).toHaveLength(0);

    selectedCollection.current = getCollection('bulk');

    const edit = page.getByRole('button', { name: 'Edit Entries in Bulk' });

    await expect.element(edit).toHaveTextContent('Edit');
    await expect.element(edit).toHaveAttribute('aria-disabled', 'false');

    // A table of controls doesn’t fit on a small screen
    env.isSmallScreen = true;
    await expect.element(page.getByRole('button', { name: 'Create New Entry' })).toBeVisible();
    expect(page.getByRole('button', { name: 'Edit Entries in Bulk' }).elements()).toHaveLength(0);
  });

  test('disables the bulk edit button when there is no entry to edit', async () => {
    setEntries([]);
    selectedCollection.current = getCollection('bulk');

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('button', { name: 'Edit Entries in Bulk' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('keeps the focus near the buttons as the bulk edit mode is entered and left', async () => {
    selectedCollection.current = getCollection('bulk');

    await render(PrimaryToolbar, {});

    const edit = page.getByRole('button', { name: 'Edit Entries in Bulk' });

    // The Save button is disabled until something has changed, so the Cancel button takes the focus
    await edit.click();
    expect(bulkEditing.current).toBe(true);
    await expect.element(page.getByRole('button', { name: 'Save Bulk Edits' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Cancel Bulk Edits' })).toHaveFocus();
    // The other entry actions make way for the controls
    expect(page.getByRole('button', { name: 'Create New Entry' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: /^Delete/ }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Cancel Bulk Edits' }).click();
    expect(bulkEditing.current).toBe(false);
    await expect.element(edit).toHaveFocus();
  });

  test('moves the focus to the entry list once the focused Delete button is disabled', async () => {
    selectedCollection.current = getCollection('posts');

    // The entry list next to the toolbar, with the row in the tab order
    const pageContainer = document.createElement('div');

    pageContainer.id = 'page-container';
    pageContainer.innerHTML = '<div role="grid"><div role="row" tabindex="0">A</div></div>';
    document.body.append(pageContainer);
    onTestFinished(() => {
      pageContainer.remove();
    });

    await render(PrimaryToolbar, {});
    selectedEntries.current = [createMockEntry({ slug: 'a' })];

    const deleteButton = page.getByRole('button', { name: 'Delete Selected Entry' });

    await expect.element(deleteButton).toBeEnabled();
    deleteButton.element().focus();
    // The selected entry has been deleted
    selectedEntries.current = [];
    await expect.element(page.getByRole('row')).toHaveFocus();

    // The focus is left alone when the button didn’t have it
    selectedEntries.current = [createMockEntry({ slug: 'a' })];
    await expect.element(deleteButton).toBeEnabled();
    selectedEntries.current = [];
    await expect.element(page.getByRole('button', { name: /^Delete/ })).toBeDisabled();
    await expect.element(page.getByRole('row')).toHaveFocus();
  });

  test('warns about a limit of 1 entry in the singular', async () => {
    selectedCollection.current = getCollection('single');

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(
        'info Information This collection is nearing its limit of 1 entry. You can only create 1 more entry.',
      );
  });

  test('explains when creation is disabled', async () => {
    selectedCollection.current = getCollection('locked');

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(
        'info Information Creating new entries in this collection is disabled by the administrator.',
      );
  });

  test('explains when creation is disabled with a limit of 0', async () => {
    selectedCollection.current = getCollection('closed');

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(
        'info Information Creating new entries in this collection is disabled by the administrator.',
      );

    // The message comes above the toolbar, like the read-only one
    expect(
      page
        .getByRole('status')
        .element()
        .compareDocumentPosition(page.getByRole('toolbar', { name: 'Collection' }).element()),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test('explains when the collection is read-only, and disables the entry actions', async () => {
    selectedCollection.current = getCollection('frozen');

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(
        'info Information This collection is read-only. You can view its content but cannot make ' +
          'any changes.',
      );
    await expect.element(page.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: /^Delete/ })).toBeDisabled();
    expect(page.getByRole('button', { name: 'Reorder Entries' }).elements()).toHaveLength(0);
  });

  test('explains when a file collection is read-only', async () => {
    selectedCollection.current = getCollection('frozen_settings');

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(
        'info Information This collection is read-only. You can view its content but cannot make ' +
          'any changes.',
      );
  });

  test('explains when the collection is read-only because the user can’t push to the branch', async () => {
    selectedCollection.current = getCollection('posts');
    lockedBranch.current = 'main';

    await render(PrimaryToolbar, {});

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(
        'info Information You don’t have permission to push to the “\u2068main\u2069” branch. ' +
          'You can view this content but cannot make any changes.',
      );
    await expect.element(page.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();
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

    await expect.element(page.getByRole('status')).toBeVisible();
    expect(page.getByRole('button', { name: 'Create' }).elements()).toHaveLength(0);
  });

  test('offers the floating button on a small screen when only drafts are listed', async () => {
    env.isSmallScreen = true;
    setEntries([]);
    selectedCollection.current = getCollection('posts');

    try {
      // The entry list shows the drafts rather than its empty state with a Create button
      unpublishedEntries.current = [
        /** @type {any} */ ({
          ...createMockEntry({ slug: 'draft', content: { _default: { title: 'Draft' } } }),
          workflow: {
            status: 'draft',
            collectionName: 'posts',
            pullRequest: { number: 1, branch: 'cms/posts/draft' },
          },
        }),
      ];

      await render(PrimaryToolbar, {});

      await expect.element(page.getByRole('button', { name: 'Create New Entry' })).toBeVisible();
    } finally {
      unpublishedEntries.current = [];
    }
  });

  test('renders nothing without a collection', async () => {
    selectedCollection.current = undefined;

    const { container } = await render(PrimaryToolbar, {});

    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });
});
