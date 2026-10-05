import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { showAssetOverlay } from '$lib/services/assets/view';
import { expectFileNameSelected } from '$lib/test/dialog';

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
    await expectFileNameSelected(dialog.getByRole('textbox'), 'photo.png');

    await dialog.getByRole('textbox').fill('picture.png');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    // The handler runs once the dialog is closed
    await vi.waitFor(() => expect(onRename).toHaveBeenCalledWith('picture.png'));
  });

  test('slugifies the new name, showing it below the input', async () => {
    const { onRename } = await renderDialog({
      slugificationEnabled: true,
      otherNames: ['logo.png', 'old-logo.png'],
    });

    const dialog = page.getByRole('dialog');
    const textbox = dialog.getByRole('textbox');
    const button = dialog.getByRole('button', { name: 'Rename' });

    await expectFileNameSelected(textbox, 'photo.png');
    // The current name is already a slug, so there’s nothing to show
    await expect.element(dialog.getByRole('status')).not.toBeInTheDocument();

    // A name that slugifies to the current one doesn’t change anything
    await textbox.fill('Photo.PNG');
    await expect
      .element(dialog.getByRole('status'))
      .toHaveTextContent('The file will be saved as “\u2068photo.png\u2069”.');
    await expect.element(button).toBeDisabled();

    await textbox.fill(' ');
    await expect.element(dialog.getByText('File name cannot be empty.')).toBeInTheDocument();

    // Nor can it take the name of another asset once slugified
    await textbox.fill('Old Logo.png');
    await expect
      .element(dialog.getByText('This file name is used for another asset.'))
      .toBeInTheDocument();
    await expect.element(dialog.getByRole('status')).not.toBeInTheDocument();
    await expect.element(button).toBeDisabled();

    await textbox.fill('Blog Photo 1.png');
    await expect
      .element(dialog.getByRole('status'))
      .toHaveTextContent('The file will be saved as “\u2068blog-photo-1.png\u2069”.');
    await button.click();

    await vi.waitFor(() => expect(onRename).toHaveBeenCalledWith('blog-photo-1.png'));
  });

  test('explains why the asset can’t be renamed, and refuses the rename', async () => {
    await renderDialog({ blockedMessage: 'A read-only entry uses it.' });

    const dialog = page.getByRole('dialog');

    await expect.element(dialog.getByRole('alert')).toHaveTextContent('A read-only entry uses it.');
    await expect.element(dialog.getByRole('textbox')).toBeDisabled();
    await expect.element(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  test('validates the new name', async () => {
    await renderDialog();

    const dialog = page.getByRole('dialog');
    const textbox = dialog.getByRole('textbox');
    const button = dialog.getByRole('button', { name: 'Rename' });

    // The input is filled in once the dialog is open
    await expectFileNameSelected(textbox, 'photo.png');
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
    await expectFileNameSelected(dialog.getByRole('textbox'), 'photo.png');
    await dialog.getByRole('textbox').fill('photo.webp');
    await dialog.getByRole('button', { name: 'Rename' }).click();

    expect(onRename).not.toHaveBeenCalled();

    const confirmation = page.getByRole('alertdialog');

    await expect.element(confirmation).toBeInTheDocument();

    // Going back keeps the entered name
    await confirmation.getByRole('button', { name: 'Cancel' }).click();
    await expectFileNameSelected(dialog.getByRole('textbox'), 'photo.webp');
    expect(onClose).not.toHaveBeenCalled();

    await dialog.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Rename' }).click();

    await vi.waitFor(() => expect(onRename).toHaveBeenCalledWith('photo.webp'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('selects the file name without the extension when the dialog opens', async () => {
    await renderDialog();

    const textbox = page.getByRole('dialog').getByRole('textbox');

    await expect.element(textbox).toHaveFocus();
    await expect
      .poll(() => /** @type {HTMLInputElement} */ (textbox.element()).selectionEnd)
      .toBe('photo'.length);
  });

  test('leaves a selection made by the user alone', async () => {
    await renderDialog();

    const textbox = page.getByRole('dialog').getByRole('textbox');
    const input = /** @type {HTMLInputElement} */ (textbox.element());

    // A quick user selects the whole name and types over it as soon as the dialog opens, before
    // the browser has reported the selection
    await expect.element(textbox).toHaveValue('photo.png');
    input.focus();
    input.select();
    await userEvent.keyboard('picture.png');
    await expect.element(textbox).toHaveValue('picture.png');
  });

  test('closes along with the asset details overlay', async () => {
    const { props, onClose } = await renderDialog();

    await expect.element(page.getByRole('dialog')).toBeInTheDocument();

    showAssetOverlay.current = false;

    await expect.poll(() => props.open).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });
});
