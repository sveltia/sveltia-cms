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

  test('offers the given view types on a large screen', async () => {
    env.isLargeScreen = true;

    const currentView = createRawState(/** @type {any} */ ({ type: 'table' }));

    await render(ViewSwitcher, { currentView, types: ['table', 'list', 'grid'] });

    const group = page.getByRole('radiogroup', { name: 'Switch View' });

    await expect
      .poll(() =>
        group
          .getByRole('radio')
          .elements()
          .map((el) => el.getAttribute('aria-label')),
      )
      .toEqual(['Table View', 'List View', 'Grid View']);
    await expect.element(group.getByRole('radio', { name: 'Table View' })).toBeChecked();

    await group.getByRole('radio', { name: 'List View' }).click();
    await expect.poll(() => currentView.current.type).toBe('list');

    await group.getByRole('radio', { name: 'Table View' }).click();
    await expect.poll(() => currentView.current.type).toBe('table');
  });

  test('selects the first type until the user picks one, or for a type not offered', async () => {
    env.isLargeScreen = true;

    const currentView = createRawState(/** @type {any} */ ({}));

    await render(ViewSwitcher, { currentView, types: ['table', 'list'] });

    const group = page.getByRole('radiogroup', { name: 'Switch View' });

    await expect.element(group.getByRole('radio', { name: 'Table View' })).toBeChecked();
    await expect.element(group.getByRole('radio', { name: 'List View' })).not.toBeChecked();

    // E.g. a saved grid view of a collection that no longer has thumbnails
    currentView.current = { type: 'grid' };
    await expect.element(group.getByRole('radio', { name: 'Table View' })).toBeChecked();

    currentView.current = { type: 'list' };
    await expect.element(group.getByRole('radio', { name: 'List View' })).toBeChecked();
  });

  test('offers to switch to the grid view on a small screen by default', async () => {
    env.isLargeScreen = false;

    // The default list view, when the grid view comes after it
    const currentView = createRawState(/** @type {any} */ ({}));

    await render(ViewSwitcher, { currentView });
    await page.getByRole('button', { name: 'Switch to Grid View' }).click();
    expect(currentView.current.type).toBe('grid');
  });

  test('renders nothing on a large screen with only one view type', async () => {
    env.isLargeScreen = true;

    const currentView = createRawState(/** @type {any} */ ({ type: 'list' }));
    const { container } = await render(ViewSwitcher, { currentView, types: ['list'] });

    await expect.poll(() => container.querySelector('.wrapper')).not.toBeNull();
    expect(page.getByRole('radiogroup').elements()).toHaveLength(0);
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  test('renders nothing on a small screen without both the list and grid views', async () => {
    env.isLargeScreen = false;

    const currentView = createRawState(/** @type {any} */ ({ type: 'table' }));
    const { container } = await render(ViewSwitcher, { currentView, types: ['table', 'list'] });

    await expect.poll(() => container.querySelector('.wrapper')).not.toBeNull();
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  test('toggles between the list and grid views on a small screen with the table view offered', async () => {
    env.isLargeScreen = false;

    // The table view is shown as a list on a small screen
    const currentView = createRawState(/** @type {any} */ ({ type: 'table' }));

    await render(ViewSwitcher, { currentView, types: ['table', 'list', 'grid'] });
    await page.getByRole('button', { name: 'Switch to Grid View' }).click();
    expect(currentView.current.type).toBe('grid');
    await page.getByRole('button', { name: 'Switch to List View' }).click();
    expect(currentView.current.type).toBe('list');
  });
});
