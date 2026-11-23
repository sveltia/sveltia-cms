import { addMessages, locale } from '@sveltia/i18n';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import Breadcrumb from './breadcrumb.svelte';

/**
 * Build the items of a trail four folders deep, with a spy on each ancestor.
 * @returns {{ items: any[], clicks: import('vitest').Mock[] }} Items and spies.
 */
const createItems = () => {
  const clicks = [vi.fn(), vi.fn(), vi.fn()];

  return {
    items: [
      { label: 'Shared with me', onClick: clicks[0] },
      { label: '2026_WebDev', onClick: clicks[1] },
      { label: 'Portal Site Launch Preparation', onClick: clicks[2] },
      { label: 'Logo Data' },
    ],
    clicks,
  };
};

/**
 * Get the text of the trail as shown, with the whitespace collapsed. The hidden copy the trail is
 * measured with is left out, as it is from `innerText`.
 * @returns {string} Text.
 */
const getText = () =>
  /** @type {HTMLElement} */ (page.getByRole('navigation').element()).innerText
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Wait for the trail to have been laid out.
 * @returns {Promise<void>}
 */
const waitForLayout = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

describe('Breadcrumb', () => {
  // Register a right-to-left locale, without strings, so it can be switched to
  beforeAll(() => {
    addMessages('ar', {});
  });

  afterEach(() => {
    document.body.style.width = '';
  });

  test('lists the folders, each ancestor leading back to itself', async () => {
    document.body.style.width = '900px';

    const { items, clicks } = createItems();

    await render(Breadcrumb, { items });

    const nav = page.getByRole('navigation', { name: 'Folder' });

    await waitForLayout();
    expect(getText()).toBe(
      'Shared with me chevron_right 2026_WebDev chevron_right Portal Site Launch Preparation ' +
        'chevron_right Logo Data',
    );
    // The current folder is text rather than a button
    expect(nav.getByRole('button').elements()).toHaveLength(3);

    await nav.getByRole('button', { name: '2026_WebDev' }).click();
    expect(clicks[1]).toHaveBeenCalledOnce();
    expect(clicks[0]).not.toHaveBeenCalled();
  });

  test('cuts the names short, then folds the middle into a menu when they don’t fit', async () => {
    // The icon font may not have loaded yet, making a separator as wide as its name, so the trail
    // is given more room than it needs in the app, and less than it needs either way
    document.body.style.width = '900px';

    const { items, clicks } = createItems();
    const props = $state({ items });

    await render(Breadcrumb, props);

    const nav = page.getByRole('navigation', { name: 'Folder' });

    // Every name is cut short to a few characters first, which is enough at this width
    await waitForLayout();
    expect(getText()).toContain('2026_WebDev');
    expect(nav.getByRole('button', { name: 'More Folders' }).elements()).toHaveLength(0);

    // Narrower, and the names can’t be cut any further, so the middle is folded
    document.body.style.width = '300px';
    await expect.element(nav.getByRole('button', { name: 'More Folders' })).toBeInTheDocument();
    expect(getText()).toBe('Shared with me chevron_right more_horiz chevron_right Logo Data');

    await nav.getByRole('button', { name: 'More Folders' }).click();

    const menu = page.getByRole('menu', { name: 'More Folders' });

    expect(
      menu
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['folder 2026_WebDev', 'folder Portal Site Launch Preparation']);
    await menu.getByRole('menuitem', { name: 'Portal Site Launch Preparation' }).click();
    expect(clicks[2]).toHaveBeenCalledOnce();

    // Wider again, and the trail unfolds
    document.body.style.width = '900px';
    await expect
      .poll(() => nav.getByRole('button', { name: 'More Folders' }).elements())
      .toEqual([]);
    expect(getText()).toContain('Portal Site Launch Preparation');

    // A new trail is laid out afresh
    document.body.style.width = '300px';
    await expect.element(nav.getByRole('button', { name: 'More Folders' })).toBeInTheDocument();
    props.items = [{ label: 'Root', onClick: vi.fn() }, { label: 'Here' }];
    await expect.poll(() => getText()).toBe('Root chevron_right Here');
  });

  test('never folds a trail without a middle', async () => {
    document.body.style.width = '120px';

    await render(Breadcrumb, {
      items: [{ label: 'A rather long folder name', onClick: vi.fn() }, { label: 'Another' }],
    });

    await waitForLayout();
    expect(page.getByRole('button', { name: 'More Folders' }).elements()).toHaveLength(0);
    expect(getText()).toBe('A rather long folder name chevron_right Another');
  });

  test('points the separators the other way in a right-to-left locale', async () => {
    locale.set('ar');

    try {
      await render(Breadcrumb, { items: [{ label: 'A', onClick: vi.fn() }, { label: 'B' }] });
      expect(getText()).toBe('A chevron_left B');
    } finally {
      locale.set('en-US');
    }
  });
});
