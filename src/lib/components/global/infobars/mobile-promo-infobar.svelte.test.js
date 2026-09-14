import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { showMobileSignInDialog } from '$lib/services/app/onboarding';

import MobilePromoInfobar from './mobile-promo-infobar.svelte';

describe('MobilePromoInfobar', () => {
  test('invites the user to try the mobile app until dismissed', async () => {
    showMobileSignInDialog.current = false;

    const { container } = await render(MobilePromoInfobar, {});

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('info Sveltia CMS is now available on mobile! Give it a try Later');

    await page.getByRole('button', { name: 'Later' }).click();
    await expect.poll(() => container.querySelector('.infobar')).toBeNull();
    expect(showMobileSignInDialog.current).toBe(false);
  });

  test('opens the mobile sign-in dialog', async () => {
    showMobileSignInDialog.current = false;

    await render(MobilePromoInfobar, {});
    await page.getByRole('button', { name: 'Give it a try' }).click();

    expect(showMobileSignInDialog.current).toBe(true);
  });
});
