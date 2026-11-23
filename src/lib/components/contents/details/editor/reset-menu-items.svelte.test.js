import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ResetMenuItems from './reset-menu-items.svelte';

describe('ResetMenuItems', () => {
  test('lists the available actions after a separator', async () => {
    const onSelect = vi.fn();

    const { container } = await render(ResetMenuItems, {
      scope: 'entry',
      available: { revert: false, restore: true, clear: true },
      onSelect,
    });

    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(
      page
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Revert All Changes', 'Restore Default', 'Clear All']);
    await expect
      .element(page.getByRole('menuitem', { name: 'Revert All Changes' }))
      .toHaveAttribute('aria-disabled', 'true');

    await page.getByRole('menuitem', { name: 'Clear All' }).click();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('clear');
  });

  test('leaves out the actions not offered and the separator', async () => {
    const { container } = await render(ResetMenuItems, {
      scope: 'field',
      available: { revert: true },
      separator: false,
      onSelect: vi.fn(),
    });

    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);
    expect(
      page
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Revert Changes']);
  });
});
