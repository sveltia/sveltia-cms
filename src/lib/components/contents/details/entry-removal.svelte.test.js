import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { deleteOrDiscardEntries } from '$lib/services/workflow/delete';
import { discardWorkflowEntry } from '$lib/services/workflow/save';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';
import { waitForToastsToHide } from '$lib/test/toast';

import EntryRemoval from './entry-removal.svelte';

vi.mock('$lib/services/workflow/delete', () => ({ deleteOrDiscardEntries: vi.fn() }));
vi.mock('$lib/services/workflow/save', () => ({ discardWorkflowEntry: vi.fn() }));

const entry = /** @type {any} */ ({ id: 'hello', slug: 'hello' });
const unpublishedEntry = /** @type {any} */ ({ ...entry, workflow: { status: 'draft' } });

/**
 * Render the component for an existing entry.
 * @param {Record<string, any>} [props] Props.
 * @returns {Promise<{ component: any, props: Record<string, any> }>} Component and props.
 */
const renderRemoval = async (props = {}) => {
  const draft = createMockDraft({
    fields: [{ name: 'title', widget: 'string' }],
    values: { _default: { title: 'Hello' } },
    draft: { isNew: false },
  });

  const allProps = $state({
    deleting: false,
    collection: draft.collection,
    collectionFile: undefined,
    originalEntry: entry,
    unpublishedEntry: undefined,
    associatedAssets: [],
    discardsDraft: false,
    useWorkflow: false,
    pendingDeletion: false,
    onDone: vi.fn(),
    onClose: vi.fn(),
    ...props,
  });

  const { component } = await renderWithDraft(EntryRemoval, { draft, props: allProps });

  return { component, props: allProps };
};

describe('EntryRemoval', () => {
  beforeEach(() => {
    contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE };
  });

  test('deletes the entry once confirmed, then closes the editor', async () => {
    vi.mocked(deleteOrDiscardEntries).mockResolvedValue({ deleted: true });

    const { component, props } = await renderRemoval();

    component.confirmDelete();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() => expect(props.onDone).toHaveBeenCalledOnce());
    expect(deleteOrDiscardEntries).toHaveBeenCalledWith({
      drafts: [],
      items: [{ entry, assets: [] }],
      collection: props.collection,
      collectionFile: undefined,
      useWorkflow: false,
    });
    expect(contentUpdatesToast.current).toMatchObject({ count: 1, deleted: true });
    expect(props.deleting).toBe(false);
    await vi.waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  test('discards an entry that has never been published', async () => {
    vi.mocked(deleteOrDiscardEntries).mockResolvedValue(undefined);

    const { component, props } = await renderRemoval({ unpublishedEntry, discardsDraft: true });

    component.confirmDelete();
    await page
      .getByRole('alertdialog', { name: 'Delete Entry' })
      .getByRole('button', { name: 'Delete' })
      .click();

    await vi.waitFor(() => expect(props.onDone).toHaveBeenCalledOnce());
    expect(deleteOrDiscardEntries).toHaveBeenCalledWith(
      expect.objectContaining({ drafts: [unpublishedEntry], items: [] }),
    );
    expect(contentUpdatesToast.current).toEqual(UPDATE_TOAST_DEFAULT_STATE);
  });

  test('discards the unpublished changes once confirmed', async () => {
    vi.mocked(discardWorkflowEntry).mockResolvedValue(undefined);

    const { component, props } = await renderRemoval({ unpublishedEntry });

    component.confirmDiscard();

    const dialog = page.getByRole('alertdialog', { name: 'Discard Changes' });

    await dialog.getByRole('button', { name: 'Discard' }).click();

    await vi.waitFor(() => expect(props.onDone).toHaveBeenCalledOnce());
    expect(discardWorkflowEntry).toHaveBeenCalledWith(unpublishedEntry);
    expect(contentUpdatesToast.current).toMatchObject({ count: 1, discarded: true });
  });

  test('calls off a pending deletion', async () => {
    vi.mocked(discardWorkflowEntry).mockResolvedValue(undefined);

    const { component, props } = await renderRemoval({ unpublishedEntry, pendingDeletion: true });

    component.confirmDiscard();

    const dialog = page.getByRole('alertdialog', { name: 'Cancel Deletion' });

    await dialog.getByRole('button', { name: 'Cancel Deletion' }).click();

    await vi.waitFor(() => expect(props.onDone).toHaveBeenCalledOnce());
    expect(contentUpdatesToast.current).toMatchObject({ deletionCancelled: true });
  });

  test('reports a failure and leaves the editor open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(deleteOrDiscardEntries).mockRejectedValue(new Error('Boom'));

    const { component, props } = await renderRemoval();

    component.confirmDelete();
    await page
      .getByRole('alertdialog', { name: 'Delete Entry' })
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect
      .element(page.getByRole('alert').filter({ hasText: 'Couldn’t delete the entry' }))
      .toBeVisible();
    expect(props.onDone).not.toHaveBeenCalled();
    expect(props.deleting).toBe(false);
    expect(contentUpdatesToast.current).toEqual(UPDATE_TOAST_DEFAULT_STATE);

    await waitForToastsToHide();
  });
});
