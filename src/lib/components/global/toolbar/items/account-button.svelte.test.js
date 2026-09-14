import { sleep } from '@sveltia/utils/misc';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backendName } from '$lib/services/backends';
import { user } from '$lib/services/user/account.svelte';
import { env } from '$lib/services/user/env.svelte';

import AccountButton from './account-button.svelte';

describe('AccountButton', () => {
  test('shows the user’s avatar and opens the account menu', async () => {
    backendName.current = 'github';
    user.account = /** @type {any} */ ({
      backendName: 'github',
      login: 'octocat',
      avatarURL: 'https://example.com/avatar.png',
    });

    const { container } = await render(AccountButton, {});

    expect(container.querySelector('img.avatar')).toHaveAttribute(
      'src',
      'https://example.com/avatar.png',
    );
    await page.getByRole('button', { name: 'Show Account Menu' }).click();
    await expect.element(page.getByRole('menu', { name: 'Account' })).toBeVisible();

    // Closing the settings dialog returns the focus to the button
    env.isSmallScreen = false;
    await sleep(150);
    await page.getByRole('menuitem', { name: 'Settings' }).click();

    const dialog = page.getByRole('dialog', { name: 'Settings' });

    await expect.element(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    await expect
      .poll(() => document.activeElement?.getAttribute('aria-label'))
      .toBe('Show Account Menu');
  });

  test('shows a generic icon without an avatar', async () => {
    backendName.current = 'github';
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'octocat' });

    const { container } = await render(AccountButton, {});

    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('account_circle');
  });

  test('is labelled as the local workflow with a local repository', async () => {
    backendName.current = 'local';

    await render(AccountButton, {});
    await expect
      .element(page.getByRole('button', { name: 'Show Account Menu' }))
      .toHaveTextContent('Local arrow_drop_down');
  });
});
