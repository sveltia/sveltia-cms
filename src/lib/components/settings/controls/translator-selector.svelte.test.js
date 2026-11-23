import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { prefs } from '$lib/services/user/prefs.svelte';

import TranslatorSelector from './translator-selector.svelte';

describe('TranslatorSelector', () => {
  test('selects the default translation service', async () => {
    prefs.defaultTranslationService = 'google';

    await render(TranslatorSelector, {});

    const select = page.getByRole('combobox', { name: 'Select Service' });

    await expect.element(select).toHaveTextContent('Google Cloud Translation');
    await select.click();
    await page.getByRole('option', { name: 'Mistral' }).click();

    await expect.poll(() => prefs.defaultTranslationService).toBe('mistral');
  });
});
