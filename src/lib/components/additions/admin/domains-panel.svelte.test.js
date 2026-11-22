import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { saveAllowedDomains } from '$lib/services/additions/site-settings';
import { additionsUsers, loadSiteSettings } from '$lib/services/additions/users.svelte';

import DomainsPanel from './domains-panel.svelte';

// The state and the helpers are real, the requests aren’t
vi.mock('$lib/services/additions/users.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  loadSiteSettings: vi.fn(),
}));
vi.mock('$lib/services/additions/site-settings', async (importOriginal) => ({
  ...(await importOriginal()),
  saveAllowedDomains: vi.fn(),
}));

describe('DomainsPanel', () => {
  beforeEach(() => {
    Object.assign(additionsUsers, { allowedDomains: [], loaded: false, update: undefined });
    vi.mocked(loadSiteSettings).mockImplementation(async () => {
      Object.assign(additionsUsers, {
        allowedDomains: ['cms.example', '*.example.org'],
        loaded: true,
      });
    });
    vi.mocked(saveAllowedDomains).mockImplementation(async (domains) => {
      additionsUsers.allowedDomains = domains;
    });
  });

  test('loads the allowed domains, and saves them', async () => {
    await render(DomainsPanel, { title: 'Domains' });

    const textbox = page.getByRole('textbox', { name: 'Allowed Domains' });

    await expect.element(page.getByRole('main', { name: 'Domains' })).toBeVisible();
    await expect.element(textbox).toHaveValue('cms.example\n*.example.org');
    await textbox.fill('cms.example\n www.example.org \n');
    await page.getByRole('button', { name: 'Save Allowed Domains' }).click();

    await vi.waitFor(() =>
      expect(saveAllowedDomains).toHaveBeenCalledWith(['cms.example', 'www.example.org']),
    );
    await expect.element(textbox).toHaveValue('cms.example\nwww.example.org');
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('The allowed domains have been saved.');

    // Editing again clears the notice
    await textbox.fill('cms.example');
    expect(page.getByRole('status').elements()).toHaveLength(0);
  });

  test('loads the settings again after another section, in case they’ve changed', async () => {
    Object.assign(additionsUsers, { allowedDomains: ['cms.example'], loaded: true });

    /** @type {PromiseWithResolvers<void>} */
    const loading = Promise.withResolvers();

    vi.mocked(loadSiteSettings).mockReturnValueOnce(loading.promise);

    const { unmount } = await render(DomainsPanel, { title: 'Domains' });
    const textbox = page.getByRole('textbox', { name: 'Allowed Domains' });

    // Shown at once, then replaced with what another admin has saved since
    await expect.element(textbox).toHaveValue('cms.example');
    additionsUsers.allowedDomains = ['cms.example', 'new.example'];
    loading.resolve();
    await expect.element(textbox).toHaveValue('cms.example\nnew.example');
    await unmount();

    // What the user has typed meanwhile is kept
    /** @type {PromiseWithResolvers<void>} */
    const slow = Promise.withResolvers();

    vi.mocked(loadSiteSettings).mockReturnValueOnce(slow.promise);
    await render(DomainsPanel, { title: 'Domains' });
    await textbox.fill('typed.example');
    slow.resolve();
    await vi.waitFor(() => expect(loadSiteSettings).toHaveBeenCalledTimes(2));
    await expect.element(textbox).toHaveValue('typed.example');
  });

  test('shows why the settings couldn’t be loaded', async () => {
    vi.mocked(loadSiteSettings).mockRejectedValue(
      new Error('Forbidden', { cause: { message: 'Only admins can do this.' } }),
    );

    await render(DomainsPanel, { title: 'Domains' });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Only admins can do this.');
    await expect
      .element(page.getByRole('button', { name: 'Save Allowed Domains' }))
      .toHaveAttribute('aria-disabled', 'true');
  });
});
