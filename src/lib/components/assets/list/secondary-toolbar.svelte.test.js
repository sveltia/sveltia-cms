import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { currentView } from '$lib/services/assets/view/settings';
import { env } from '$lib/services/user/env.svelte';
import { createRawState } from '$lib/services/utils/state.svelte';

import SecondaryToolbar from './secondary-toolbar.svelte';

const sortKeys = [{ key: 'name', label: 'Name' }];

describe('SecondaryToolbar', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    currentView.current = { type: 'grid', showInfo: false };
  });

  test('offers the list controls', async () => {
    const searchTerms = createRawState('');

    await render(SecondaryToolbar, {
      allItems: /** @type {any[]} */ (['a', 'b']),
      selectedItems: createRawState([]),
      totalCount: 2,
      sortKeys,
      searchTerms,
    });

    const toolbar = page.getByRole('toolbar', { name: 'Asset List' });

    await expect.element(toolbar.getByRole('checkbox', { name: 'Select All' })).toBeEnabled();
    await expect.element(toolbar.getByRole('button', { name: 'Sort' })).toBeEnabled();
    await expect.element(toolbar.getByRole('button', { name: 'Type' })).toBeEnabled();
    // Repository assets have nothing to group by
    expect(toolbar.getByRole('button', { name: 'Group' }).elements()).toHaveLength(0);

    await toolbar.getByRole('searchbox', { name: 'Search for Files' }).fill('logo');
    await expect.poll(() => searchTerms.current).toBe('logo');

    const infoButton = toolbar.getByRole('button', { name: 'Show Info' });

    await expect.element(infoButton).toHaveAttribute('aria-pressed', 'false');
    await infoButton.click();
    expect(currentView.current.showInfo).toBe(true);
    await expect
      .element(toolbar.getByRole('button', { name: 'Hide Info' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  test('offers the given grouping options', async () => {
    await render(SecondaryToolbar, {
      allItems: /** @type {any[]} */ (['a', 'b']),
      selectedItems: createRawState([]),
      totalCount: 2,
      sortKeys,
      groups: [{ label: 'Domain', field: 'domain' }],
    });

    await page.getByRole('button', { name: 'Group' }).click();

    const menu = page.getByRole('menu', { name: 'Grouping Options' });

    await expect.element(menu.getByRole('menuitemradio', { name: 'None' })).toBeChecked();
    await menu.getByRole('menuitemradio', { name: 'Domain' }).click();
    await expect.poll(() => currentView.current.group).toEqual({ field: 'domain' });
  });

  test('disables the controls that need more assets', async () => {
    await render(SecondaryToolbar, {
      allItems: /** @type {any[]} */ (['a']),
      selectedItems: createRawState([]),
      totalCount: 1,
      sortKeys,
    });

    expect(page.getByRole('searchbox').elements()).toHaveLength(0);
    await expect.element(page.getByRole('button', { name: 'Sort' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Type' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Show Info' })).toBeEnabled();
    await expect.element(page.getByRole('button', { name: 'Switch to List View' })).toBeEnabled();
  });

  test('disables everything without assets', async () => {
    await render(SecondaryToolbar, {
      allItems: [],
      selectedItems: createRawState([]),
      totalCount: 0,
      sortKeys,
    });

    await expect.element(page.getByRole('button', { name: 'Show Info' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Switch to List View' })).toBeDisabled();
  });

  test('drops the selector and the info button on a small screen', async () => {
    env.isSmallScreen = true;

    await render(SecondaryToolbar, {
      allItems: /** @type {any[]} */ (['a', 'b']),
      selectedItems: createRawState([]),
      totalCount: 2,
      sortKeys,
    });

    expect(page.getByRole('checkbox').elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Show Info' }).elements()).toHaveLength(0);
  });
});
