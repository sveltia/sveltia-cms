import { beforeEach, describe, expect, test, vi } from 'vitest';

import { deleteEntries } from '$lib/services/contents/collection/data/delete';
import { deleteOrDiscardEntries } from '$lib/services/workflow/delete';
import { deleteWorkflowEntries, discardWorkflowEntries } from '$lib/services/workflow/save';

vi.mock('$lib/services/contents/collection/data/delete', () => ({ deleteEntries: vi.fn() }));
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
    expect(deleteEntries).not.toHaveBeenCalled();
  });
});
