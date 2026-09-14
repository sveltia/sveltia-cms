import { sleep } from '@sveltia/utils/misc';
import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import EditOptionsMenu from './edit-options-menu.svelte';

/**
 * Open the menu.
 * @returns {Promise<void>}
 */
const openMenu = async () => {
  await page.getByRole('button', { name: 'Show Edit Options' }).click();
  // A Sveltia UI menu starts handling clicks 100 ms after it’s opened
  await sleep(150);
};

describe('EditOptionsMenu', () => {
  test('offers the actions that have handlers', async () => {
    const onEdit = vi.fn();
    const onRename = vi.fn();

    await render(EditOptionsMenu, { canEdit: true, canRename: true, onEdit, onRename });
    await openMenu();

    const menu = page.getByRole('menu', { name: 'Edit Options' });

    expect(
      menu
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Edit', 'Rename']);

    await menu.getByRole('menuitem', { name: 'Edit Asset' }).click();
    expect(onEdit).toHaveBeenCalledOnce();
  });

  test('disables the actions that can’t be taken on the asset', async () => {
    await render(EditOptionsMenu, {
      canReplace: false,
      onEdit: vi.fn(),
      onRename: vi.fn(),
      onReplace: vi.fn(),
    });
    await openMenu();

    await expect.element(page.getByRole('menuitem', { name: 'Edit Asset' })).toBeDisabled();
    await expect.element(page.getByRole('menuitem', { name: 'Rename Asset' })).toBeDisabled();
    await expect.element(page.getByRole('menuitem', { name: 'Replace Asset' })).toBeDisabled();
  });

  test('disables every action in read-only mode', async () => {
    await render(EditOptionsMenu, {
      readOnly: true,
      canEdit: true,
      canRename: true,
      canReplace: true,
      onEdit: vi.fn(),
      onRename: vi.fn(),
      onReplace: vi.fn(),
    });
    await openMenu();

    expect(
      page
        .getByRole('menuitem')
        .elements()
        .every((el) => el.ariaDisabled === 'true'),
    ).toBe(true);
  });

  test('renders extra items before, and more items after a divider', async () => {
    const extraItems = createRawSnippet(() => ({
      /**
       * Render the content.
       * @returns {string} HTML.
       */
      render: () => '<div role="menuitem">Extra</div>',
    }));

    const moreItems = createRawSnippet(() => ({
      /**
       * Render the content.
       * @returns {string} HTML.
       */
      render: () => '<div role="menuitem">More</div>',
    }));

    await render(EditOptionsMenu, { canEdit: true, onEdit: vi.fn(), extraItems, moreItems });
    await openMenu();

    expect(
      page
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Extra', 'Edit', 'More']);
    expect(page.getByRole('separator').elements()).toHaveLength(1);
  });
});
