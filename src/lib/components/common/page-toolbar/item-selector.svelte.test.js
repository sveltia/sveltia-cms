import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createRawState } from '$lib/services/utils/state.svelte';

import ItemSelector from './item-selector.svelte';

describe('ItemSelector', () => {
  test('selects and deselects all the items, reporting the count', async () => {
    const allItems = /** @type {any[]} */ (['a', 'b', 'c']);
    const selectedItems = createRawState(/** @type {any[]} */ ([]));
    const { container } = await render(ItemSelector, { allItems, selectedItems });
    const checkbox = page.getByRole('checkbox', { name: 'Select All' });

    await expect.element(checkbox).not.toBeChecked();
    expect(container).toHaveTextContent('');

    await checkbox.click();
    expect(selectedItems.current).toEqual(['a', 'b', 'c']);
    await expect.element(checkbox).toBeChecked();
    expect(container).toHaveTextContent('check 3 of 3 selected');

    await checkbox.click();
    expect(selectedItems.current).toEqual([]);
  });

  test('shows a mixed state for a partial selection', async () => {
    const selectedItems = createRawState(/** @type {any[]} */ (['a']));

    await render(ItemSelector, { allItems: /** @type {any[]} */ (['a', 'b']), selectedItems });
    await expect.element(page.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    await expect.element(page.getByText('1 of 2 selected')).toBeVisible();

    // Selecting all from a partial selection
    await page.getByRole('checkbox').click();
    expect(selectedItems.current).toEqual(['a', 'b']);
  });

  test('is disabled without items', async () => {
    await render(ItemSelector, { allItems: [], selectedItems: createRawState([]) });
    await expect.element(page.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
  });
});
