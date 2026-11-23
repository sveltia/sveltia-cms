import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { prefs } from '$lib/services/user/prefs.svelte';
import { initTestConfig } from '$lib/test/config';

import MediaPanel from './media-panel.svelte';

describe('MediaPanel', () => {
  beforeEach(() => {
    prefs.apiKeys = {};
  });

  test('offers an API key input for each stock photo provider needing one by default', async () => {
    await initTestConfig();

    const { container } = await render(MediaPanel, {});

    // No cloud storage service is configured; Picsum needs no key
    expect(container.querySelectorAll('a')).toHaveLength(2);
    expect([...container.querySelectorAll('h4')].map((h4) => h4.textContent)).toEqual([
      'Pexels',
      'Pixabay',
      'Unsplash',
    ]);
  });

  test('limits the providers to the configured ones', async () => {
    await initTestConfig({
      media_libraries: { stock_assets: { providers: ['unsplash', 'pexels'] } },
    });

    const { container } = await render(MediaPanel, {});

    expect([...container.querySelectorAll('h4')].map((h4) => h4.textContent)).toEqual([
      'Pexels',
      'Unsplash',
    ]);

    const input = page.getByRole('textbox', { name: '\u2068Unsplash\u2069 API Key' });

    await input.fill('a'.repeat(40));
    await input.element().blur();
    expect(prefs.apiKeys?.unsplash).toBe('a'.repeat(40));
  });

  test('offers an API key input for a configured cloud storage service', async () => {
    await initTestConfig({
      media_libraries: {
        uploadcare: { config: { publicKey: 'abc' } },
        stock_assets: { providers: ['picsum'] },
      },
    });

    const onChange = vi.fn();
    const { container } = await render(MediaPanel, { onChange });

    expect([...container.querySelectorAll('h4')].map((h4) => h4.textContent)).toEqual([
      'Uploadcare',
    ]);

    const input = page.getByRole('textbox', { name: '\u2068Uploadcare\u2069 API Key' });

    await input.fill('0123456789abcdef0123');
    await input.element().blur();
    expect(prefs.apiKeys?.uploadcare).toBe('0123456789abcdef0123');
    expect(onChange).toHaveBeenCalledWith({ message: 'API key saved.', status: 'success' });
  });
});
