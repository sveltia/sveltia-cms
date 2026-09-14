import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import AddItemButton from './add-item-button.svelte';

/**
 * @import { ListField } from '$lib/types/public';
 */

// An interpolated value is wrapped in bidi isolation characters, so match it loosely
describe('AddItemButton', () => {
  test('adds an item, named after the singular label', async () => {
    const addItem = vi.fn();

    await render(AddItemButton, {
      fieldConfig: { name: 'authors', widget: 'list', label: 'Authors', label_singular: 'Author' },
      addItem,
    });

    await page.getByRole('button', { name: /Add\W+Author\W*$/ }).click();

    expect(addItem).toHaveBeenCalledWith();
  });

  test('falls back to the field label, then the field name', async () => {
    await render(AddItemButton, {
      fieldConfig: { name: 'authors', widget: 'list', label: 'Authors' },
    });
    await expect.element(page.getByRole('button', { name: /Add\W+Authors/ })).toBeVisible();

    await render(AddItemButton, { fieldConfig: { name: 'tags', widget: 'list' } });
    await expect.element(page.getByRole('button', { name: /Add\W+tags/ })).toBeVisible();
    // Nothing happens without a handler
    await page.getByRole('button', { name: /Add\W+tags/ }).click();
  });

  test('is disabled when the list is full or told so', async () => {
    /** @type {ListField} */
    const fieldConfig = { name: 'tags', widget: 'list', max: 2 };

    await render(AddItemButton, { fieldConfig, items: ['a', 'b'] });
    await expect.element(page.getByRole('button')).toHaveAttribute('aria-disabled', 'true');

    await render(AddItemButton, { fieldConfig, items: ['a'], disabled: true });
    await expect.element(page.getByRole('button').nth(1)).toHaveAttribute('aria-disabled', 'true');

    await render(AddItemButton, { fieldConfig, items: ['a'] });
    await expect.element(page.getByRole('button').nth(2)).toHaveAttribute('aria-disabled', 'false');
  });

  test('offers a menu of types for a list with variable types', async () => {
    const addItem = vi.fn();

    await render(AddItemButton, {
      fieldConfig: {
        name: 'sections',
        widget: 'list',
        types: [
          { name: 'hero', label: 'Hero', fields: [] },
          { name: 'gallery', fields: [] },
        ],
      },
      addItem,
    });

    await page.getByRole('button', { name: /Add\W+sections/ }).click();

    const menu = page.getByRole('menu', { name: 'Select List Type' });

    await expect.element(menu.getByRole('menuitem', { name: 'Hero' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'gallery' }).click();

    expect(addItem).toHaveBeenCalledWith({ type: 'gallery' });
  });
});
