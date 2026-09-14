import { sleep } from '@sveltia/utils/misc';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createRawState } from '$lib/services/utils/state.svelte';

import GroupMenu from './group-menu.svelte';

/**
 * Wait until the menu popup has closed, which it does with a transition once an item is chosen.
 */
const waitForMenuToClose = async () => {
  await expect.poll(() => document.querySelector('dialog.popup.open')).toBeNull();
};

describe('GroupMenu', () => {
  // The popup opens right-aligned to the button, so give it room, or it overflows the viewport
  beforeEach(() => {
    document.body.style.paddingInlineStart = '320px';
  });

  afterEach(() => {
    document.body.style.paddingInlineStart = '';
  });

  test('groups the items by a field, or not at all', async () => {
    const currentView = createRawState(/** @type {any} */ ({}));

    await render(GroupMenu, {
      currentView,
      'aria-controls': 'entry-list',
      groups: [{ label: 'Category', field: 'category', pattern: '.*' }],
      noneLabel: 'Ungrouped',
    });

    await page.getByRole('button', { name: 'Group' }).click();
    await sleep(150);

    const items = page.getByRole('menu', { name: 'Grouping Options' }).getByRole('menuitemradio');

    expect(items.elements().map((el) => el.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Ungrouped check',
      'Category',
    ]);

    await items.nth(1).click();
    await expect
      .poll(() => currentView.current.group)
      .toEqual({ field: 'category', pattern: '.*' });

    await waitForMenuToClose();
    await page.getByRole('button', { name: 'Group' }).click();
    await sleep(150);
    await page
      .elementLocator(/** @type {HTMLElement} */ (document.querySelector('dialog.popup.open')))
      .getByRole('menuitemradio', { name: 'Ungrouped' })
      .click();
    await expect.poll(() => currentView.current.group).toBe(null);
  });

  test('offers no grouping without any group', async () => {
    const currentView = createRawState(/** @type {any} */ ({}));

    await render(GroupMenu, { currentView, 'aria-controls': 'entry-list' });
    await page.getByRole('button', { name: 'Group' }).click();
    await sleep(150);
    expect(page.getByRole('menuitemradio').elements()).toHaveLength(1);
  });
});
