import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import SaveConflictDialog from './save-conflict-dialog.svelte';

describe('SaveConflictDialog', () => {
  test('offers to save over a change', async () => {
    const onOverwrite = vi.fn(async () => {});
    const onClose = vi.fn();

    await render(SaveConflictDialog, {
      open: true,
      conflict: { type: 'deleted', canOverwrite: true },
      onOverwrite,
      onClose,
    });

    const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

    await expect
      .element(dialog)
      .toMatchTextContent(
        'This entry has been deleted from the repository after you opened it. If you save now, the entry will be created again.',
      );
    await dialog.getByRole('button', { name: 'Save Anyway' }).click();

    await vi.waitFor(() => expect(onOverwrite).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('only tells what happened when the entry can’t be saved over the change', async () => {
    await render(SaveConflictDialog, {
      open: true,
      conflict: { type: 'deleted', canOverwrite: false },
      onOverwrite: vi.fn(),
      onClose: vi.fn(),
    });

    const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

    await expect.element(dialog).toMatchTextContent('it can’t be saved over the change');
    expect(dialog.getByRole('button', { name: 'Save Anyway' }).elements()).toHaveLength(0);
  });
});
