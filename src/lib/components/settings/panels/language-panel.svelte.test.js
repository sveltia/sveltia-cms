import { addMessages } from '@sveltia/i18n';
import { beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { appLocaleLoading } from '$lib/services/app/i18n';
import { prefs } from '$lib/services/user/prefs.svelte';

import LanguagePanel from './language-panel.svelte';

describe('LanguagePanel', () => {
  beforeAll(() => {
    // Register a couple more UI languages, without strings
    addMessages('ja', {});
    addMessages('fr', {});
  });

  test('lists the UI languages by name, with the automatic option first', async () => {
    // No preference means the automatic option
    prefs.locale = undefined;
    appLocaleLoading.current = undefined;

    await render(LanguagePanel, {});

    const select = page.getByRole('combobox', { name: 'Select Language' });

    await expect.element(select).toHaveTextContent('Automatic');
    await select.click();

    expect(
      page
        .getByRole('option')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Automatic check', 'English (US)', 'French — Français', 'Japanese — 日本語']);

    await page.getByRole('option', { name: 'Japanese — 日本語' }).click();
    await expect.poll(() => prefs.locale).toBe('ja');
  });

  test('reports the language being switched to', async () => {
    prefs.locale = 'en-US';
    appLocaleLoading.current = 'fr';

    try {
      await render(LanguagePanel, {});
      await expect
        .element(page.getByRole('status'))
        .toHaveTextContent('info Information Switching to \u2068French\u2069…');
    } finally {
      appLocaleLoading.current = undefined;
    }
  });
});
