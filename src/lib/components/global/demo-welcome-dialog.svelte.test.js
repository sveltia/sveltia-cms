import { LocalStorage } from '@sveltia/utils/storage';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { DEMO_WELCOME_STORAGE_KEY, demoWelcomeNotice } from '$lib/services/app/onboarding';
import { backendName } from '$lib/services/backends';

import DemoWelcomeDialog from './demo-welcome-dialog.svelte';

describe('DemoWelcomeDialog', () => {
  /** @type {HTMLLinkElement} */
  let seedLink;

  beforeEach(async () => {
    // A demo site seeds the test repository with the files listed in the manifest
    seedLink = Object.assign(document.createElement('link'), {
      rel: 'cms-seed-url',
      href: '/seed/manifest.json',
    });
    document.head.append(seedLink);
    backendName.current = 'test-repo';
    demoWelcomeNotice.show.current = false;
    await LocalStorage.delete(DEMO_WELCOME_STORAGE_KEY);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    seedLink.remove();
    backendName.current = undefined;
    demoWelcomeNotice.show.current = false;
    await LocalStorage.delete(DEMO_WELCOME_STORAGE_KEY);
  });

  test('tells the user that their changes stay in the browser, only once', async () => {
    const { unmount } = await render(DemoWelcomeDialog, {});
    const dialog = page.getByRole('dialog', { name: 'Welcome to Sveltia CMS Demo' });

    await expect.element(dialog).toBeVisible();
    await expect
      .element(dialog.getByText(/Your changes are only saved in this browser/))
      .toMatchTextContent(/Nothing is published online, and no one else can see them\./);
    await expect.element(dialog.getByText(/To start over/)).toBeVisible();

    await dialog.getByRole('button', { name: 'Get Started' }).click();
    await expect.poll(() => demoWelcomeNotice.show.current).toBe(false);
    await expect.poll(() => LocalStorage.get(DEMO_WELCOME_STORAGE_KEY)).toBe(true);

    // The next visit doesn’t show it again. Wait for the stored flag to be read first, which would
    // open the dialog otherwise
    const getItem = vi.spyOn(LocalStorage, 'get');

    unmount();
    await render(DemoWelcomeDialog, {});
    await vi.waitFor(() => expect(getItem).toHaveBeenCalledWith(DEMO_WELCOME_STORAGE_KEY));
    await expect(getItem.mock.results[0].value).resolves.toBe(true);
    await tick();
    expect(demoWelcomeNotice.show.current).toBe(false);
    expect(page.getByRole('dialog').elements()).toHaveLength(0);
  });

  test('remembers the dialog closed with the Escape key', async () => {
    await render(DemoWelcomeDialog, {});
    await expect
      .element(page.getByRole('dialog', { name: 'Welcome to Sveltia CMS Demo' }))
      .toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.poll(() => demoWelcomeNotice.show.current).toBe(false);
    await expect.poll(() => LocalStorage.get(DEMO_WELCOME_STORAGE_KEY)).toBe(true);
  });

  test('doesn’t show up outside a demo site', async () => {
    seedLink.remove();
    await render(DemoWelcomeDialog, {});

    expect(demoWelcomeNotice.show.current).toBe(false);
    expect(page.getByRole('dialog').elements()).toHaveLength(0);
  });
});
