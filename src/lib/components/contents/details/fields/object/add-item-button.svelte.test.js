import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import AddItemButton from './add-item-button.svelte';

/**
 * @import { KeyValueField, ListField } from '$lib/types/public';
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

  test('is hidden when the list is full, and disabled when told so', async () => {
    /** @type {ListField} */
    const fieldConfig = { name: 'tags', widget: 'list', max: 2 };

    await render(AddItemButton, { fieldConfig, items: ['a', 'b'] });
    expect(page.getByRole('button').elements()).toHaveLength(0);

    await render(AddItemButton, { fieldConfig, items: ['a'], disabled: true });
    await expect.element(page.getByRole('button')).toHaveAttribute('aria-disabled', 'true');

    await render(AddItemButton, { fieldConfig, items: ['a'] });
    await expect.element(page.getByRole('button').nth(1)).toHaveAttribute('aria-disabled', 'false');
  });

  test('is named after the singular label and hidden at the maximum for a KeyValue field', async () => {
    /** @type {KeyValueField} */
    const fieldConfig = { name: 'meta', widget: 'keyvalue', label_singular: 'Setting', max: 1 };

    await render(AddItemButton, { fieldConfig, items: [] });
    await expect.element(page.getByRole('button', { name: /Add\W+Setting\W*$/ })).toBeVisible();

    await render(AddItemButton, { fieldConfig, items: [['a', '1']] });
    expect(page.getByRole('button').elements()).toHaveLength(1);
  });

  test('is hidden when a list with variable types is full', async () => {
    await render(AddItemButton, {
      fieldConfig: {
        name: 'sections',
        widget: 'list',
        max: 1,
        types: [{ name: 'hero', fields: [] }],
      },
      items: [{ type: 'hero' }],
    });

    expect(page.getByRole('button').elements()).toHaveLength(0);
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
