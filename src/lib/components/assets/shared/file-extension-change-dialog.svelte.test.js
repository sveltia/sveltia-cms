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
});
