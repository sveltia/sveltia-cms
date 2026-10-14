import { flushSync } from 'svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import {
  saveBulkEdits,
  validateBulkEdits,
} from '$lib/services/contents/collection/entries/bulk-edit';
import {
  bulkEditedEntries,
  bulkEditErrors,
  bulkEditing,
  bulkEdits,
  setBulkEditMode,
} from '$lib/services/contents/collection/view';
import { createMockEntry, initTestConfig } from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import BulkEditControls from './bulk-edit-controls.svelte';

vi.mock('$lib/services/contents/collection/entries/bulk-edit', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  saveBulkEdits: vi.fn(),
  validateBulkEdits: vi.fn(),
}));

describe('BulkEditControls', () => {
  const entry = createMockEntry({ slug: 'a', content: { _default: { title: 'A' } } });

  beforeEach(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          bulk_edit: true,
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
    });
    selectedCollection.current = getCollection('posts');
    // Let the root effect reacting to the collection run before the mode is entered
    flushSync();
    setBulkEditMode(true);
    bulkEditedEntries.current = [entry];
    vi.mocked(validateBulkEdits).mockReturnValue({});
    vi.mocked(saveBulkEdits).mockResolvedValue(1);
  });

  test('shows the number of changes, and only allows saving once something has changed', async () => {
    await render(BulkEditControls, {});

    const status = page.getByRole('status');
    const save = page.getByRole('button', { name: 'Save Bulk Edits' });

    await expect.element(status).toHaveTextContent('No changes');
    await expect.element(save).toHaveAttribute('aria-disabled', 'true');

    bulkEdits.current = { [entry.id]: { title: 'B' } };
    await expect.element(status).toHaveTextContent('1 change');
    await expect.element(save).toHaveAttribute('aria-disabled', 'false');

    bulkEdits.current = { [entry.id]: { title: 'B' }, other: { title: 'C' } };
    await expect.element(status).toHaveTextContent('2 changes');
  });

  test('validates the edits before saving, and reports the invalid ones', async () => {
    const errors = { [entry.id]: { title: ['This field is required.'] } };

    vi.mocked(validateBulkEdits).mockReturnValue(errors);
    bulkEdits.current = { [entry.id]: { title: '' } };

    await render(BulkEditControls, {});
    await page.getByRole('button', { name: 'Save Bulk Edits' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'error Error Some of the values aren’t valid. Fix the highlighted fields and try again.',
      );
    expect(validateBulkEdits).toHaveBeenCalledWith({
      collection: getCollection('posts'),
      entries: [entry],
      edits: { [entry.id]: { title: '' } },
    });
    expect(bulkEditErrors.current).toEqual(errors);
    expect(saveBulkEdits).not.toHaveBeenCalled();
    expect(bulkEditing.current).toBe(true);
    await waitForToastsToHide();
  });

  test('saves the edits and leaves the mode', async () => {
    const onExit = vi.fn();

    bulkEdits.current = { [entry.id]: { title: 'B' } };

    await render(BulkEditControls, { onExit });
    await page.getByRole('button', { name: 'Save Bulk Edits' }).click();

    await vi.waitFor(() => expect(onExit).toHaveBeenCalledOnce());
    expect(saveBulkEdits).toHaveBeenCalledWith({
      collection: getCollection('posts'),
      entries: [entry],
      edits: { [entry.id]: { title: 'B' } },
    });
    expect(bulkEditing.current).toBe(false);
    expect(bulkEdits.current).toEqual({});
  });

  test('reports a failure, and gives the focus back to the Save button', async () => {
    // Take long enough for the browser to drop the focus of the button disabled meanwhile
    vi.mocked(saveBulkEdits).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('Boom')), 200);
        }),
    );

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    bulkEdits.current = { [entry.id]: { title: 'B' } };

    await render(BulkEditControls, {});

    const save = page.getByRole('button', { name: 'Save Bulk Edits' });

    await save.click();
    await expect.element(save).toHaveAttribute('aria-disabled', 'true');
    await expect
      .element(page.getByRole('button', { name: 'Cancel Bulk Edits' }))
      .toHaveAttribute('aria-disabled', 'true');

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Error Failed to save the changes. Please try again.');
    expect(error).toHaveBeenCalledOnce();
    expect(bulkEditing.current).toBe(true);
    await expect.element(save).toHaveFocus();
    await expect.element(save).toHaveAttribute('aria-disabled', 'false');
    await waitForToastsToHide();
  });

  test('stays in the mode quietly when the commit is cancelled', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Take long enough for the browser to drop the focus of the button disabled meanwhile
    vi.mocked(saveBulkEdits).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('commit_cancelled')), 200);
        }),
    );
    bulkEdits.current = { [entry.id]: { title: 'B' } };

    await render(BulkEditControls, {});

    const save = page.getByRole('button', { name: 'Save Bulk Edits' });

    await save.click();
    await expect.element(save).toHaveFocus();
    await expect.element(save).toBeEnabled();
    expect(bulkEditing.current).toBe(true);
    expect(bulkEdits.current).toEqual({ [entry.id]: { title: 'B' } });
    expect(page.getByRole('alert').elements()).toHaveLength(0);
    expect(error).not.toHaveBeenCalled();
  });

  test('leaves the mode right away when cancelled with nothing changed', async () => {
    const onExit = vi.fn();

    await render(BulkEditControls, { onExit });
    await page.getByRole('button', { name: 'Cancel Bulk Edits' }).click();

    expect(bulkEditing.current).toBe(false);
    expect(onExit).toHaveBeenCalledOnce();
    expect(page.getByRole('alertdialog').elements()).toHaveLength(0);
  });

  test('leaves the mode without a parent to tell', async () => {
    await render(BulkEditControls, {});
    await page.getByRole('button', { name: 'Cancel Bulk Edits' }).click();

    expect(bulkEditing.current).toBe(false);
  });

  test('asks before discarding the changes when cancelled', async () => {
    const onExit = vi.fn();

    bulkEdits.current = { [entry.id]: { title: 'B' } };

    await render(BulkEditControls, { onExit });

    const cancel = page.getByRole('button', { name: 'Cancel Bulk Edits' });

    await cancel.click();

    const dialog = page.getByRole('alertdialog', { name: 'Cancel Bulk Edits' });

    await expect.element(dialog).toBeVisible();
    await expect.element(dialog).toMatchTextContent('Discard the changes made to the entries?');

    // Keep editing
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(bulkEditing.current).toBe(true);
    expect(onExit).not.toHaveBeenCalled();

    // Discard the changes
    await cancel.click();
    await page
      .getByRole('alertdialog', { name: 'Cancel Bulk Edits' })
      .getByRole('button', { name: 'Discard' })
      .click();
    await vi.waitFor(() => expect(onExit).toHaveBeenCalledOnce());
    expect(bulkEditing.current).toBe(false);
    expect(bulkEdits.current).toEqual({});
    expect(saveBulkEdits).not.toHaveBeenCalled();
  });

  test('takes the focus on the Save button once something has changed', async () => {
    const { component } = await render(BulkEditControls, {});

    // The Save button is disabled until then
    component.focus();
    await expect.element(page.getByRole('button', { name: 'Cancel Bulk Edits' })).toHaveFocus();

    bulkEdits.current = { [entry.id]: { title: 'B' } };
    await expect.element(page.getByRole('button', { name: 'Save Bulk Edits' })).toBeEnabled();
    component.focus();
    await expect.element(page.getByRole('button', { name: 'Save Bulk Edits' })).toHaveFocus();
  });
});
