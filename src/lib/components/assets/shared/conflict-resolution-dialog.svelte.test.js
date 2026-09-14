import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { duplicates } from '$lib/services/contents/fields/file/duplicates.svelte';

import ConflictResolutionDialog from './conflict-resolution-dialog.svelte';

describe('ConflictResolutionDialog', () => {
  test('offers to replace the duplicate, keep both, or cancel', async () => {
    const resolve = vi.fn();

    Object.assign(duplicates, { count: 1, name: 'photo.png', showDialog: true, resolve });

    await render(ConflictResolutionDialog, {});

    const dialog = page.getByRole('alertdialog', { name: 'File Name Conflict Resolution' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'File Name Conflict Resolution A file named “\u2068photo.png\u2069” already exists in this folder. Do you want to replace it? Replace Keep Both Cancel',
      );

    await dialog.getByRole('button', { name: 'Keep Both' }).click();
    expect(resolve).toHaveBeenCalledWith(false);

    duplicates.showDialog = true;
    await dialog.getByRole('button', { name: 'Replace' }).click();
    expect(resolve).toHaveBeenCalledWith(true);

    duplicates.showDialog = true;
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(resolve).toHaveBeenCalledWith(undefined);

    // Dismissing the dialog with the Escape key cancels as well
    resolve.mockClear();
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(undefined));
    await expect.poll(() => duplicates.showDialog).toBe(false);
  });
});
