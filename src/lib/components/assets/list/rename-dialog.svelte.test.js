import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { showAssetOverlay } from '$lib/services/assets/view';
import { waitForRenameDialog } from '$lib/test/dialog';

import RenameDialog from './rename-dialog.svelte';

/**
 * Render the dialog.
 * @param {Record<string, any>} [props] Props to override.
 * @returns {Promise<{ props: any, onRename: any, onClose: any }>} Props and handlers.
 */
const renderDialog = async (props = {}) => {
  const onRename = vi.fn();
  const onClose = vi.fn();

  const _props = $state({
    open: true,
    name: 'photo.png',
    otherNames: ['logo.png'],
    onRename,
    onClose,
    ...props,
  });

  await render(RenameDialog, _props);

  return { props: _props, onRename, onClose };
};

describe('RenameDialog', () => {
  beforeEach(() => {
    showAssetOverlay.current = true;
  });

  test('renames the asset', async () => {
    const { onRename } = await renderDialog({ usedEntryCount: 2 });
    const dialog = page.getByRole('dialog', { name: 'Rename \u2068photo.png\u2069' });

    await expect
      .element(dialog.getByRole('paragraph'))
      .toHaveTextContent('Enter a new name below. 2 entries using the asset will also be updated.');
    // Nothing has changed yet
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();
    await waitForRenameDialog(dialog.getByRole('textbox'), 'photo.png');

    await dialog.getByRole('textbox').fill('picture.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    // The handler runs once the dialog is closed
    await vi.waitFor(() => expect(onRename).toHaveBeenCalledWith('picture.png'));
  });

  test('validates the new name', async () => {
    await renderDialog();

    const dialog = page.getByRole('dialog');
    const textbox = dialog.getByRole('textbox');
    const button = dialog.getByRole('button', { name: 'Rename' });

    // The input is filled in once the dialog is open
    await waitForRenameDialog(textbox, 'photo.png');
    await textbox.fill(' ');
    await expect.element(textbox).toHaveAttribute('aria-invalid', 'true');
    await expect.element(dialog.getByText('File name cannot be empty.')).toBeInTheDocument();
    await expect.element(button).toBeDisabled();

    await textbox.fill('dir/photo.png');
    await expect
      .element(dialog.getByText('File name cannot contain special characters.'))
      .toBeInTheDocument();

    await textbox.fill('logo.png');
    await expect
      .element(dialog.getByText('This file name is used for another asset.'))
      .toBeInTheDocument();

    await textbox.fill('picture.png');
    await expect.element(textbox).toHaveAttribute('aria-invalid', 'false');
    await expect.element(button).toBeEnabled();
  });

  test('asks for confirmation when the extension changes', async () => {
    const { onRename, onClose } = await renderDialog();
    const dialog = page.getByRole('dialog', { name: 'Rename \u2068photo.png\u2069' });

    // Filling the input before the dialog has narrowed the initial selection to the file name would
    // replace that part alone, leaving the extension in place
    await waitForRenameDialog(dialog.getByRole('textbox'), 'photo.png');
    await dialog.getByRole('textbox').fill('photo.webp');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    expect(onRename).not.toHaveBeenCalled();

    const confirmation = page.getByRole('alertdialog');

    await expect.element(confirmation).toBeInTheDocument();

    // Going back keeps the entered name
    await confirmation.getByRole('button', { name: 'Cancel' }).click();
    await waitForRenameDialog(dialog.getByRole('textbox'), 'photo.webp');
    expect(onClose).not.toHaveBeenCalled();

    await dialog.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Rename' }).click();

    await vi.waitFor(() => expect(onRename).toHaveBeenCalledWith('photo.webp'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('selects the file name without the extension when the dialog opens', async () => {
    await renderDialog();

    const textbox = page.getByRole('dialog').getByRole('textbox');

    // The dialog selects the whole input value, which is then narrowed to the file name
    await expect.element(textbox).toHaveFocus();
    await expect
      .poll(() => /** @type {HTMLInputElement} */ (textbox.element()).selectionEnd)
      .toBe('photo'.length);
  });

  test('closes along with the asset details overlay', async () => {
    const { props, onClose } = await renderDialog();

    await expect.element(page.getByRole('dialog')).toBeInTheDocument();

    showAssetOverlay.current = false;

    await expect.poll(() => props.open).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });
});
