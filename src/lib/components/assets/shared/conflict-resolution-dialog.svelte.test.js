import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { duplicatesRequest } from '$lib/services/contents/fields/file/duplicates.svelte';

import ConflictResolutionDialog from './conflict-resolution-dialog.svelte';

describe('ConflictResolutionDialog', () => {
  test('offers to replace the duplicate, keep both, or cancel', async () => {
    const respond = vi.fn(() => {
      duplicatesRequest.current = undefined;
    });

    /**
     * Put up a request for the given file name.
     */
    const request = () => {
      duplicatesRequest.current = { count: 1, name: 'photo.png', respond };
    };

    request();
    await render(ConflictResolutionDialog, {});

    const dialog = page.getByRole('alertdialog', { name: 'File Name Conflict Resolution' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'File Name Conflict Resolution A file named “\u2068photo.png\u2069” already exists in this folder. Do you want to replace it? Replace Keep Both Cancel',
      );

    await dialog.getByRole('button', { name: 'Keep Both' }).click();
    expect(respond).toHaveBeenCalledWith(false);
    await expect.element(dialog).not.toBeInTheDocument();

    request();
    await dialog.getByRole('button', { name: 'Replace' }).click();
    expect(respond).toHaveBeenCalledWith(true);

    request();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(respond).toHaveBeenCalledWith(undefined);

    // Dismissing the dialog with the Escape key cancels as well
    request();
    await expect.element(dialog).toBeVisible();
    respond.mockClear();
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(undefined));
    expect(duplicatesRequest.current).toBeUndefined();
  });
});
