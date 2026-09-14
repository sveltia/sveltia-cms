import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { announcedPageStatus } from '$lib/services/app/navigation';
import { inAuthPopup } from '$lib/services/backends/git/shared/auth';
import { cmsConfig, cmsConfigErrors } from '$lib/services/config';
import { dataLoaded, dataLoadedProgress } from '$lib/services/contents';
import { user } from '$lib/services/user/account.svelte';
import { auth } from '$lib/services/user/auth.svelte';
import { prefs, prefsError } from '$lib/services/user/prefs.svelte';

import EntrancePage from './entrance-page.svelte';

vi.mock('$lib/services/user/auth.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return {
    auth: createState({
      signInError: { message: '', context: 'authentication' },
      unauthenticated: true,
      signingIn: false,
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

describe('EntrancePage', () => {
  beforeEach(() => {
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github', repo: 'acme/site' },
      app_title: 'Acme CMS',
    });
    cmsConfigErrors.current = [];
    prefs.locale = 'auto';
    prefsError.current = undefined;
    inAuthPopup.current = false;
    user.account = undefined;
    auth.unauthenticated = true;
    auth.signInError = { message: '', context: 'authentication' };
    dataLoaded.current = false;
    dataLoadedProgress.current = undefined;
  });

  test('welcomes the user with the sign-in options', async () => {
    await render(EntrancePage, {});

    await expect.element(page.getByRole('heading', { name: 'Acme CMS' })).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Sign In with \u2068GitHub\u2069' }))
      .toBeVisible();
    await expect.element(page.getByText('Powered by \u2068Sveltia CMS\u2069')).toBeVisible();
    expect(announcedPageStatus.current).toBe('Welcome to \u2068Acme CMS\u2069');
  });

  test('lists the configuration errors', async () => {
    cmsConfig.current = undefined;
    cmsConfigErrors.current = ['The `backend` option is missing.', 'Bad `collections`'];

    await render(EntrancePage, {});

    const alert = page.getByRole('alert');

    await expect.element(alert).toBeVisible();
    expect(alert.element().querySelectorAll('li')).toHaveLength(2);
    expect(alert.element().querySelector('code')).toHaveTextContent('backend');
  });

  test('reports the loading progress once signed in', async () => {
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'octocat' });
    auth.unauthenticated = false;
    dataLoadedProgress.current = 42;

    await render(EntrancePage, {});

    await expect.element(page.getByRole('alert')).toHaveTextContent('Loading Site Data…');
    await expect.element(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  });

  test('reports a data loading error along with the sign-in options', async () => {
    auth.signInError = { message: 'Repository not found', context: 'dataFetch' };

    await render(EntrancePage, {});

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('There was an error while loading site data. Repository not found');
    await expect.element(page.getByRole('button', { name: /Sign In with/ })).toBeVisible();
  });

  test('reports while the configuration or preferences load, or authorization is pending', async () => {
    cmsConfig.current = undefined;
    await render(EntrancePage, {});
    await expect.element(page.getByRole('alert')).toHaveTextContent('Loading CMS Configuration…');

    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });
    inAuthPopup.current = true;
    await expect.element(page.getByRole('alert')).toHaveTextContent('Authorizing…');
  });

  test('reports a preferences storage error', async () => {
    prefsError.current = { type: 'permission_denied' };

    try {
      await render(EntrancePage, {});
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          'Cookie storage access has been denied. Please check your browser permissions and try again.',
        );
    } finally {
      prefsError.current = undefined;
    }
  });
});
