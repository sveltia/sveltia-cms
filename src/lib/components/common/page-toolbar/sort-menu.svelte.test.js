import { sleep } from '@sveltia/utils/misc';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createRawState } from '$lib/services/utils/state.svelte';
import { initTestConfig } from '$lib/test/config';

import SortMenu from './sort-menu.svelte';

describe('SortMenu', () => {
  // The popup opens right-aligned to the button, so give it room, or it overflows the viewport
  beforeEach(() => {
    document.body.style.paddingInlineStart = '320px';
  });

  afterEach(() => {
    document.body.style.paddingInlineStart = '';
  });

  test('offers both orders for each key, worded by type', async () => {
    const currentView = createRawState(
      /** @type {any} */ ({ sort: { key: 'title', order: 'ascending' } }),
    );

    await render(SortMenu, {
      currentView,
      'aria-controls': 'entry-list',
      sortKeys: [
        { key: 'title', label: 'Title' },
        { key: 'date', label: 'Date' },
        { key: 'price', label: 'Price', type: 'number' },
      ],
    });

    await page.getByRole('button', { name: 'Sort' }).click();
    await sleep(150);

    const menu = page.getByRole('menu', { name: 'Sorting Options' });

    await expect.element(menu).toHaveAttribute('aria-controls', 'entry-list');
    expect(
      menu
        .getByRole('menuitemradio')
        .elements()
        .map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual([
      '\u2068Title\u2069, A to Z check',
      '\u2068Title\u2069, Z to A',
      '\u2068Date\u2069, old to new',
      '\u2068Date\u2069, new to old',
      '\u2068Price\u2069, small to large',
      '\u2068Price\u2069, large to small',
    ]);

    await menu.getByRole('menuitemradio', { name: '\u2068Date\u2069, new to old' }).click();
    await expect.poll(() => currentView.current.sort).toEqual({ key: 'date', order: 'descending' });
  });

  test('words the orders of a date field by its type', async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          fields: [{ name: 'published', widget: 'datetime' }],
        },
      ],
    });

    const currentView = createRawState(/** @type {any} */ ({}));

    await render(SortMenu, {
      currentView,
      collectionName: 'posts',
      'aria-controls': 'entry-list',
      sortKeys: [{ key: 'published', label: 'Published' }],
    });

    await page.getByRole('button', { name: 'Sort' }).click();
    await sleep(150);
    await expect
      .element(page.getByRole('menuitemradio', { name: '\u2068Published\u2069, old to new' }))
      .toBeVisible();
  });

  test('separates the summary from the other keys, and has no options without keys', async () => {
    const currentView = createRawState(/** @type {any} */ ({}));

    await render(SortMenu, {
      currentView,
      'aria-controls': 'entry-list',
      sortKeys: [
        { key: '_summary', label: 'Summary' },
        { key: 'title', label: 'Title' },
      ],
    });

    await page.getByRole('button', { name: 'Sort' }).click();
    await sleep(150);

    const menu = page.getByRole('menu', { name: 'Sorting Options' });

    await expect.element(menu).toBeVisible();
    expect(menu.element().querySelectorAll('[role="separator"]')).toHaveLength(1);

    await userEvent.keyboard('{Escape}');
    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    // Nothing to sort by
    await render(SortMenu, { currentView, 'aria-controls': 'entry-list' });
    await page.getByRole('button', { name: 'Sort' }).nth(1).click();
    await sleep(150);
    expect(page.getByRole('menuitemradio').elements()).toHaveLength(0);
  });
});
