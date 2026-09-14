import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { allTranslationServices } from '$lib/services/integrations/translators';
import { prefs } from '$lib/services/user/prefs.svelte';

import I18nPanel from './i18n-panel.svelte';

describe('I18nPanel', () => {
  test('offers the service selector and an API key input per service', async () => {
    const { container } = await render(I18nPanel, {});

    await expect.element(page.getByRole('combobox', { name: 'Select Service' })).toBeVisible();
    expect(container.querySelector('a')).toHaveAttribute(
      'href',
      'https://sveltiacms.app/en/docs/integrations/translations',
    );
    expect([...container.querySelectorAll('h4')].map((h4) => h4.textContent)).toEqual(
      Object.values(allTranslationServices).map(({ serviceLabel }) => serviceLabel),
    );
    expect(page.getByRole('textbox').elements()).toHaveLength(
      Object.keys(allTranslationServices).length,
    );
  });

  test('saves an API key', async () => {
    prefs.apiKeys = {};

    const onChange = vi.fn();

    await render(I18nPanel, { onChange });

    const input = page.getByRole('textbox', { name: /Google Cloud Translation/ });
    const apiKey = 'AIzaSyA1234567890abcdefghijklmnopqrstuvwxyz'.slice(0, 39);

    await input.fill(apiKey);
    await input.element().blur();
    expect(prefs.apiKeys?.google).toBe(apiKey);
    expect(onChange).toHaveBeenCalledWith({ message: 'API key saved.', status: 'success' });
  });
});
