import { beforeEach, describe, expect, test, vi } from 'vitest';

import { deleteEntries } from '$lib/services/contents/collection/data/delete';
import { cancelBackup, deleteBackup } from '$lib/services/contents/draft/backup';
import { deleteOrDiscardEntries } from '$lib/services/workflow/delete';
import { deleteWorkflowEntries, discardWorkflowEntries } from '$lib/services/workflow/save';

vi.mock('$lib/services/contents/collection/data/delete', () => ({ deleteEntries: vi.fn() }));
vi.mock('$lib/services/contents/draft/backup', () => ({
  cancelBackup: vi.fn(),
  deleteBackup: vi.fn(),
}));
vi.mock('$lib/services/workflow/save', () => ({
  deleteWorkflowEntries: vi.fn(),
  discardWorkflowEntries: vi.fn(),
}));

/** @type {any} */
const collection = { name: 'posts' };
/** @type {any} */
const collectionFile = { name: 'about' };
/** @type {any} */
const draft = { slug: 'draft', workflow: { status: 'draft' } };
/** @type {any} */
const entryA = { slug: 'a' };
/** @type {any} */
const entryB = { slug: 'b' };
/** @type {any} */
const assetA = { path: 'content/posts/a/image.png' };

describe('deleteOrDiscardEntries', () => {
  beforeEach(() => {
    vi.mocked(deleteEntries).mockResolvedValue(undefined);
    vi.mocked(deleteWorkflowEntries).mockResolvedValue(undefined);
    vi.mocked(discardWorkflowEntries).mockResolvedValue(undefined);
    vi.mocked(deleteBackup).mockResolvedValue(undefined);
  });

  test('does nothing without entries', async () => {
    await expect(deleteOrDiscardEntries({ useWorkflow: true })).resolves.toBeUndefined();
    expect(discardWorkflowEntries).not.toHaveBeenCalled();
    expect(deleteWorkflowEntries).not.toHaveBeenCalled();
    expect(deleteEntries).not.toHaveBeenCalled();
  });

  test('discards the entries that have never been published', async () => {
    await expect(
      deleteOrDiscardEntries({ drafts: [draft], collection, useWorkflow: true }),
    ).resolves.toEqual({ deleted: true, count: 1 });
    expect(discardWorkflowEntries).toHaveBeenCalledWith([draft]);
    expect(deleteWorkflowEntries).not.toHaveBeenCalled();
    expect(deleteEntries).not.toHaveBeenCalled();
  });

  test('requests the deletion of the published entries with Editorial Workflow', async () => {
    await expect(
      deleteOrDiscardEntries({
        drafts: [draft],
        items: [
          { entry: entryA, assets: [assetA] },
          { entry: entryB, assets: [] },
        ],
        collection,
        collectionFile,
        useWorkflow: true,
      }),
    ).resolves.toEqual({ deleted: true, deletionPending: true, count: 2 });
    expect(discardWorkflowEntries).toHaveBeenCalledWith([draft]);
    expect(deleteWorkflowEntries).toHaveBeenCalledWith([
      { entry: entryA, collection, collectionFile, assets: [assetA] },
      { entry: entryB, collection, collectionFile, assets: [] },
    ]);
    expect(deleteEntries).not.toHaveBeenCalled();
  });

  test('deletes the published entries straight away without Editorial Workflow', async () => {
    await expect(
      deleteOrDiscardEntries({
        items: [
          { entry: entryA, assets: [assetA] },
          { entry: entryB, assets: [] },
        ],
        collection,
        useWorkflow: false,
      }),
    ).resolves.toBeUndefined();
    expect(deleteEntries).toHaveBeenCalledWith([entryA, entryB], [assetA]);
    expect(deleteWorkflowEntries).not.toHaveBeenCalled();
    expect(discardWorkflowEntries).not.toHaveBeenCalled();
  });

  test('deletes the published entries straight away without a collection', async () => {
    await expect(
      deleteOrDiscardEntries({ items: [{ entry: entryA, assets: [] }], useWorkflow: true }),
    ).resolves.toBeUndefined();
    expect(deleteEntries).toHaveBeenCalledWith([entryA], []);
    expect(deleteWorkflowEntries).not.toHaveBeenCalled();
  });

  test('passes on a failure', async () => {
    vi.mocked(discardWorkflowEntries).mockRejectedValue(new Error('Boom'));

    await expect(
      deleteOrDiscardEntries({
        drafts: [draft],
        items: [{ entry: entryA, assets: [] }],
        useWorkflow: false,
      }),
    ).rejects.toThrow('Boom');
  });

  test('discards no draft when the user cancels the commit of the deletion', async () => {
    vi.mocked(deleteEntries).mockRejectedValue(new Error('commit_cancelled'));

    await expect(
      deleteOrDiscardEntries({
        drafts: [draft],
        items: [{ entry: entryA, assets: [] }],
        useWorkflow: false,
      }),
    ).rejects.toThrow('commit_cancelled');
    expect(discardWorkflowEntries).not.toHaveBeenCalled();

    vi.mocked(deleteWorkflowEntries).mockRejectedValue(new Error('commit_cancelled'));

    await expect(
      deleteOrDiscardEntries({
        drafts: [draft],
        items: [{ entry: entryA, assets: [] }],
        collection,
        useWorkflow: true,
      }),
    ).rejects.toThrow('commit_cancelled');
    expect(discardWorkflowEntries).not.toHaveBeenCalled();
  });

  test('deletes the draft backups of the discarded and deleted entries', async () => {
    await deleteOrDiscardEntries({
      drafts: [draft],
      items: [{ entry: entryA, assets: [] }],
      collection,
      useWorkflow: false,
    });
    expect(cancelBackup).toHaveBeenCalled();
    expect(deleteBackup).toHaveBeenCalledTimes(2);
    expect(deleteBackup).toHaveBeenCalledWith('posts', 'draft');
    expect(deleteBackup).toHaveBeenCalledWith('posts', 'a');
  });

  test('deletes the draft backups of the entries whose deletion is requested', async () => {
    await deleteOrDiscardEntries({
      items: [
        { entry: entryA, assets: [] },
        { entry: entryB, assets: [] },
      ],
      collection,
      useWorkflow: true,
    });
    expect(deleteBackup).toHaveBeenCalledWith('posts', 'a');
    expect(deleteBackup).toHaveBeenCalledWith('posts', 'b');
  });

  test('deletes the draft backup of a collection file under its name', async () => {
    await deleteOrDiscardEntries({
      items: [{ entry: entryA, assets: [] }],
      collection,
      collectionFile,
      useWorkflow: false,
    });
    expect(deleteBackup).toHaveBeenCalledWith('posts', 'about');
  });

  test('leaves the draft backups alone without a collection', async () => {
    await deleteOrDiscardEntries({ items: [{ entry: entryA, assets: [] }], useWorkflow: false });
    expect(cancelBackup).toHaveBeenCalled();
    expect(deleteBackup).not.toHaveBeenCalled();
  });

  test('leaves the draft backups alone when the deletion fails', async () => {
    vi.mocked(deleteEntries).mockRejectedValue(new Error('Boom'));

    await expect(
      deleteOrDiscardEntries({
        items: [{ entry: entryA, assets: [] }],
        collection,
        useWorkflow: false,
      }),
    ).rejects.toThrow('Boom');
    expect(deleteBackup).not.toHaveBeenCalled();
  });

  test('ignores a draft backup that can’t be deleted', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(deleteBackup).mockRejectedValue(new Error('Boom'));

    await expect(
      deleteOrDiscardEntries({
        items: [{ entry: entryA, assets: [] }],
        collection,
        useWorkflow: false,
      }),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
