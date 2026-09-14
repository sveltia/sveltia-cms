import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { showMobileSignInDialog } from '$lib/services/app/onboarding';
import { user } from '$lib/services/user/account.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';

import MobileSignInDialog from './mobile-sign-in-dialog.svelte';

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
});
