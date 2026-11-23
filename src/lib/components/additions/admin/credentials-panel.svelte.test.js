import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  fetchCredentials,
  saveCredentials,
  sharedCredentials,
} from '$lib/services/additions/credentials.svelte';
import { backendName } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { getApiKeyServiceGroups } from '$lib/services/integrations/api-key-services';

import CredentialsPanel from './credentials-panel.svelte';

// The state is real, the requests aren’t
vi.mock('$lib/services/additions/credentials.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchCredentials: vi.fn(),
  saveCredentials: vi.fn(),
}));
vi.mock('$lib/services/integrations/api-key-services', async (importOriginal) => ({
  ...(await importOriginal()),
  getApiKeyServiceGroups: vi.fn(),
}));

const GROUPS = [
  {
    key: 'translators',
    titleKey: 'prefs.i18n.translators.api_keys.title',
    fieldLabelKey: 'prefs.i18n.translators.field_label',
    entries: [['deepl', { serviceLabel: 'DeepL', apiKeyPattern: /:fx$/ }]],
  },
  {
    key: 'stock_photos',
    titleKey: 'prefs.media.stock_photos.api_keys.title',
    fieldLabelKey: 'prefs.media.stock_photos.field_label',
    entries: [['pexels', { serviceLabel: 'Pexels' }]],
  },
];

describe('CredentialsPanel', () => {
  beforeEach(() => {
    backendName.current = 'github';
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github', skip_ci: true } });
    vi.mocked(getApiKeyServiceGroups).mockReturnValue(/** @type {any} */ (GROUPS));
    vi.mocked(fetchCredentials).mockImplementation(async () => {
      Object.assign(sharedCredentials, {
        apiKeys: { deepl: 'abc:fx' },
        deployHook: { url: 'https://example.com/hook', authHeader: '' },
      });
    });
    vi.mocked(saveCredentials).mockImplementation(async (credentials) => {
      Object.assign(sharedCredentials, structuredClone(credentials));
    });
  });

  afterEach(() => {
    backendName.current = undefined;
    cmsConfig.current = undefined;
    Object.assign(sharedCredentials, { apiKeys: {}, deployHook: null });
  });

  test('shows the shared credentials, and saves the changes together', async () => {
    await render(CredentialsPanel, { title: 'Credentials' });

    const main = page.getByRole('main', { name: 'Credentials' });
    const deepl = main.getByRole('textbox', { name: /^.DeepL. Key$/ });
    const pexels = main.getByRole('textbox', { name: /^.Pexels. API Key$/ });
    const hook = main.getByRole('textbox', { name: 'Hook URL' });

    await expect.element(main).toMatchTextContent(/everyone who signs in/);
    await expect.element(deepl).toHaveValue('abc:fx');
    await expect.element(pexels).toHaveValue('');
    await expect.element(hook).toHaveValue('https://example.com/hook');
    await expect
      .element(main.getByRole('heading', { name: 'Translation Service API Keys' }))
      .toBeVisible();

    await pexels.fill(' px-key ');
    await hook.fill('');
    await main.getByRole('button', { name: 'Save Credentials' }).click();

    await vi.waitFor(() =>
      expect(saveCredentials).toHaveBeenCalledWith({
        apiKeys: { deepl: 'abc:fx', pexels: 'px-key' },
        deployHook: null,
      }),
    );
    await expect
      .element(main.getByRole('status'))
      .toHaveTextContent('The credentials have been saved.');
    await expect.element(pexels).toHaveValue('px-key');

    // Editing again clears the notice
    await deepl.fill('def:fx');
    expect(main.getByRole('status').elements()).toHaveLength(0);
    await main.getByRole('button', { name: 'Save Credentials' }).click();
    await expect.element(main.getByRole('status')).toBeVisible();
    await main.getByRole('textbox', { name: /^Authorization header/ }).fill('Bearer x');
    expect(main.getByRole('status').elements()).toHaveLength(0);
    await hook.fill(' https://example.com/new ');
    await main.getByRole('button', { name: 'Save Credentials' }).click();
    await vi.waitFor(() =>
      expect(saveCredentials).toHaveBeenLastCalledWith({
        apiKeys: { deepl: 'def:fx', pexels: 'px-key' },
        deployHook: { url: 'https://example.com/new', authHeader: 'Bearer x' },
      }),
    );
  });

  test('refuses a key that doesn’t look right, and shows why saving failed', async () => {
    await render(CredentialsPanel, { title: 'Credentials' });

    const deepl = page.getByRole('textbox', { name: /^.DeepL. Key$/ });
    const save = page.getByRole('button', { name: 'Save Credentials' });

    await deepl.fill('wrong');
    await save.click();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The API key for \u2068DeepL\u2069 doesn’t look right.');
    expect(saveCredentials).not.toHaveBeenCalled();

    vi.mocked(saveCredentials).mockRejectedValueOnce(
      new Error('Forbidden', { cause: { message: 'Only admins can do this.' } }),
    );
    await deepl.fill('abc:fx');
    await save.click();
    await expect.element(page.getByRole('alert')).toHaveTextContent('Only admins can do this.');
  });

  test('leaves out the deploy hook unless deployments are left to the user', async () => {
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });

    await render(CredentialsPanel, { title: 'Credentials' });

    await expect.element(page.getByRole('textbox', { name: /^.DeepL. Key$/ })).toBeVisible();
    expect(page.getByRole('textbox', { name: 'Hook URL' }).elements()).toHaveLength(0);
  });

  test('shows why the credentials couldn’t be loaded', async () => {
    vi.mocked(fetchCredentials).mockRejectedValue(new Error('Network'));

    await render(CredentialsPanel, { title: 'Credentials' });

    await expect.element(page.getByRole('alert')).toMatchTextContent(/unexpected error/);
    expect(page.getByRole('button', { name: 'Save Credentials' }).elements()).toHaveLength(0);
  });
});
