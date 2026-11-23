import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { sharedCredentials } from '$lib/services/additions/credentials.svelte';
import { loadAdditions } from '$lib/services/app/additions';
import { cmsConfig } from '$lib/services/config';
import { prefs } from '$lib/services/user/prefs.svelte';

import ApiKeyInput from './api-key-input.svelte';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

// The real module loads the preferences from local storage and applies them to the document in
// root effects, which have nothing to do with the input
vi.mock('$lib/services/user/prefs.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return { prefs: createState({}) };
});

const service = /** @type {TranslationService} */ ({
  serviceId: 'google',
  apiKeyPattern: /^AIza[0-9A-Za-z_-]{35}$/,
});

const validKey = `AIza${'a'.repeat(35)}`;

/**
 * Render the input.
 * @returns {Promise<{ onChange: import('vitest').Mock, input: import('vitest/browser').Locator }>}
 * Change handler and the input locator.
 */
const renderInput = async () => {
  const onChange = vi.fn();

  await render(ApiKeyInput, { serviceId: 'google', service, ariaLabel: 'API key', onChange });

  return { onChange, input: page.getByRole('textbox', { name: 'API key' }) };
};

describe('ApiKeyInput', () => {
  beforeEach(() => {
    prefs.apiKeys = {};
    sharedCredentials.apiKeys = {};
  });

  test('says when an admin’s key is used, until the user enters their own', async () => {
    // Credentials are only shared with Sveltia CMS Additions
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github', repo: 'me/site', auth_type: 'additions' },
    });
    sharedCredentials.apiKeys = { google: validKey };

    try {
      await loadAdditions();

      const { input } = await renderInput();

      await expect.element(input).toHaveValue('');
      await expect.element(input).toHaveAttribute('placeholder', 'Provided by your administrator');

      await input.fill(validKey);
      await input.element().blur();
      await expect.element(input).not.toHaveAttribute('placeholder');
    } finally {
      cmsConfig.current = undefined;
    }
  });

  test('shows the saved key', async () => {
    prefs.apiKeys = { google: validKey };

    const { input } = await renderInput();

    await expect.element(input).toHaveValue(validKey);
    // The key is masked until revealed
    await expect.element(input).toHaveStyle('-webkit-text-security: disc');
    await page.getByRole('button', { name: 'Show Secret' }).click();
    await expect.element(input).toHaveStyle('-webkit-text-security: none');
  });

  test('saves a valid key', async () => {
    const { input, onChange } = await renderInput();

    await input.fill(` ${validKey} `);
    await input.element().blur();

    expect(prefs.apiKeys?.google).toBe(validKey);
    expect(onChange).toHaveBeenCalledWith({ message: 'API key saved.', status: 'success' });
  });

  test('rejects an invalid key', async () => {
    prefs.apiKeys = { google: validKey };

    const { input, onChange } = await renderInput();

    await input.fill('invalid');
    await input.element().blur();

    expect(prefs.apiKeys?.google).toBe('');
    expect(onChange).toHaveBeenCalledWith({
      message: 'The provided API key is invalid. Please double-check and try again.',
      status: 'error',
    });
  });

  test('removes the key when cleared', async () => {
    prefs.apiKeys = { google: validKey };

    const { input, onChange } = await renderInput();

    await input.fill('');
    await input.element().blur();

    expect(prefs.apiKeys?.google).toBe('');
    expect(onChange).toHaveBeenCalledWith({ message: 'API key removed.', status: 'success' });
  });
});
