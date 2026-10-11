import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { initTestConfig } from '$lib/test/config';

import SubfolderNameDialog from './subfolder-name-dialog.svelte';

describe('SubfolderNameDialog', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  test('asks for a new name, validating it once typed, and hands over the formatted name', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    const props = $state({
      open: false,
      title: 'New Folder',
      okLabel: 'Create',
      description: 'Pick a name.',
      takenNames: ['2024', 'a.png'],
      onSubmit,
      onClose,
    });

    await render(SubfolderNameDialog, props);
    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    props.open = true;

    const dialog = page.getByRole('dialog', { name: 'New Folder' });
    const textbox = dialog.getByRole('textbox', { name: 'Folder Name' });
    const ok = dialog.getByRole('button', { name: 'Create' });

    await expect.element(dialog.getByText('Pick a name.')).toBeVisible();

    const errorId = textbox.element().getAttribute('aria-errormessage');

    await expect.element(textbox).toHaveValue('');
    // The field starts empty, which can’t be used, but nothing is reported until it’s touched
    await expect.element(ok).toBeDisabled();
    await expect.element(textbox).not.toHaveAttribute('aria-invalid', 'true');
    expect(errorId).toMatch(/-error$/);

    const error = /** @type {HTMLElement} */ (
      document.getElementById(/** @type {string} */ (errorId))
    );

    expect(error).toHaveTextContent('');

    await textbox.fill('2024');
    await expect.element(textbox).toHaveAttribute('aria-invalid', 'true');
    expect(error).toHaveTextContent('A folder or file with this name already exists here.');
    await expect.element(ok).toBeDisabled();

    await textbox.fill('a/b');
    await expect
      .element(dialog.getByText('The folder name cannot contain slashes or start with a dot.'))
      .toBeVisible();

    await textbox.fill('admin');
    await expect.element(dialog.getByText(/read-only, as the CMS itself/)).toBeVisible();

    await textbox.fill(' ');
    await expect.element(dialog.getByText('The folder name cannot be empty.')).toBeVisible();

    await textbox.fill(' Summer ');
    expect(error).toHaveTextContent('');
    await expect.element(textbox).not.toHaveAttribute('aria-invalid', 'true');
    await expect.element(ok).toBeEnabled();
    await ok.click();

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Summer'));
    await expect.poll(() => props.open).toBe(false);
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  test('starts from the current name when renaming, which can’t be kept as is', async () => {
    const onSubmit = vi.fn();

    const props = $state({
      open: true,
      title: 'Rename Folder',
      okLabel: 'Rename',
      description: 'Enter a new name.',
      name: '2024',
      takenNames: ['2023'],
      onSubmit,
    });

    await render(SubfolderNameDialog, props);

    const dialog = page.getByRole('dialog', { name: 'Rename Folder' });
    const textbox = dialog.getByRole('textbox', { name: 'Folder Name' });
    const ok = dialog.getByRole('button', { name: 'Rename' });

    await expect.element(textbox).toHaveValue('2024');
    await expect.element(ok).toBeDisabled();

    // The same name with surrounding spaces is still the same name
    await textbox.fill(' 2024 ');
    await expect.element(ok).toBeDisabled();
    await textbox.fill('2023');
    await expect.element(ok).toBeDisabled();

    // Cancelling leaves the folder alone, and reopening starts over from the current name
    await textbox.fill('2025');
    await expect.element(ok).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => props.open).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();

    props.open = true;
    await expect.element(textbox).toHaveValue('2024');
    expect(dialog.element().querySelector('.error')).toHaveTextContent('');

    await textbox.fill('2025');
    await ok.click();
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledExactlyOnceWith('2025'));
    await expect.poll(() => props.open).toBe(false);
  });

  test('shows a warning without keeping the name from being submitted', async () => {
    const onSubmit = vi.fn();

    await render(SubfolderNameDialog, {
      open: true,
      title: 'Rename',
      okLabel: 'Rename',
      description: 'Pick a name.',
      warning: 'Links will break.',
      name: '2024',
      takenNames: [],
      onSubmit,
    });

    const dialog = page.getByRole('dialog', { name: 'Rename' });

    await expect.element(dialog.getByRole('alert')).toHaveTextContent('Links will break.');
    await dialog.getByRole('textbox').fill('2025');
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith('2025'));
  });
});
