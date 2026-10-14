import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import DataPanel from './data-panel.svelte';

describe('DataPanel', () => {
  test('asks for confirmation before clearing the data', async () => {
    await render(DataPanel, {});
    await page.getByRole('button', { name: 'Clear File Cache' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Clear File Cache' });

    await expect.element(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.element(dialog).not.toBeInTheDocument();

    await page.getByRole('button', { name: 'Erase All Data' }).click();

    const eraseDialog = page.getByRole('alertdialog', { name: 'Erase All Data' });

    await expect.element(eraseDialog).toBeVisible();
    await eraseDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.element(eraseDialog).not.toBeInTheDocument();
  });

  test('explains what clearing the data does before it’s confirmed', async () => {
    await render(DataPanel, {});
    await page.getByRole('button', { name: 'Clear File Cache' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Clear File Cache' });

    await expect
      .element(dialog)
      .toMatchTextContent('Your unsaved drafts and settings will be kept');
    await expect
      .element(dialog.getByRole('button', { name: 'Clear File Cache' }))
      .toBeInTheDocument();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.element(dialog).not.toBeInTheDocument();

    await page.getByRole('button', { name: 'Erase All Data' }).click();

    const eraseDialog = page.getByRole('alertdialog', { name: 'Erase All Data' });

    await expect.element(eraseDialog).toMatchTextContent('you’ll have to sign in again');
    await expect
      .element(eraseDialog.getByRole('button', { name: 'Erase All Data' }))
      .toBeInTheDocument();
    await eraseDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.element(eraseDialog).not.toBeInTheDocument();
  });
});
