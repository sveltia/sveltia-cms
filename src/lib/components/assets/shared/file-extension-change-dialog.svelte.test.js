import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import FileExtensionChangeDialog from './file-extension-change-dialog.svelte';

describe('FileExtensionChangeDialog', () => {
  test('confirms changing the extension', async () => {
    const onOk = vi.fn();

    await render(FileExtensionChangeDialog, {
      open: true,
      oldExtension: 'jpg',
      newExtension: 'png',
      okLabel: 'Rename',
      onOk,
    });

    const dialog = page.getByRole('alertdialog', { name: 'Change File Extension' });

    await expect
      .element(dialog.getByText(/change the extension/))
      .toHaveTextContent(
        'Are you sure you want to change the extension from “.\u2068jpg\u2069” to “.\u2068png\u2069”?',
      );
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await vi.waitFor(() => expect(onOk).toHaveBeenCalledOnce());
  });

  test('words adding or removing an extension', async () => {
    const add = await render(FileExtensionChangeDialog, { open: true, newExtension: 'png' });

    await expect
      .element(page.getByRole('alertdialog').getByText(/add the extension/))
      .toHaveTextContent('Are you sure you want to add the extension “.\u2068png\u2069”?');
    await add.unmount();

    await render(FileExtensionChangeDialog, { open: true, oldExtension: 'jpg' });
    await expect
      .element(page.getByRole('alertdialog').getByText(/remove the extension/))
      .toHaveTextContent('Are you sure you want to remove the extension “.\u2068jpg\u2069”?');
  });

  test('warns about the consequence, and reports when cancelled', async () => {
    const onOk = vi.fn();
    const onCancel = vi.fn();

    const props = $state({
      open: true,
      oldExtension: 'jpg',
      newExtension: 'png',
      okLabel: 'Rename',
      onOk,
      onCancel,
    });

    await render(FileExtensionChangeDialog, props);

    const dialog = page.getByRole('alertdialog', { name: 'Change File Extension' });

    await expect
      .element(dialog.getByText(/may not be displayed/))
      .toHaveTextContent(
        'The file may not be displayed or handled correctly if the extension doesn’t match the actual file format.',
      );
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
    expect(onOk).not.toHaveBeenCalled();
    await expect.poll(() => props.open).toBe(false);
  });

  test('opens with the bound prop, and updates the wording', async () => {
    /** @type {{ open: boolean, oldExtension: string, newExtension?: string }} */
    const props = $state({ open: false, oldExtension: 'jpg', newExtension: 'png' });

    await render(FileExtensionChangeDialog, props);
    expect(page.getByRole('alertdialog').elements()).toHaveLength(0);

    props.open = true;

    const dialog = page.getByRole('alertdialog', { name: 'Change File Extension' });

    await expect.element(dialog.getByText(/change the extension/)).toBeVisible();

    // Dropping the new extension turns the change into a removal
    props.newExtension = undefined;
    await expect
      .element(dialog.getByText(/remove the extension/))
      .toHaveTextContent('Are you sure you want to remove the extension “.\u2068jpg\u2069”?');
  });
});
