import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { saveSignInSettings } from '$lib/services/additions/site-settings';
import { additionsUsers, loadUsers } from '$lib/services/additions/users.svelte';

import SignInPanel from './sign-in-panel.svelte';

// The state and the helpers are real, the requests aren’t
vi.mock('$lib/services/additions/users.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  loadUsers: vi.fn(),
}));
vi.mock('$lib/services/additions/site-settings', async (importOriginal) => ({
  ...(await importOriginal()),
  saveSignInSettings: vi.fn(),
}));

describe('SignInPanel', () => {
  beforeEach(() => {
    Object.assign(additionsUsers, {
      signInMethods: { github: false },
      signUpRules: [],
      loaded: false,
      update: undefined,
    });
    vi.mocked(loadUsers).mockImplementation(async () => {
      additionsUsers.loaded = true;
    });
  });

  test('shows the sign-in settings once loaded', async () => {
    await render(SignInPanel, { title: 'Sign-In' });

    await expect
      .element(page.getByRole('switch', { name: 'Allow signing in with GitHub' }))
      .toBeVisible();
    expect(loadUsers).toHaveBeenCalledOnce();
  });

  test('loads the settings again after another section, in case they’ve changed', async () => {
    Object.assign(additionsUsers, { signInMethods: { github: false }, loaded: true });
    // Another admin has turned GitHub sign-in on since
    vi.mocked(loadUsers).mockImplementation(async () => {
      additionsUsers.signInMethods = { github: true };
    });

    await render(SignInPanel, { title: 'Sign-In' });

    await expect
      .element(page.getByRole('switch', { name: 'Allow signing in with GitHub' }))
      .toBeChecked();
    expect(loadUsers).toHaveBeenCalledOnce();
  });

  test('saves the settings, and says why they couldn’t be', async () => {
    additionsUsers.loaded = true;
    vi.mocked(saveSignInSettings).mockRejectedValueOnce(
      new Error('Forbidden', { cause: { message: 'Only admins can do this.' } }),
    );

    await render(SignInPanel, { title: 'Sign-In' });
    await page.getByRole('switch', { name: 'Allow signing in with GitHub' }).click();
    await page.getByRole('button', { name: 'Save Sign-In Settings' }).click();

    await expect.element(page.getByRole('alert')).toHaveTextContent('Only admins can do this.');
    expect(saveSignInSettings).toHaveBeenCalledWith({
      signInMethods: { github: true },
      signUpRules: [],
    });
  });

  test('shows why the settings couldn’t be loaded', async () => {
    vi.mocked(loadUsers).mockRejectedValue(new Error('Network'));

    await render(SignInPanel, { title: 'Sign-In' });

    await expect.element(page.getByRole('alert')).toMatchTextContent(/unexpected error/);
    expect(page.getByRole('switch').elements()).toHaveLength(0);
  });
});
