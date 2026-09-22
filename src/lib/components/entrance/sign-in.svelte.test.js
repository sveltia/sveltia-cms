import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { repository } from '$lib/services/backends/git/github/repository';
import { cmsConfig } from '$lib/services/config';
import { auth, signInAutomatically, signInManually } from '$lib/services/user/auth.svelte';
import { env } from '$lib/services/user/env.svelte';

import SignIn from './sign-in.svelte';

// Signing in talks to the backend; only the state and the calls matter here
vi.mock('$lib/services/user/auth.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return {
    auth: createState({
      signInError: { message: '', context: 'authentication' },
      unauthenticated: true,
      signingIn: false,
      magicLinkConfirmation: undefined,
    }),
    resetError: vi.fn(),
    logError: vi.fn(),
    parseMagicLink: vi.fn(),
    getUserCache: vi.fn(),
    getBackend: vi.fn(),
    signInAutomatically: vi.fn(),
    signInManually: vi.fn(),
    signOut: vi.fn(),
  };
});

describe('SignIn', () => {
  beforeEach(() => {
    auth.signInError = { message: '', context: 'authentication' };
    auth.signingIn = false;
    auth.magicLinkConfirmation = undefined;
    env.isLocalHost = true;
    env.isLocalBackendSupported = true;
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github', repo: 'acme/site' } });
  });

  test('tries to sign in automatically, and offers the sign-in options', async () => {
    await render(SignIn, {});

    expect(signInAutomatically).toHaveBeenCalledOnce();

    await expect
      .element(page.getByRole('button', { name: 'Work with Local Repository' }))
      .toBeVisible();
    await expect
      .element(
        page.getByText(
          'Once prompted, select the root directory of the “\u2068site\u2069” repository.',
        ),
      )
      .toBeVisible();
    await page.getByRole('button', { name: 'Sign In with \u2068GitHub\u2069' }).click();
    expect(signInManually).toHaveBeenCalledWith('github');
  });

  test('asks before signing in with a magic link, naming the account', async () => {
    const resolve = vi.fn();

    await render(SignIn, {});
    auth.magicLinkConfirmation = {
      account: { backendName: 'github', login: 'octocat', name: 'The Octocat' },
      resolve,
    };

    const dialog = page.getByRole('alertdialog', { name: 'Sign In with Link' });

    await expect
      .element(dialog)
      .toMatchTextContent(
        'This link signs you in as \u2068octocat\u2069 on \u2068GitHub\u2069 and copies the settings',
      );
    await dialog.getByRole('button', { name: 'Sign In' }).click();
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(true));
  });

  test('declines a magic link when the dialog is cancelled', async () => {
    const resolve = vi.fn();

    await render(SignIn, {});
    auth.magicLinkConfirmation = { account: { backendName: 'github', name: 'Octo' }, resolve };

    const dialog = page.getByRole('alertdialog', { name: 'Sign In with Link' });

    // Without a login name, the display name is shown instead
    await expect.element(dialog).toMatchTextContent('signs you in as \u2068Octo\u2069 on');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledWith(false));
    expect(resolve).not.toHaveBeenCalledWith(true);
  });

  test('shows the magic link prompt for an account without a name', async () => {
    await render(SignIn, {});
    auth.magicLinkConfirmation = { account: { backendName: 'github' }, resolve: vi.fn() };

    await expect
      .element(page.getByRole('alertdialog', { name: 'Sign In with Link' }))
      .toMatchTextContent('signs you in as \u2068\u2069 on');
  });

  test('signs in with a personal access token', async () => {
    await render(SignIn, {});
    await page.getByRole('button', { name: 'Sign In Using Access Token' }).click();

    const dialog = page.getByRole('alertdialog');

    await expect
      .element(dialog.getByRole('button', { name: 'Sign In' }))
      .toHaveAttribute('aria-disabled', 'true');
    await dialog.getByRole('textbox', { name: 'Personal Access Token' }).fill(' ghp_abc ');
    await dialog.getByRole('button', { name: 'Sign In' }).click();

    await vi.waitFor(() => expect(signInManually).toHaveBeenCalledWith('github', 'ghp_abc'));
  });

  test('hides the local option away from localhost, and for the test repository', async () => {
    env.isLocalHost = false;

    await render(SignIn, {});
    expect(
      page.getByRole('button', { name: 'Work with Local Repository' }).elements(),
    ).toHaveLength(0);

    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'test-repo' } });
    await expect
      .element(page.getByRole('button', { name: 'Work with Test Repository' }))
      .toBeVisible();
    expect(page.getByRole('button').elements()).toHaveLength(1);
  });

  test('offers nothing for an unknown backend', async () => {
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'unknown' } });

    const { container } = await render(SignIn, {});

    expect(container.querySelector('.buttons')?.children).toHaveLength(0);
  });

  test('explains why the local option is unavailable', async () => {
    env.isLocalBackendSupported = false;
    env.isBrave = false;

    await render(SignIn, {});

    await expect
      .element(page.getByRole('button', { name: 'Work with Local Repository' }))
      .toHaveAttribute('aria-disabled', 'true');
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'Local Workflow is not supported in your browser. Please use Chrome or Edge instead.',
      );
  });

  test('shows the sign-in error and skips the automatic sign-in', async () => {
    auth.signInError = { message: 'Access denied', context: 'authentication' };

    await render(SignIn, {});

    expect(signInAutomatically).not.toHaveBeenCalled();
    await expect.element(page.getByRole('alert')).toHaveTextContent('error Access denied');
  });

  test('reports while signing in', async () => {
    auth.signingIn = true;

    await render(SignIn, {});
    await expect.element(page.getByRole('alert')).toHaveTextContent('Signing in…');
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  test('signs in with the Enter key in the token dialog', async () => {
    // The link to the token page is known once the repository is initialized
    Object.assign(repository, { tokenPageURL: 'https://github.com/settings/tokens' });

    await render(SignIn, {});
    await page.getByRole('button', { name: 'Sign In Using Access Token' }).click();

    const dialog = page.getByRole('alertdialog');
    const textbox = dialog.getByRole('textbox', { name: 'Personal Access Token' });

    await expect
      .element(dialog.getByRole('link'))
      .toHaveAttribute('href', 'https://github.com/settings/tokens');
    Object.assign(repository, { tokenPageURL: '' });

    // Nothing to submit yet
    await textbox.click();
    await userEvent.keyboard('{Enter}');
    expect(signInManually).not.toHaveBeenCalled();

    await textbox.fill('ghp_abc');
    await userEvent.keyboard('{Enter}');
    expect(signInManually).toHaveBeenCalledWith('github', 'ghp_abc');
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  test('mentions pull request access in the token dialog with Editorial Workflow', async () => {
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github', repo: 'acme/site' },
      publish_mode: 'editorial_workflow',
    });

    await render(SignIn, {});
    await page.getByRole('button', { name: 'Sign In Using Access Token' }).click();
    await expect
      .element(page.getByRole('alertdialog'))
      .toMatchTextContent('It must have read/write access to the repository content.');
    await expect
      .element(page.getByRole('alertdialog'))
      .toMatchTextContent('it must also have read/write access to pull requests.');
  });

  test('omits the pull request note in the simple publish mode', async () => {
    await render(SignIn, {});
    await page.getByRole('button', { name: 'Sign In Using Access Token' }).click();
    await expect
      .element(page.getByRole('alertdialog'))
      .toMatchTextContent('It must have read/write access to the repository content.');
    expect(page.getByText('pull requests').elements()).toHaveLength(0);
  });

  test('uses the local repository', async () => {
    await render(SignIn, {});
    await page.getByRole('button', { name: 'Work with Local Repository' }).click();
    expect(signInManually).toHaveBeenCalledWith('local');
  });

  test('explains how to enable the local option in Brave', async () => {
    env.isLocalBackendSupported = false;
    env.isBrave = true;

    await render(SignIn, {});

    await expect
      .element(page.getByRole('alert').getByRole('link'))
      .toHaveAttribute(
        'href',
        'https://sveltiacms.app/en/docs/workflows/local#enabling-file-system-access-api-in-brave',
      );
  });

  test('names Codeberg for a Forgejo backend hosted there', async () => {
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'gitea', base_url: 'https://codeberg.org', app_id: 'abc' },
    });

    await render(SignIn, {});

    await expect
      .element(page.getByRole('button', { name: 'Sign In with \u2068Codeberg\u2069' }))
      .toBeEnabled();
    // The repository name is unknown
    await expect
      .element(page.getByText('Once prompted, select the root directory of your Git repository.'))
      .toBeVisible();
  });

  test('limits the sign-in options to the configured methods', async () => {
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github', repo: 'acme/site', auth_methods: ['token'] },
    });

    await render(SignIn, {});

    await expect
      .element(page.getByRole('button', { name: 'Sign In Using Access Token' }))
      .toBeVisible();
    expect(page.getByRole('button', { name: /^Sign In with/ }).elements()).toHaveLength(0);

    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github', repo: 'acme/site', auth_methods: ['oauth'] },
    });

    await expect
      .element(page.getByRole('button', { name: 'Sign In with \u2068GitHub\u2069' }))
      .toBeVisible();
    expect(
      page.getByRole('button', { name: 'Sign In Using Access Token' }).elements(),
    ).toHaveLength(0);
  });
});
