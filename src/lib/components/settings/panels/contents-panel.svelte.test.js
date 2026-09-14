import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { prefs } from '$lib/services/user/prefs.svelte';

import ContentsPanel from './contents-panel.svelte';

describe('ContentsPanel', () => {
  test('offers the editor preferences', async () => {
    prefs.useDraftBackup = true;
    prefs.closeOnSave = false;
    prefs.closeWithEscape = true;

    await render(ContentsPanel, {});

    const switches = page.getByRole('switch');

    expect(switches.elements()).toHaveLength(3);
    await expect.element(switches.nth(0)).toBeChecked();
    await expect.element(switches.nth(1)).not.toBeChecked();

    await switches.nth(1).click();
    await expect.poll(() => prefs.closeOnSave).toBe(true);
  });
});
