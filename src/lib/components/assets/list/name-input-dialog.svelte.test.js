import { flushSync } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import NameInputDialog from './name-input-dialog.svelte';

/**
 * Render the dialog, open.
 * @param {Record<string, any>} [overrides] Props to override.
 * @returns {Promise<Record<string, any>>} Props, a `$state` that follows the dialog.
 */
const renderDialog = async (overrides = {}) => {
  const props = $state({
    open: true,
    title: 'Name',
    okLabel: 'Save',
    okDisabled: false,
    onOk: vi.fn(),
    description: 'Enter a name.',
    value: 'a.png',
    ariaLabel: 'File Name',
    element: undefined,
    ...overrides,
  });

  await render(NameInputDialog, props);

  return props;
};

describe('NameInputDialog', () => {
  test('asks for a name, binding the value, and reports the note and the error', async () => {
    const oninput = vi.fn();
    const props = await renderDialog({ oninput });
    const dialog = page.getByRole('dialog', { name: 'Name' });
    const textbox = dialog.getByRole('textbox', { name: 'File Name' });

    await expect.element(dialog.getByText('Enter a name.')).toBeVisible();
    expect(dialog.getByRole('alert').elements()).toHaveLength(0);
    await expect.element(textbox).toHaveValue('a.png');
    await expect.element(textbox).toBeEnabled();
    await expect.element(textbox).not.toHaveAttribute('aria-invalid', 'true');
    expect(props.element).toBe(textbox.element());
    expect(dialog.getByRole('status').elements()).toHaveLength(0);

    await textbox.fill('b.png');
    expect(props.value).toBe('b.png');
    expect(oninput).toHaveBeenCalled();

    props.note = 'The file will be saved as “b.png”.';
    props.error = 'Taken.';

    await expect.element(dialog.getByRole('status')).toHaveTextContent(props.note);
    await expect.element(textbox).toHaveAttribute('aria-invalid', 'true');

    const errorId = /** @type {string} */ (textbox.element().getAttribute('aria-errormessage'));

    expect(document.getElementById(errorId)).toHaveTextContent('Taken.');

    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => props.onOk).toHaveBeenCalledOnce();
  });

  test('shows why the name can’t be submitted in place of the description', async () => {
    await renderDialog({ blockedMessage: 'The file is in use.' });

    const dialog = page.getByRole('dialog', { name: 'Name' });

    await expect.element(dialog.getByRole('alert')).toHaveTextContent('The file is in use.');
    expect(dialog.getByText('Enter a name.').elements()).toHaveLength(0);
    await expect.element(dialog.getByRole('textbox')).toBeDisabled();
  });

  test('submits the name with the Enter key, as the OK button does', async () => {
    /** @type {string[]} */
    const calls = [];

    const props = await renderDialog({
      onOk: vi.fn(() => calls.push('ok')),
      onClose: vi.fn(() => calls.push('close')),
    });

    const textbox = page.getByRole('dialog', { name: 'Name' }).getByRole('textbox');

    await textbox.fill('b.png');
    await userEvent.keyboard('{Enter}');

    // The handler runs once the dialog is closed, before the dialog reports it’s closed
    await expect.poll(() => calls).toEqual(['ok', 'close']);
    expect(props.open).toBe(false);
    expect(props.value).toBe('b.png');
    await expect.element(page.getByRole('dialog', { name: 'Name' })).not.toBeInTheDocument();
  });

  test('drops a submission when the dialog is reopened before it has closed', async () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const props = await renderDialog({ onOpen, onClose });
    const dialog = page.getByRole('dialog', { name: 'Name' });

    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledOnce());

    const input = /** @type {HTMLInputElement} */ (dialog.getByRole('textbox').element());

    // Pressed synchronously, so the closing transition can’t finish before the dialog is reopened
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    flushSync();
    expect(props.open).toBe(false);

    // Reopened during the closing transition, the dialog never reports it was closed
    props.open = true;
    flushSync();
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledTimes(2));
    expect(onClose).not.toHaveBeenCalled();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(props.onOk).not.toHaveBeenCalled();
  });

  test('ignores the Enter key while the OK button is disabled', async () => {
    const onClose = vi.fn();
    const props = await renderDialog({ okDisabled: true, onClose });
    const dialog = page.getByRole('dialog', { name: 'Name' });

    await dialog.getByRole('textbox').click();
    await userEvent.keyboard('{Enter}');
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    expect(props.open).toBe(true);
    expect(props.onOk).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await expect.element(dialog).toBeVisible();
  });

  test('ignores the Enter key confirming an IME conversion', async () => {
    const props = await renderDialog();
    const dialog = page.getByRole('dialog', { name: 'Name' });
    const input = /** @type {HTMLInputElement} */ (dialog.getByRole('textbox').element());

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }),
    );
    flushSync();
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    expect(props.open).toBe(true);
    expect(props.onOk).not.toHaveBeenCalled();
    await expect.element(dialog).toBeVisible();
  });
});
