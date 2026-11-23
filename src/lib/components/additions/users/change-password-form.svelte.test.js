import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { changePassword } from '$lib/services/additions/auth.svelte';
import { user } from '$lib/services/user/account.svelte';

import ChangePasswordForm from './change-password-form.svelte';

// The form talks to Sveltia CMS Additions; the checks are real, the request isn’t
vi.mock('$lib/services/additions/auth.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  changePassword: vi.fn(),
}));

/**
 * Fill in the form.
 * @param {string} current Current password.
 * @param {string} next New password.
 */
const fill = async (current, next) => {
  await page.getByLabelText('Current password').fill(current);
  await page.getByLabelText('New password', { exact: true }).fill(next);
};

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'ada', role: 'editor' });
  });

  test('changes the password, then empties the fields', async () => {
    const onChanged = vi.fn();

    await render(ChangePasswordForm, { onChanged });

    const submit = page.getByRole('button', { name: 'Change Password' });

    await expect.element(submit).toHaveAttribute('aria-disabled', 'true');
    // The username is there for password managers
    expect(
      /** @type {HTMLInputElement} */ (document.querySelector('[autocomplete="username"]')).value,
    ).toBe('ada');

    await fill('old password', 'short');
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The password is too short. Use at least 12 characters.');
    await expect.element(submit).toHaveAttribute('aria-disabled', 'true');

    await fill('old password', 'new password 2026');
    await submit.click();

    await vi.waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith('old password', 'new password 2026'),
    );
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    // No password is kept around
    await expect.element(page.getByLabelText('Current password')).toHaveValue('');
    await expect.element(page.getByLabelText('New password', { exact: true })).toHaveValue('');
  });

  test('shows why the change was refused', async () => {
    const onChanged = vi.fn();

    vi.mocked(changePassword).mockRejectedValue(
      new Error('Wrong', { cause: { message: 'The current password is wrong.' } }),
    );

    await render(ChangePasswordForm, { onChanged });
    await fill('wrong password', 'new password 2026');
    await page.getByRole('button', { name: 'Change Password' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The current password is wrong.');
    // The form stays for another try
    await expect.element(page.getByLabelText('Current password')).toHaveValue('wrong password');
    expect(onChanged).not.toHaveBeenCalled();
  });

  test('shows a generic message for an error without one, and works without a callback', async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(new Error('Network')).mockResolvedValue();

    await render(ChangePasswordForm, {});
    await fill('old password', 'new password 2026');
    await page.getByRole('button', { name: 'Change Password' }).click();

    await expect.element(page.getByRole('alert')).toMatchTextContent(/unexpected error/);

    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect.element(page.getByLabelText('Current password')).toHaveValue('');
  });
});
