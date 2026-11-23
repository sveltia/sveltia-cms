import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { prefs } from '$lib/services/user/prefs.svelte';

import AppearancePanel from './appearance-panel.svelte';

describe('AppearancePanel', () => {
  test('selects the theme', async () => {
    prefs.theme = 'auto';

    await render(AppearancePanel, {});

    const group = page.getByRole('radiogroup', { name: 'Select Theme' });

    await expect.element(group.getByRole('radio', { name: 'Automatic' })).toBeChecked();
    await group.getByRole('radio', { name: 'Dark' }).click();
    await expect.poll(() => prefs.theme).toBe('dark');
  });
});
