import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { additionsAuth, cancelPasswordChange } from '$lib/services/additions/auth.svelte';
import { additionsSetup } from '$lib/services/additions/setup.svelte';
import { auth, signInManually, signInWithNewPassword } from '$lib/services/user/auth.svelte';

import SignInForm from './sign-in-form.svelte';

vi.mock('$lib/services/additions/auth.svelte', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  cancelPasswordChange: vi.fn(),
}));
// Signing in talks to the backend; only the calls matter here
vi.mock('$lib/services/user/auth.svelte', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  signInManually: vi.fn(),
  signInWithNewPassword: vi.fn(),
}));

/**
 * Render the form, as the main option on the sign-in page.
 * @param {{ primary?: boolean }} [props] Props to override.
 * @returns {Promise<any>} Rendered component.
 */
const renderForm = (props = {}) =>
  render(SignInForm, { backendName: 'github', primary: true, ...props });

const PASSWORD_CHANGE = {
  username: 'editor',
  siteId: 'site',
  sessionToken: 'session',
  currentPrehash: 'prehash',
};

describe('SignInForm', () => {
  beforeEach(() => {
    additionsAuth.passwordChange = undefined;
    additionsAuth.signInMethods = [];
    additionsSetup.open = false;
    additionsSetup.result = '';
  });

  test('signs in with a username and password', async () => {
    await renderForm();

    const signInButton = page.getByRole('button', { name: 'Sign In', exact: true });

    await expect.element(signInButton).toHaveAttribute('aria-disabled', 'true');
    await expect.element(signInButton).toHaveClass('primary');

    await page.getByRole('textbox', { name: 'Username' }).fill(' editor ');
    await page.getByLabelText('Password').fill('correct horse battery staple');
    await expect.element(signInButton).not.toHaveAttribute('aria-disabled', 'true');
    await signInButton.click();

    await vi.waitFor(() =>
      expect(signInManually).toHaveBeenCalledWith('github', undefined, {
        username: 'editor',
        password: 'correct horse battery staple',
      }),
    );
    // The password isn’t kept around
    await expect.element(page.getByLabelText('Password')).toHaveValue('');
  });

  test('comes back to what was typed when signing in fails, but not after another sign-in', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(signInManually).mockImplementationOnce(async () => {
      auth.signInError = { message: 'Wrong password', context: 'authentication' };
      await promise;
    });

    // The page shows a message in place of the form while signing in, then the form again
    const { unmount } = await renderForm();

    await page.getByRole('textbox', { name: 'Username' }).fill('editor');
    await page.getByLabelText('Password').fill('mistyped');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await vi.waitFor(() => expect(signInManually).toHaveBeenCalled());
    unmount();

    const { unmount: unmountAgain } = await renderForm();

    resolve(undefined);
    await expect.element(page.getByRole('textbox', { name: 'Username' })).toHaveValue('editor');
    await expect.element(page.getByLabelText('Password')).toHaveValue('mistyped');
    auth.signInError = { message: '', context: 'authentication' };

    // Signed in with GitHub instead: nothing is left for whoever signs in next
    unmountAgain();
    await renderForm();
    await expect.element(page.getByRole('textbox', { name: 'Username' })).toHaveValue('');
    await expect.element(page.getByLabelText('Password')).toHaveValue('');
  });

  test('makes signing in a secondary option when the local repository is offered first', async () => {
    await renderForm({ primary: false });

    await expect
      .element(page.getByRole('button', { name: 'Sign In', exact: true }))
      .toHaveClass('secondary');
  });

  test('offers to sign in with GitHub when the service allows it', async () => {
    await renderForm();

    expect(page.getByRole('button', { name: /^Sign In with .GitHub/ }).elements()).toHaveLength(0);

    additionsAuth.signInMethods = ['github'];
    await page.getByRole('button', { name: /^Sign In with .GitHub/ }).click();

    await vi.waitFor(() =>
      expect(signInManually).toHaveBeenCalledWith('github', undefined, { provider: 'github' }),
    );
  });

  test('does nothing when the form is submitted incomplete', async () => {
    await renderForm();

    await page.getByRole('textbox', { name: 'Username' }).fill('editor');
    await userEvent.keyboard('{Enter}');

    expect(signInManually).not.toHaveBeenCalled();
  });

  test('asks for a new password after signing in with a temporary one', async () => {
    vi.mocked(signInWithNewPassword).mockResolvedValue(true);
    additionsAuth.passwordChange = PASSWORD_CHANGE;

    await renderForm();

    const changeButton = page.getByRole('button', { name: 'Change Password' });

    await expect
      .element(page.getByRole('heading', { name: 'Choose a New Password' }))
      .toBeVisible();
    expect(page.getByRole('textbox', { name: 'Username' }).elements()).toHaveLength(0);
    await page.getByLabelText('New password', { exact: true }).fill('short');
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The password is too short. Use at least 12 characters.');

    await expect.element(changeButton).toHaveAttribute('aria-disabled', 'true');

    // Submitting with Enter is ignored while the password is too short
    await userEvent.keyboard('{Enter}');
    expect(signInWithNewPassword).not.toHaveBeenCalled();

    await page.getByLabelText('New password', { exact: true }).fill('a much longer password');
    await changeButton.click();

    await vi.waitFor(() =>
      expect(signInWithNewPassword).toHaveBeenCalledWith('github', 'a much longer password'),
    );
    // The new password isn’t kept around
    await expect.element(page.getByLabelText('New password', { exact: true })).toHaveValue('');
  });

  test('goes back to the sign-in form when choosing a new password is cancelled', async () => {
    additionsAuth.passwordChange = PASSWORD_CHANGE;
    vi.mocked(cancelPasswordChange).mockImplementationOnce(async () => {
      additionsAuth.passwordChange = undefined;
    });

    await renderForm();
    await page.getByRole('button', { name: 'Cancel' }).click();

    expect(cancelPasswordChange).toHaveBeenCalledOnce();
    await expect.element(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
  });

  test('keeps the new password when the change fails, so it can be retried', async () => {
    vi.mocked(signInWithNewPassword).mockResolvedValue(false);
    additionsAuth.passwordChange = PASSWORD_CHANGE;

    await renderForm();
    await page.getByLabelText('New password', { exact: true }).fill('a much longer password');
    await page.getByRole('button', { name: 'Change Password' }).click();

    await vi.waitFor(() => expect(signInWithNewPassword).toHaveBeenCalledOnce());
    await expect
      .element(page.getByLabelText('New password', { exact: true }))
      .toHaveValue('a much longer password');
    await expect
      .element(page.getByRole('button', { name: 'Change Password' }))
      .not.toHaveAttribute('aria-disabled', 'true');
  });

  test('opens the setup wizard with the admin secret', async () => {
    additionsSetup.result = 'ok';

    await renderForm();
    await page.getByRole('button', { name: 'Use Admin Secret' }).click();

    expect(additionsSetup.open).toBe(true);
    // The outcome of the last connection is forgotten
    await expect.poll(() => additionsSetup.result).toBe('');
    expect(page.getByRole('status').elements()).toHaveLength(0);
  });

  test('tells how connecting to GitHub went', async () => {
    additionsSetup.result = 'ok';

    await renderForm();

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('GitHub is connected. You can now sign in.');
    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });

  test('reports a failed connection to GitHub', async () => {
    additionsSetup.result = 'github_wrong_account';

    await renderForm();

    await expect
      .element(page.getByRole('alert'))
      .toMatchTextContent(/installed on an account that doesn’t own the repository/);
    expect(page.getByRole('status').elements()).toHaveLength(0);
  });

  test('fills in the username and password from an emailed magic link', async () => {
    auth.emailedSignIn = { username: 'viewer', password: 'kq7m-x2pd-9vbt-h4wn' };

    await renderForm();

    await expect.element(page.getByRole('textbox', { name: 'Username' })).toHaveValue('viewer');
    await expect
      .element(page.getByLabelText('Password', { exact: true }))
      .toHaveValue('kq7m-x2pd-9vbt-h4wn');
    // Used once, and the user still signs in themselves
    expect(auth.emailedSignIn).toBeUndefined();
    expect(signInManually).not.toHaveBeenCalled();
    // Anyone can make such a link, so the user is told to check the username is theirs
    await expect
      .element(page.getByRole('status'))
      .toMatchTextContent(/filled in from a link.*“\u2068viewer\u2069” is your username/);
    // Until they change it
    await page.getByRole('textbox', { name: 'Username' }).fill('someone');
    await expect.element(page.getByRole('status')).not.toBeInTheDocument();
  });

  test('fills in the form from a magic link read after it has appeared', async () => {
    await renderForm();
    auth.emailedSignIn = { username: 'viewer', password: 'kq7m-x2pd-9vbt-h4wn' };

    await expect.element(page.getByRole('textbox', { name: 'Username' })).toHaveValue('viewer');
    await expect.poll(() => auth.emailedSignIn).toBeUndefined();
  });
});
