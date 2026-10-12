import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { loadChunk } from '$lib/services/app/dependencies';
import { showMobileSignInDialog } from '$lib/services/app/onboarding';
import { user } from '$lib/services/user/account.svelte';
import { decodeMagicLinkData } from '$lib/services/user/magic-link';
import { prefs } from '$lib/services/user/prefs.svelte';

import MobileSignInDialog from './mobile-sign-in-dialog.svelte';

vi.mock('$lib/services/app/dependencies', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());

  return { ...actual, loadChunk: vi.fn(actual.loadChunk) };
});

describe('MobileSignInDialog', () => {
  test('shows a QR code holding the sign-in link', async () => {
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'octocat', token: 'abc' });
    showMobileSignInDialog.current = true;

    await render(MobileSignInDialog, {});

    const dialog = page.getByRole('dialog', { name: 'Sign In with Mobile' });

    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByText(/Scan the QR code/)).toBeVisible();

    // The QR code is drawn once the dialog is open
    await expect
      .poll(
        () =>
          /** @type {HTMLCanvasElement | null} */ (document.querySelector('dialog canvas'))?.width,
      )
      .toBeGreaterThan(0);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => showMobileSignInDialog.current).toBe(false);
  });

  test('reports a QR code library that can’t be loaded', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loadError = new Error('Failed to load the qrcode chunk.');

    vi.mocked(loadChunk).mockRejectedValueOnce(loadError);
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'octocat', token: 'abc' });
    showMobileSignInDialog.current = true;

    try {
      await render(MobileSignInDialog, {});
      await vi.waitFor(() => expect(error).toHaveBeenCalledWith(loadError));
      // The library is only loaded for the dialog
      expect(loadChunk).toHaveBeenCalledWith('qrcode');
    } finally {
      showMobileSignInDialog.current = false;
      error.mockRestore();
    }
  });

  test('logs the link in developer mode', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    user.account = /** @type {any} */ ({ backendName: 'github', login: 'octocat', token: 'abc' });
    prefs.devModeEnabled = true;
    showMobileSignInDialog.current = true;

    try {
      await render(MobileSignInDialog, {});
      await vi.waitFor(() =>
        expect(info).toHaveBeenCalledWith(
          'Mobile sign-in URL:',
          expect.stringContaining('#/signin/'),
        ),
      );
    } finally {
      prefs.devModeEnabled = false;
      showMobileSignInDialog.current = false;
    }
  });

  test('encodes preferences holding text outside Latin-1', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deployHookURL = 'https://例え.jp/フック?q=🚀';

    user.account = /** @type {any} */ ({ backendName: 'github', login: 'octocat', token: 'abc' });
    prefs.devModeEnabled = true;
    prefs.deployHookURL = deployHookURL;
    showMobileSignInDialog.current = true;

    try {
      await render(MobileSignInDialog, {});
      await vi.waitFor(() => expect(info).toHaveBeenCalled());

      const url = /** @type {string} */ (info.mock.calls[0][1]);
      const [, encodedData] = url.split('#/signin/');

      expect(decodeMagicLinkData(encodedData)).toMatchObject({
        token: 'abc',
        prefs: { deployHookURL },
      });
      expect(error).not.toHaveBeenCalled();
    } finally {
      prefs.devModeEnabled = false;
      delete prefs.deployHookURL;
      showMobileSignInDialog.current = false;
    }
  });
});
