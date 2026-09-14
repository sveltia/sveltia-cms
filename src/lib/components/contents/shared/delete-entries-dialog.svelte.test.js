import { flushSync } from 'svelte';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { allAssetFolders } from '$lib/services/assets/folders';
import { backendName } from '$lib/services/backends';
import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { contentUpdatesToast } from '$lib/services/contents/collection/data';
import { deleteEntries } from '$lib/services/contents/collection/data/delete';
import { selectedEntries } from '$lib/services/contents/collection/entries';
import { deleteWorkflowEntries, discardWorkflowEntries } from '$lib/services/workflow/save';
import {
  createMockAsset,
  createMockEntry,
  initTestConfig,
  setAssets,
  setEntries,
} from '$lib/test/config';

import DeleteEntriesDialog from './delete-entries-dialog.svelte';

vi.mock('$lib/services/contents/collection/data/delete', () => ({
  updateStores: vi.fn(),
  deleteEntries: vi.fn(),
}));
vi.mock('$lib/services/workflow/save', () => ({
  getUnpublishedEntryByBranch: vi.fn(),
  upsertUnpublishedEntry: vi.fn(),
  removeUnpublishedEntry: vi.fn(),
  saveWorkflowChanges: vi.fn(),
  updateWorkflowStatus: vi.fn(),
  publishWorkflowEntry: vi.fn(),
  discardWorkflowEntry: vi.fn(),
  deleteWorkflowEntry: vi.fn(),
  discardWorkflowEntries: vi.fn(),
  deleteWorkflowEntries: vi.fn(),
}));

const entries = [
  createMockEntry({ slug: 'a', content: { _default: { title: 'A' } } }),
  createMockEntry({ slug: 'b', content: { _default: { title: 'B' } } }),
  createMockEntry({ slug: 'c', content: { _default: { title: 'C' } } }),
];

/** @type {any} */
const postsCollection = {
  name: 'posts',
  label: 'Posts',
  folder: 'content/posts',
  fields: [
    { name: 'title', widget: 'string' },
    { name: 'image', widget: 'image' },
  ],
};

describe('DeleteEntriesDialog', () => {
  beforeAll(async () => {
    await initTestConfig({ collections: [postsCollection] });
  });

  beforeEach(() => {
    backendName.current = undefined;
    setEntries(entries);
    selectedCollection.current = getCollection('posts');
  });

  test('asks for confirmation, then deletes the selected entries', async () => {
    vi.mocked(deleteEntries).mockResolvedValue(undefined);
    selectedEntries.current = [entries[0], entries[1]];

    const props = $state({ open: true });

    await render(DeleteEntriesDialog, props);

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entries' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Delete Entries Are you sure you want to delete the selected 2 entries? Delete Cancel',
      );
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() =>
      expect(deleteEntries).toHaveBeenCalledWith([entries[0], entries[1]], []),
    );
    await expect.poll(() => selectedEntries.current).toEqual([]);
    expect(props.open).toBe(false);
  });

  test('words the confirmation for all the entries', async () => {
    selectedEntries.current = entries;

    await render(DeleteEntriesDialog, { open: true });
    await expect
      .element(page.getByRole('alertdialog'))
      .toHaveTextContent(
        'Delete Entries Are you sure you want to delete all the entries? Delete Cancel',
      );
  });

  test('discards an unpublished entry instead of deleting it', async () => {
    vi.mocked(discardWorkflowEntries).mockResolvedValue(undefined);

    const draft = createMockEntry({
      slug: 'd',
      entry: { workflow: /** @type {any} */ ({ status: 'draft', collectionName: 'posts' }) },
    });

    selectedEntries.current = [draft];

    await render(DeleteEntriesDialog, { open: true });
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() => expect(discardWorkflowEntries).toHaveBeenCalledWith([draft]));
    expect(deleteEntries).not.toHaveBeenCalled();
  });

  test('notes the unpublished entries among the selected ones', async () => {
    const draft = createMockEntry({
      slug: 'd',
      entry: { workflow: /** @type {any} */ ({ status: 'draft', collectionName: 'posts' }) },
    });

    selectedEntries.current = [entries[0], draft];

    await render(DeleteEntriesDialog, { open: true });
    await expect
      .element(page.getByRole('alertdialog'))
      .toMatchTextContent('One of them hasn’t been published yet');
  });

  test('reports a failure', async () => {
    vi.mocked(deleteEntries).mockRejectedValue(new Error('Boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    selectedEntries.current = [entries[0]];

    await render(DeleteEntriesDialog, { open: true });
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Couldn’t delete the entry. Please try again.');

    // The toast goes away on its own
    await expect
      .poll(() => document.querySelector('.sui.toast')?.getAttribute('aria-hidden'), {
        timeout: 7000,
      })
      .toBe('true');
  });

  describe('with entry-relative assets', () => {
    beforeEach(async () => {
      // The assets are stored alongside the entries
      await initTestConfig({ collections: [{ ...postsCollection, media_folder: '' }] });
      setEntries(entries);
      selectedCollection.current = getCollection('posts');
    });

    test('words the confirmation for the assets', async () => {
      const folder = allAssetFolders.current.find(
        ({ collectionName }) => collectionName === 'posts',
      );

      const withAssets = [
        createMockEntry({ slug: 'a', content: { _default: { title: 'A', image: 'a.png' } } }),
        createMockEntry({ slug: 'b', content: { _default: { title: 'B', image: 'b.png' } } }),
      ];

      setEntries(withAssets);
      setAssets([
        createMockAsset({ name: 'a.png', folderPath: 'content/posts', asset: { folder } }),
        createMockAsset({ name: 'b.png', folderPath: 'content/posts', asset: { folder } }),
      ]);

      try {
        // Let the selection be pruned for the new entry list first
        flushSync();
        selectedEntries.current = [withAssets[0]];
        await render(DeleteEntriesDialog, { open: true });
        await expect
          .element(page.getByRole('alertdialog'))
          .toMatchTextContent('delete the selected entry and associated assets?');

        selectedEntries.current = withAssets;
        await expect
          .element(page.getByRole('alertdialog'))
          .toMatchTextContent('delete all the entries and associated assets?');
      } finally {
        setAssets([]);
      }
    });

    test('deletes the assets along with the entries', async () => {
      vi.mocked(deleteEntries).mockResolvedValue(undefined);
      selectedEntries.current = [entries[0]];

      await render(DeleteEntriesDialog, { open: true });
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

      await vi.waitFor(() => expect(deleteEntries).toHaveBeenCalledWith([entries[0]], []));
    });

    test('requests the deletion for review with Editorial Workflow', async () => {
      await initTestConfig({
        backend: { name: 'github', repo: 'me/site' },
        publish_mode: 'editorial_workflow',
        collections: [{ ...postsCollection, media_folder: '' }],
      });
      backendName.current = 'github';
      setEntries(entries);
      selectedCollection.current = getCollection('posts');
      vi.mocked(deleteWorkflowEntries).mockResolvedValue(undefined);
      selectedEntries.current = [entries[0], entries[1]];

      await render(DeleteEntriesDialog, { open: true });
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

      await vi.waitFor(() =>
        expect(deleteWorkflowEntries).toHaveBeenCalledWith([
          { entry: entries[0], collection: getCollection('posts'), assets: [] },
          { entry: entries[1], collection: getCollection('posts'), assets: [] },
        ]),
      );
      expect(deleteEntries).not.toHaveBeenCalled();
      expect(contentUpdatesToast.current).toEqual(
        expect.objectContaining({ deleted: true, deletionPending: true, count: 2 }),
      );
    });
  });
});
