import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { prefs } from '$lib/services/user/prefs.svelte';

import AccessibilityPanel from './accessibility-panel.svelte';

describe('AccessibilityPanel', () => {
  test('toggles the link underline preference', async () => {
    prefs.underlineLinks = true;

    await render(AccessibilityPanel, {});

    const toggle = page.getByRole('switch', { name: 'Always Underline Links' });

    await expect.element(toggle).toBeChecked();
    await toggle.click();
    await expect.poll(() => prefs.underlineLinks).toBe(false);
  });
});
