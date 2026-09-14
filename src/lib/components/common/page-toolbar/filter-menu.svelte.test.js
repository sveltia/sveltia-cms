import { sleep } from '@sveltia/utils/misc';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createRawState } from '$lib/services/utils/state.svelte';

import FilterMenu from './filter-menu.svelte';

const filters = [
  { label: 'Drafts', field: 'draft', pattern: true },
  { label: 'Featured', field: 'featured', pattern: true },
];

/**
 * Open the menu. A Sveltia UI menu starts handling clicks 100 ms after it’s opened.
 */
const openMenu = async () => {
  await page.getByRole('button', { name: 'Filter' }).click();
  await sleep(150);
};

/**
 * Whether the menu popup is open.
 * @returns {boolean} Result.
 */
const isMenuOpen = () => !!document.querySelector('dialog.popup.open');

/**
 * Get the open menu popup. A closed popup can linger in the DOM for a while, so the open one has
 * to be picked explicitly.
 * @returns {import('vitest/browser').Locator} Locator.
 */
const getOpenMenu = () =>
  page.elementLocator(/** @type {HTMLElement} */ (document.querySelector('dialog.popup.open')));

describe('FilterMenu', () => {
  // The popup opens right-aligned to the button, so give it room, or it overflows the viewport
  beforeEach(() => {
    document.body.style.paddingInlineStart = '320px';
  });

  afterEach(() => {
    document.body.style.paddingInlineStart = '';
  });

  test('applies a single filter, or none', async () => {
    const currentView = createRawState(/** @type {any} */ ({}));

    await render(FilterMenu, { currentView, filters, 'aria-controls': 'entry-list' });
    await openMenu();

    const menu = page.getByRole('menu', { name: 'Filtering Options' });
    const items = menu.getByRole('menuitemradio');

    await expect.element(menu).toHaveAttribute('aria-controls', 'entry-list');
    expect(items.elements().map((el) => el.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'None check',
      'Drafts',
      'Featured',
    ]);

    await items.nth(1).click();
    await expect.poll(() => currentView.current.filter).toEqual({ field: 'draft', pattern: true });
    // Choosing an item closes the menu
    await expect.poll(isMenuOpen).toBe(false);

    await openMenu();
    await getOpenMenu().getByRole('menuitemradio', { name: 'None' }).click();
    await expect.poll(() => currentView.current.filter).toBe(undefined);
  });

  test('toggles several filters when multiple are allowed', async () => {
    // A view may not have any filter yet
    const currentView = createRawState(/** @type {any} */ ({}));

    await render(FilterMenu, { currentView, filters, multiple: true, 'aria-controls': 'list' });
    await openMenu();

    expect(page.getByRole('menuitemcheckbox').elements()).toHaveLength(2);
    await page.getByRole('menuitemcheckbox', { name: 'Drafts' }).click();
    await expect
      .poll(() => currentView.current.filters)
      .toEqual([{ field: 'draft', pattern: true }]);
    await expect.poll(isMenuOpen).toBe(false);

    await openMenu();
    await getOpenMenu().getByRole('menuitemcheckbox', { name: 'Featured' }).click();
    await expect
      .poll(() => currentView.current.filters)
      .toEqual([
        { field: 'draft', pattern: true },
        { field: 'featured', pattern: true },
      ]);
    await expect.poll(isMenuOpen).toBe(false);

    await openMenu();
    await page.getByRole('menuitemcheckbox', { name: 'Drafts' }).click();
    await expect
      .poll(() => currentView.current.filters)
      .toEqual([{ field: 'featured', pattern: true }]);
  });

  test('offers no filtering without any filter', async () => {
    const currentView = createRawState(/** @type {any} */ ({}));

    await render(FilterMenu, { currentView, 'aria-controls': 'entry-list' });
    await page.getByRole('button', { name: 'Filter' }).click();
    await sleep(150);
    expect(page.getByRole('menuitemradio').elements()).toHaveLength(1);
  });
});
