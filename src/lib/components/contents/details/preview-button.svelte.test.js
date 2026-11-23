import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createRawState } from '$lib/services/utils/state.svelte';

import PreviewButton from './preview-button.svelte';

describe('PreviewButton', () => {
  test('toggles the pane between editing and previewing', async () => {
    const thisPane = createRawState(/** @type {any} */ ({ mode: 'edit', locale: 'en' }));

    await render(PreviewButton, { thisPane });

    const button = page.getByRole('button', { name: 'Preview' });

    await expect.element(button).toHaveAttribute('aria-pressed', 'false');

    await button.click();
    expect(thisPane.current).toEqual({ mode: 'preview', locale: 'en' });
    await expect.element(button).toHaveAttribute('aria-pressed', 'true');

    await button.click();
    expect(thisPane.current).toEqual({ mode: 'edit', locale: 'en' });
  });

  test('starts previewing a pane that isn’t set up yet', async () => {
    const thisPane = createRawState(/** @type {any} */ (null));

    await render(PreviewButton, { thisPane });
    await page.getByRole('button', { name: 'Preview' }).click();
    expect(thisPane.current).toEqual({ mode: 'preview', locale: '' });
  });
});
