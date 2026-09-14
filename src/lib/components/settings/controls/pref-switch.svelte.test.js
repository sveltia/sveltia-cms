import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { prefs } from '$lib/services/user/prefs.svelte';

import PrefSwitch from './pref-switch.svelte';

// The real module loads the preferences from local storage and applies them to the document in
// root effects, which have nothing to do with the switch
vi.mock('$lib/services/user/prefs.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return { prefs: createState({}) };
});

/**
 * Reset the preferences between tests, as the mocked module is shared.
 */
const resetPrefs = () => {
  Object.keys(prefs).forEach((key) => {
    delete (/** @type {Record<string, any>} */ (prefs)[key]);
  });
};

describe('PrefSwitch', () => {
  test('reflects the preference', async () => {
    resetPrefs();
    prefs.closeOnSave = false;

    await render(PrefSwitch, { key: 'closeOnSave', label: 'Close on save' });

    await expect.element(page.getByRole('switch', { name: 'Close on save' })).not.toBeChecked();
  });

  test('falls back to the default value when the preference is unset', async () => {
    resetPrefs();

    await render(PrefSwitch, { key: 'closeOnSave', label: 'Close on save' });
    await expect.element(page.getByRole('switch')).toBeChecked();
    // The default is written back to the preferences
    await vi.waitFor(() => expect(prefs.closeOnSave).toBe(true));

    resetPrefs();

    await render(PrefSwitch, { key: 'beta', label: 'Beta', defaultValue: false });
    await expect.element(page.getByRole('switch', { name: 'Beta' })).not.toBeChecked();
  });

  test('updates the preference when toggled', async () => {
    resetPrefs();
    prefs.closeOnSave = true;

    await render(PrefSwitch, { key: 'closeOnSave', label: 'Close on save' });
    await page.getByRole('switch').click();

    await vi.waitFor(() => expect(prefs.closeOnSave).toBe(false));
  });

  test('follows an external change to the preference', async () => {
    resetPrefs();
    prefs.closeOnSave = true;

    await render(PrefSwitch, { key: 'closeOnSave', label: 'Close on save' });
    prefs.closeOnSave = false;

    await expect.element(page.getByRole('switch')).not.toBeChecked();
  });
});
