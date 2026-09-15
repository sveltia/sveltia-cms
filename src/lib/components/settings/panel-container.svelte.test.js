import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backendName } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { prefs } from '$lib/services/user/prefs.svelte';
import { waitForToastsToHide } from '$lib/test/toast';

import PanelContainer from './panel-container.svelte';
import AccessibilityPanel from './panels/accessibility-panel.svelte';
import AdvancedPanel from './panels/advanced-panel.svelte';
import I18nPanel from './panels/i18n-panel.svelte';

describe('PanelContainer', () => {
  test('renders the panel', async () => {
    const { container } = await render(PanelContainer, { Panel: AccessibilityPanel });

    expect(container.querySelector('.container h3')).toHaveTextContent('Underline Links');
    await expect.element(page.getByRole('switch')).toBeVisible();
  });

  test('reports a change made in the panel', async () => {
    prefs.apiKeys = {};

    await render(PanelContainer, { Panel: I18nPanel });

    const input = page.getByRole('textbox', { name: /Google Cloud Translation/ });

    await input.fill('AIzaSyA1234567890abcdefghijklmnopqrstuvwxyz'.slice(0, 39));
    await input.element().blur();
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success API key saved.');
    await waitForToastsToHide();
  });

  test('reports a successful change by default', async () => {
    backendName.current = 'github';
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github', skip_ci: true } });

    await render(PanelContainer, { Panel: AdvancedPanel });

    const input = page.getByRole('textbox', { name: 'Hook URL' });

    await input.fill('https://example.com/hook');
    await input.element().blur();
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Hook URL saved.');
    await waitForToastsToHide();
  });
});
