import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { showMobileSignInDialog } from '$lib/services/app/onboarding';
import { backendName } from '$lib/services/backends';
import { repository } from '$lib/services/backends/git/github/repository';
import { cmsConfig } from '$lib/services/config';
import { user } from '$lib/services/user/account.svelte';
import { signOut } from '$lib/services/user/auth.svelte';
import { env } from '$lib/services/user/env.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';
import { openNewTab } from '$lib/services/utils/window';

import AccountMenu from './account-menu.svelte';

vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));
vi.mock('$lib/services/user/auth.svelte', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  signOut: vi.fn(),
}));

describe('AccountMenu', () => {
  beforeEach(() => {
    backendName.current = 'github';
    user.account = /** @type {any} */ ({
      backendName: 'github',
      login: 'octocat',
      profileURL: 'https://github.com/octocat',
    });
    env.hasMouse = true;
    env.isSmallScreen = false;
    prefs.devModeEnabled = false;
  });

  test('shows who is signed in, with a link to their profile', async () => {
    await render(AccountMenu, {});

    const item = page.getByRole('menuitem', { name: /Signed In as .octocat/ });

    await item.click();
    expect(openNewTab).toHaveBeenCalledWith('https://github.com/octocat');
  });

  test('opens the live site', async () => {
    const config = cmsConfig.current;

    cmsConfig.current = /** @type {any} */ ({ ...config, display_url: 'https://example.com/' });

    try {
      await render(AccountMenu, {});
      await page.getByRole('menuitem', { name: 'Live Site' }).click();
      expect(openNewTab).toHaveBeenCalledWith('https://example.com/');
    } finally {
      cmsConfig.current = config;
    }
  });

  test('signs out', async () => {
    await render(AccountMenu, {});
    await page.getByRole('menuitem', { name: 'Sign Out' }).click();
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });

  test('offers to sign in on a mobile device', async () => {
    env.isLargeScreen = true;
    env.isLocalHost = false;
    user.account = /** @type {any} */ ({ ...user.account, token: 'abc' });
    showMobileSignInDialog.current = false;

    try {
      await render(AccountMenu, {});
      await page.getByRole('menuitem', { name: 'Sign In with Mobile' }).click();
      expect(showMobileSignInDialog.current).toBe(true);
    } finally {
      env.isLocalHost = true;
      showMobileSignInDialog.current = false;
    }
  });

  test('names the local and test repository workflows instead', async () => {
    backendName.current = 'local';

    const { unmount } = await render(AccountMenu, {});

    await expect
      .element(page.getByRole('menuitem', { name: 'Working with Local Repository' }))
      .toHaveAttribute('aria-disabled', 'true');
    await unmount();

    backendName.current = 'test-repo';
    await render(AccountMenu, {});
    await expect
      .element(page.getByRole('menuitem', { name: 'Working with Test Repository' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('opens the settings dialog on a large screen', async () => {
    const menuButton = document.createElement('button');

    document.body.appendChild(menuButton);

    try {
      await render(AccountMenu, { menuButton: /** @type {any} */ (menuButton) });
      await page.getByRole('menuitem', { name: 'Settings' }).click();

      const dialog = page.getByRole('dialog', { name: 'Settings' });

      await expect.element(dialog).toBeVisible();

      // Closing the dialog returns the focus to the menu button
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
      await expect.poll(() => document.activeElement).toBe(menuButton);
    } finally {
      menuButton.remove();
    }
  });

  test('goes to the settings page on a small screen', async () => {
    env.isSmallScreen = true;
    window.location.hash = '#/collections';

    await render(AccountMenu, {});
    await page.getByRole('menuitem', { name: 'Settings' }).click();

    await expect.poll(() => window.location.hash).toBe('#/settings');
  });

  test('offers the developer items in developer mode', async () => {
    prefs.devModeEnabled = true;
    window.location.hash = '#/collections';

    try {
      await render(AccountMenu, {});

      expect(page.getByRole('menuitem', { name: 'Keyboard Shortcuts' }).elements()).toHaveLength(0);
      await expect
        .element(page.getByRole('menuitem', { name: 'Git Repository' }))
        .toHaveAttribute('aria-disabled', 'true');
      await page.getByRole('menuitem', { name: 'CMS Configuration' }).click();
      await expect.poll(() => window.location.hash).toBe('#/config');
    } finally {
      prefs.devModeEnabled = false;
    }
  });

  test('opens the repository once it’s known', async () => {
    prefs.devModeEnabled = true;
    Object.assign(repository, { treeBaseURL: 'https://github.com/octocat/site/tree/main' });

    try {
      await render(AccountMenu, {});
      await page.getByRole('menuitem', { name: 'Git Repository' }).click();
      expect(openNewTab).toHaveBeenCalledWith('https://github.com/octocat/site/tree/main');
    } finally {
      prefs.devModeEnabled = false;
      Object.assign(repository, { treeBaseURL: '' });
    }
  });
});
