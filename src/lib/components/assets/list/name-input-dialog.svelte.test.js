import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
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
    const props = await renderDialog({ warning: 'Links will break.', oninput });
    const dialog = page.getByRole('dialog', { name: 'Name' });
    const textbox = dialog.getByRole('textbox', { name: 'File Name' });

    await expect.element(dialog.getByText('Enter a name.')).toBeVisible();
    await expect.element(dialog.getByRole('alert')).toHaveTextContent('Links will break.');
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
    await renderDialog({ blockedMessage: 'The file is in use.', warning: 'Links will break.' });

    const dialog = page.getByRole('dialog', { name: 'Name' });

    await expect.element(dialog.getByRole('alert')).toHaveTextContent('The file is in use.');
    expect(dialog.getByText('Enter a name.').elements()).toHaveLength(0);
    expect(dialog.getByText('Links will break.').elements()).toHaveLength(0);
    await expect.element(dialog.getByRole('textbox')).toBeDisabled();
  });
});
