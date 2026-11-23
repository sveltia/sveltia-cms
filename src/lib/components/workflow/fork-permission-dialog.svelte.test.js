import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { forkPermissionRequest } from '$lib/services/workflow/open-authoring';

import ForkPermissionDialog from './fork-permission-dialog.svelte';

describe('ForkPermissionDialog', () => {
  test('is closed while no request is pending', async () => {
    forkPermissionRequest.current = undefined;

    await render(ForkPermissionDialog, {});

    expect(page.getByRole('alertdialog').elements()).toHaveLength(0);
  });

  test('asks for permission and grants it', async () => {
    const respond = vi.fn();

    forkPermissionRequest.current = { repo: 'acme/site', respond };

    await render(ForkPermissionDialog, {});

    const dialog = page.getByRole('alertdialog', { name: 'Fork Repository' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Fork Repository To suggest changes to “\u2068acme/site\u2069”, a fork of the repository has to be created on your account. Your changes are saved to that fork, and a maintainer reviews them before they go live. Fork Cancel',
      );
    await dialog.getByRole('button', { name: 'Fork' }).click();

    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(true));
  });

  test('declines the request when dismissed', async () => {
    const respond = vi.fn();

    forkPermissionRequest.current = { repo: 'acme/site', respond };

    await render(ForkPermissionDialog, {});
    await page.getByRole('button', { name: 'Cancel' }).click();

    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(false));
  });
});
