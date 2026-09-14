import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backupToastState, restoreDialogState } from '$lib/services/contents/draft/backup';
import { showContentOverlay } from '$lib/services/contents/editor';
import { waitForToastsToHide } from '$lib/test/toast';

import BackupFeedback from './backup-feedback.svelte';

describe('BackupFeedback', () => {
  beforeEach(() => {
    showContentOverlay.current = true;
    restoreDialogState.current = { show: false };
    backupToastState.current = { saved: false, restored: false, deleted: false };
  });

  test('asks whether to restore a backup made today', async () => {
    const resolve = vi.fn();
    const timestamp = new Date();

    timestamp.setUTCHours(10, 30, 0, 0);

    await render(BackupFeedback);

    restoreDialogState.current = { show: true, timestamp, resolve };

    const dialog = page.getByRole('alertdialog', { name: 'Restore Draft' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Restore Draft This entry has a backup from \u206810:30 AM\u2069. Do you want to restore the edited draft? Restore Discard',
      );

    await dialog.getByRole('button', { name: 'Restore' }).click();
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(true));
  });

  test('shows the date of an older backup, and can discard it', async () => {
    const resolve = vi.fn();
    const timestamp = new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 15, 10, 30));

    await render(BackupFeedback);

    restoreDialogState.current = { show: true, timestamp, resolve };

    const dialog = page.getByRole('alertdialog', { name: 'Restore Draft' });
    const datetime = `Jan 15, ${timestamp.getUTCFullYear()}, 10:30 AM`;

    await expect
      .element(dialog)
      .toHaveTextContent(
        `Restore Draft This entry has a backup from \u2068${datetime}\u2069. ` +
          'Do you want to restore the edited draft? Restore Discard',
      );

    await dialog.getByRole('button', { name: 'Discard' }).click();
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(false));
  });

  test('closes the dialog along with the editor', async () => {
    const resolve = vi.fn();

    await render(BackupFeedback);

    restoreDialogState.current = { show: true, timestamp: new Date(), resolve };
    await expect.element(page.getByRole('alertdialog')).toBeInTheDocument();

    showContentOverlay.current = false;
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith());
    expect(restoreDialogState.current.show).toBe(false);
  });

  test('reports a saved, restored or deleted backup', async () => {
    await render(BackupFeedback);

    backupToastState.current.saved = true;
    await expect.element(page.getByRole('alert')).toHaveTextContent('info Draft backup saved.');
    // The toast goes away on its own, resetting the state
    await waitForToastsToHide();
    expect(backupToastState.current.saved).toBe(false);

    backupToastState.current = { saved: false, restored: true, deleted: false };
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('check_circle Draft backup restored.');
    await waitForToastsToHide();

    backupToastState.current = { saved: false, restored: false, deleted: true };
    await expect.element(page.getByRole('alert')).toHaveTextContent('info Draft backup deleted.');
    await waitForToastsToHide();
  }, 30000);
});
