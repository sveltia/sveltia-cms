import { sleep } from '@sveltia/utils/misc';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';
import { createRawState } from '$lib/services/utils/state.svelte';

import ViewSwitcher from './view-switcher.svelte';

describe('ViewSwitcher', () => {
  test('switches between the list and grid views on a large screen', async () => {
    env.isLargeScreen = true;

    const currentView = createRawState(/** @type {any} */ ({ type: 'list' }));

    await render(ViewSwitcher, { currentView, 'aria-controls': 'entry-list' });
    await sleep(150);

    const group = page.getByRole('radiogroup', { name: 'Switch View' });

    await expect.element(group).toHaveAttribute('aria-controls', 'entry-list');
    await expect.element(group.getByRole('radio', { name: 'List View' })).toBeChecked();

    await group.getByRole('radio', { name: 'Grid View' }).click();
    await expect.poll(() => currentView.current.type).toBe('grid');

    await group.getByRole('radio', { name: 'List View' }).click();
    await expect.poll(() => currentView.current.type).toBe('list');
  });

  test('toggles the view with a single button on a small screen', async () => {
    env.isLargeScreen = false;

    const currentView = createRawState(/** @type {any} */ ({ type: 'list' }));

    await render(ViewSwitcher, { currentView });
    await page.getByRole('button', { name: 'Switch to Grid View' }).click();
    expect(currentView.current.type).toBe('grid');
    await page.getByRole('button', { name: 'Switch to List View' }).click();
    expect(currentView.current.type).toBe('list');
  });
});
