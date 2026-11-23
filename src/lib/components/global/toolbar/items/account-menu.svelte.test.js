import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { additionsAuth, linkGitHubAccount } from '$lib/services/additions/auth.svelte';
import { loadAdditions } from '$lib/services/app/additions';
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
vi.mock('$lib/services/additions/auth.svelte', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  linkGitHubAccount: vi.fn(),
}));
vi.mock('$lib/services/user/auth.svelte', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  signOut: vi.fn(),
}));

/**
 * Turn on Sveltia CMS Additions, and load its chunk, which the menu gets its items from.
 */
const enableAdditions = async () => {
  cmsConfig.current = /** @type {any} */ ({
    backend: { name: 'github', repo: 'acme/site', auth_type: 'additions' },
  });
  await loadAdditions();
};

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

  test('names the demo mode when the test repository is seeded', async () => {
    const link = Object.assign(document.createElement('link'), {
      rel: 'cms-seed-url',
      href: '/seed/manifest.json',
    });

    document.head.append(link);
    backendName.current = 'test-repo';

    try {
      await render(AccountMenu, {});
      await expect
        .element(page.getByRole('menuitem', { name: 'Demo Mode' }))
        .toHaveAttribute('aria-disabled', 'true');
    } finally {
      link.remove();
    }
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

  test('leaves user management to the Administration page, even for an admin', async () => {
    await enableAdditions();
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'ada', role: 'admin' });

    try {
      await render(AccountMenu, {});

      await expect.element(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
      expect(page.getByRole('menuitem', { name: 'Users' }).elements()).toHaveLength(0);
    } finally {
      cmsConfig.current = undefined;
    }
  });

  test('leaves the password to the Account settings panel of Sveltia CMS Additions', async () => {
    await enableAdditions();
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'ada', role: 'editor' });

    try {
      const { rerender } = await render(AccountMenu, {});

      expect(page.getByRole('menuitem', { name: 'Change Password' }).elements()).toHaveLength(0);
      await page.getByRole('menuitem', { name: 'Settings' }).click();

      const dialog = page.getByRole('dialog', { name: 'Settings' });

      await expect.element(dialog.getByRole('tab', { name: 'Account' })).toBeVisible();

      // Not with a local repository, used without signing in to the service
      backendName.current = 'local';
      await rerender({});
      await expect.element(dialog.getByRole('tab', { name: 'Account' })).not.toBeInTheDocument();
    } finally {
      cmsConfig.current = undefined;
    }
  });

  test('shows the role, and offers to link a GitHub account', async () => {
    await enableAdditions();
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'ada', role: 'editor' });
    additionsAuth.signInMethods = ['github'];
    vi.mocked(linkGitHubAccount).mockRejectedValueOnce(
      new Error('Failed', { cause: { message: 'Another user signs in with this account.' } }),
    );

    try {
      await render(AccountMenu, {});

      await expect
        .element(page.getByRole('menuitem', { name: /^Signed In as .ada. \(.Editor.\)$/ }))
        .toBeVisible();
      await page.getByRole('menuitem', { name: 'Link GitHub Account' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Couldn’t Link GitHub Account' });

      await expect.element(dialog).toMatchTextContent(/Another user signs in with this account\./);
      await dialog.getByRole('button', { name: 'OK' }).click();
      await expect.element(dialog).not.toBeInTheDocument();

      // An error without a localized message
      vi.mocked(linkGitHubAccount).mockRejectedValueOnce(new Error('Popup closed'));
      await page.getByRole('menuitem', { name: 'Link GitHub Account' }).click();
      await expect.element(page.getByRole('alertdialog')).toMatchTextContent(/Popup closed/);
    } finally {
      cmsConfig.current = undefined;
      additionsAuth.signInMethods = [];
    }
  });

  test('doesn’t offer to link a GitHub account to someone who has their own token', async () => {
    await enableAdditions();
    user.account = /** @type {any} */ ({
      backendName: 'github',
      login: 'ada',
      role: 'editor',
      ownGitHubToken: true,
    });
    additionsAuth.signInMethods = ['github'];

    try {
      await render(AccountMenu, {});

      await expect.element(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
      expect(page.getByRole('menuitem', { name: 'Link GitHub Account' }).elements()).toHaveLength(
        0,
      );
      expect(linkGitHubAccount).not.toHaveBeenCalled();
    } finally {
      cmsConfig.current = undefined;
      additionsAuth.signInMethods = [];
    }
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
      // The configuration is shown on the Administration page
      expect(page.getByRole('menuitem', { name: 'CMS Configuration' }).elements()).toHaveLength(0);
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
