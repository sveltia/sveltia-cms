import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import DeleteEntryDialog from './delete-entry-dialog.svelte';

/**
 * Render the dialog for an existing entry.
 * @param {Record<string, any>} props Props.
 * @returns {Promise<void>} Promise.
 */
const renderDialog = async (props) => {
  const draft = createMockDraft({
    fields: [{ name: 'title', widget: 'string' }],
    values: { _default: { title: 'Hello' } },
    draft: { isNew: false },
  });

  await renderWithDraft(DeleteEntryDialog, {
    draft,
    props: {
      open: true,
      discardsDraft: false,
      useWorkflow: false,
      withAssets: false,
      onOk: vi.fn(async () => {}),
      onClose: vi.fn(),
      ...props,
    },
  });
};

describe('DeleteEntryDialog', () => {
  test('confirms the deletion of an entry', async () => {
    const onOk = vi.fn(async () => {});

    await renderDialog({ onOk });

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

    await expect
      .element(dialog)
      .toHaveTextContent('Delete Entry Are you sure you want to delete this entry? Delete Cancel');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() => expect(onOk).toHaveBeenCalledOnce());
  });

  test('mentions the assets deleted along with the entry', async () => {
    await renderDialog({ withAssets: true });

    await expect
      .element(page.getByRole('alertdialog'))
      .toMatchTextContent('Are you sure you want to delete this entry and associated assets?');
  });

  test('explains the deletion of an entry with Editorial Workflow', async () => {
    await renderDialog({ useWorkflow: true });

    await expect
      .element(page.getByRole('alertdialog'))
      .toMatchTextContent('It won’t be removed until the deletion is published.');
  });

  test('explains the deletion of an entry that has never been published', async () => {
    await renderDialog({ discardsDraft: true, useWorkflow: true });

    await expect
      .element(page.getByRole('alertdialog'))
      .toMatchTextContent(
        'This entry hasn’t been published yet, so deleting it will discard it completely.',
      );
  });
});
