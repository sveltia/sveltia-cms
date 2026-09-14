import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { prefs } from '$lib/services/user/prefs.svelte';

import CloudServiceAuth from './cloud-service-auth.svelte';

describe('CloudServiceAuth', () => {
  beforeEach(() => {
    prefs.apiKeys = {};
    prefs.logins = {};
  });

  test('saves a valid API key for a stock photo service', async () => {
    const onAuth = vi.fn();

    const { container } = await render(CloudServiceAuth, {
      serviceProps: /** @type {any} */ ({
        serviceType: 'stock_assets',
        serviceId: 'unsplash',
        serviceLabel: 'Unsplash',
        authType: 'api_key',
        developerURL: 'https://unsplash.com/developers',
        apiKeyURL: 'https://unsplash.com/oauth/applications',
        apiKeyPattern: /^[a-z]{5}$/,
      }),
      onAuth,
    });

    expect(container.querySelectorAll('a')).toHaveLength(2);

    const input = page.getByRole('textbox', { name: '\u2068Unsplash\u2069 API Key' });

    await input.fill('12345');
    expect(onAuth).not.toHaveBeenCalled();

    await input.fill(' abcde ');
    expect(prefs.apiKeys?.unsplash).toBe('abcde');
    expect(onAuth).toHaveBeenCalledOnce();
  });

  test('signs in to a cloud storage service with a username and password', async () => {
    const signIn = vi.fn().mockResolvedValue(true);
    const onAuth = vi.fn();

    await render(CloudServiceAuth, {
      serviceProps: /** @type {any} */ ({
        serviceType: 'cloud_storage',
        serviceId: 'example',
        serviceLabel: 'Example Storage',
        authType: 'password',
        signIn,
      }),
      onAuth,
    });

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('Enter your password for \u2068Example Storage\u2069.');

    const button = page.getByRole('button', { name: 'Sign In' });

    await expect.element(button).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('textbox', { name: 'Username' }).fill(' me ');
    await page.getByRole('textbox', { name: 'Password' }).fill(' secret ');
    await expect.element(button).toHaveAttribute('aria-disabled', 'false');
    await button.click();

    await vi.waitFor(() => expect(signIn).toHaveBeenCalledWith('me', 'secret'));
    await vi.waitFor(() => expect(onAuth).toHaveBeenCalledOnce());
    expect(prefs.logins?.example).toBe('me secret');
  });

  test('reports a failed sign-in, and any earlier error', async () => {
    const signIn = vi.fn().mockResolvedValue(false);

    await render(CloudServiceAuth, {
      serviceProps: /** @type {any} */ ({
        serviceType: 'cloud_storage',
        serviceId: 'example',
        serviceLabel: 'Example Storage',
        authType: 'password',
        signIn,
      }),
      error: 'Your session has expired.',
    });

    await expect
      .element(page.getByRole('alert').nth(0))
      .toHaveTextContent('Your session has expired.');

    await page.getByRole('textbox', { name: 'Username' }).fill('me');
    await page.getByRole('textbox', { name: 'Password' }).fill('wrong');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect
      .element(page.getByRole('alert').nth(1))
      .toHaveTextContent('Username or password is incorrect. Please double-check and try again.');
  });
});
