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

  test('expands and collapses all the groups', async () => {
    const currentView = createRawState(
      /** @type {any} */ ({
        group: { field: 'category' },
        collapsedGroups: { '["category"]': ['old'], '["year"]': ['2010'] },
      }),
    );

    await render(GroupMenu, {
      currentView,
      'aria-controls': 'entry-list',
      groups: [{ label: 'Category', field: 'category' }],
      groupNames: ['blog', 'news'],
    });

    /**
     * Open the menu and get the popup holding it.
     * @returns {Promise<import('vitest/browser').Locator>} Popup locator.
     */
    const openMenu = async () => {
      await page.getByRole('button', { name: 'Group' }).click();
      await sleep(150);

      return page.elementLocator(
        /** @type {HTMLElement} */ (document.querySelector('dialog.popup.open')),
      );
    };

    let menu = await openMenu();
    const items = menu.getByRole('menuitem');

    // The actions follow the grouping options, after a separator
    expect(
      [...menu.element().querySelectorAll('[role^="menuitem"], [role="separator"]')].map(
        (el) =>
          el.getAttribute('role') +
          (el.textContent ? `:${el.textContent.replace(/\s+/g, ' ').trim()}` : ''),
      ),
    ).toEqual([
      'menuitemradio:None',
      'menuitemradio:Category check',
      'separator',
      'menuitem:Expand All',
      'menuitem:Collapse All',
    ]);
    // Every listed group is expanded already
    await expect.element(items.nth(0)).toHaveAttribute('aria-disabled', 'true');
    await expect.element(items.nth(1)).toHaveAttribute('aria-disabled', 'false');

    await items.nth(1).click();
    // Only the current grouping’s state is changed
    await expect
      .poll(() => currentView.current.collapsedGroups)
      .toEqual({ '["category"]': ['blog', 'news'], '["year"]': ['2010'] });
    await waitForMenuToClose();

    menu = await openMenu();
    await expect
      .element(menu.getByRole('menuitem', { name: 'Expand All' }))
      .toHaveAttribute('aria-disabled', 'false');
    await expect
      .element(menu.getByRole('menuitem', { name: 'Collapse All' }))
      .toHaveAttribute('aria-disabled', 'true');
    await menu.getByRole('menuitem', { name: 'Expand All' }).click();
    await expect.poll(() => currentView.current.collapsedGroups).toEqual({ '["year"]': ['2010'] });
  });

  test('disables the expand and collapse actions without any captioned group', async () => {
    const currentView = createRawState(/** @type {any} */ ({}));

    await render(GroupMenu, {
      currentView,
      'aria-controls': 'entry-list',
      groups: [{ label: 'Category', field: 'category' }],
      groupNames: ['*'],
    });

    await page.getByRole('button', { name: 'Group' }).click();
    await sleep(150);

    const items = page.getByRole('menu', { name: 'Grouping Options' }).getByRole('menuitem');

    await expect.element(items.nth(0)).toHaveAttribute('aria-disabled', 'true');
    await expect.element(items.nth(1)).toHaveAttribute('aria-disabled', 'true');
  });

  test('offers no grouping without any group', async () => {
    const currentView = createRawState(/** @type {any} */ ({}));

    await render(GroupMenu, { currentView, 'aria-controls': 'entry-list' });
    await page.getByRole('button', { name: 'Group' }).click();
    await sleep(150);
    expect(page.getByRole('menuitemradio').elements()).toHaveLength(1);
  });
});
