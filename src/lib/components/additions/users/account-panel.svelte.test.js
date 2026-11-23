import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { changeName, changePassword } from '$lib/services/additions/auth.svelte';
import { user } from '$lib/services/user/account.svelte';

import AccountPanel from './account-panel.svelte';

// The panel talks to Sveltia CMS Additions; the checks are real, the requests aren’t
vi.mock('$lib/services/additions/auth.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  changeName: vi.fn(),
  changePassword: vi.fn(),
}));

describe('AccountPanel', () => {
  beforeEach(() => {
    user.account = /** @type {any} */ ({
      backendName: 'github',
      login: 'ada',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'editor',
    });
  });

  test('changes the name, leaving the email to admins', async () => {
    const onChange = vi.fn();

    await render(AccountPanel, { onChange });

    const profile = page.getByRole('region', { name: 'Profile' });
    const username = profile.getByRole('textbox', { name: 'Username' });
    const save = profile.getByRole('button', { name: 'Change Name' });
    const email = profile.getByRole('textbox', { name: 'Email' });

    // Filled in, with the username read-only
    await expect.element(username).toHaveValue('ada');
    await expect.element(username).toHaveAttribute('aria-readonly', 'true');
    await expect.element(username).toHaveAccessibleDescription(/can’t be changed/);
    await expect.element(profile.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada');
    await expect.element(email).toHaveValue('ada@example.com');
    await expect.element(email).toHaveAttribute('aria-readonly', 'true');
    await expect.element(email).toHaveAccessibleDescription(/Only an admin can change it/);
    // Nothing to save yet, or without a name
    await expect.element(save).toHaveAttribute('aria-disabled', 'true');
    await profile.getByRole('textbox', { name: 'Name' }).fill(' ');
    await expect.element(save).toHaveAttribute('aria-disabled', 'true');

    await profile.getByRole('textbox', { name: 'Name' }).fill(' Ada Lovelace ');
    await save.click();

    await vi.waitFor(() => expect(changeName).toHaveBeenCalledWith('Ada Lovelace'));
    expect(onChange).toHaveBeenCalledWith({ message: 'Your name has been changed.' });
  });

  test('reports why the name couldn’t be saved', async () => {
    const onChange = vi.fn();

    vi.mocked(changeName)
      .mockRejectedValueOnce(new Error('Invalid', { cause: { message: 'The name is too long.' } }))
      .mockRejectedValueOnce(new Error('Network'));

    await render(AccountPanel, { onChange });
    await page.getByRole('textbox', { name: 'Name' }).fill('Ada Lovelace');
    await page.getByRole('button', { name: 'Change Name' }).click();
    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        message: 'The name is too long.',
        status: 'error',
      }),
    );

    await page.getByRole('button', { name: 'Change Name' }).click();
    await vi.waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({
        message: expect.stringMatching(/unexpected error/),
        status: 'error',
      }),
    );
  });

  test('changes the password, and says so', async () => {
    const onChange = vi.fn();

    vi.mocked(changePassword).mockResolvedValue();

    await render(AccountPanel, { onChange });

    const password = page.getByRole('region', { name: 'Password' });

    await expect.element(password).toMatchTextContent(/signed out on your other devices/);
    await password.getByLabelText('Current password').fill('old password');
    await password.getByLabelText('New password', { exact: true }).fill('new password 2026');
    await password.getByRole('button', { name: 'Change Password' }).click();

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ message: 'Your password has been changed.' }),
    );
  });

  test('works without a callback', async () => {
    vi.mocked(changeName).mockResolvedValueOnce().mockRejectedValueOnce(new Error('Network'));
    vi.mocked(changePassword).mockResolvedValue();

    await render(AccountPanel, {});
    await page.getByRole('textbox', { name: 'Name' }).fill('Ada Lovelace');
    await page.getByRole('button', { name: 'Change Name' }).click();
    await vi.waitFor(() => expect(changeName).toHaveBeenCalledOnce());
    await page.getByRole('button', { name: 'Change Name' }).click();
    await vi.waitFor(() => expect(changeName).toHaveBeenCalledTimes(2));

    await page.getByLabelText('Current password').fill('old password');
    await page.getByLabelText('New password', { exact: true }).fill('new password 2026');
    await page.getByRole('button', { name: 'Change Password' }).click();
    await vi.waitFor(() => expect(changePassword).toHaveBeenCalledOnce());
  });

  test('asks for a name when the account has none, and shows no email when there is none', async () => {
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'ada', role: 'editor' });

    await render(AccountPanel, {});

    await expect.element(page.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    await expect.element(page.getByRole('textbox', { name: 'Email' })).toHaveValue('');
    await expect
      .element(page.getByRole('button', { name: 'Change Name' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('has no password to change for someone who only signs in with GitHub', async () => {
    user.account = /** @type {any} */ ({ ...user.account, hasPassword: false });

    await render(AccountPanel, {});

    const password = page.getByRole('region', { name: 'Password' });

    await expect.element(password).toMatchTextContent(/no password to change/);
    expect(password.getByLabelText('Current password').elements()).toHaveLength(0);
  });
});
