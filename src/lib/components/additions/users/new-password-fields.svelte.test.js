import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import NewPasswordFields from './new-password-fields.svelte';

describe('NewPasswordFields', () => {
  test('binds the value, asks for it once and marks no problem while there’s none', async () => {
    /** @type {{ newPassword: string, passwordError: any }} */
    const props = $state({ newPassword: '', passwordError: '' });

    await render(NewPasswordFields, props);

    const field = page.getByLabelText('New password', { exact: true });

    await expect.element(field).toHaveAttribute('autocomplete', 'new-password');
    await expect.element(field).not.toHaveAttribute('aria-invalid', 'true');
    // Not typed twice: the field can show what has been typed instead
    expect(page.getByLabelText(/Confirm/).elements()).toHaveLength(0);
    await expect.element(page.getByRole('button', { name: 'Show Password' })).toBeVisible();
    expect(page.getByRole('alert').elements()).toHaveLength(0);

    await field.fill('new password 2026');
    expect(props.newPassword).toBe('new password 2026');

    props.newPassword = 'from the parent';
    await expect.element(field).toHaveValue('from the parent');
  });

  test('marks the new password when it’s too short', async () => {
    await render(NewPasswordFields, {
      newPassword: 'short',
      passwordError: 'password_too_short',
      requestError: 'Not shown',
    });

    await expect
      .element(page.getByLabelText('New password', { exact: true }))
      .toHaveAttribute('aria-invalid', 'true');
    // The problem with the password comes before a request error
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The password is too short. Use at least 12 characters.');
  });

  test('shows a request error when the password is fine', async () => {
    await render(NewPasswordFields, {
      newPassword: '',
      passwordError: '',
      requestError: 'The current password is wrong.',
    });

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The current password is wrong.');
  });
});
