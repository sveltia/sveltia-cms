import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import MoveToDialog from './move-to-dialog.svelte';

describe('MoveToDialog', () => {
  test('submits a valid position with the Enter key', async () => {
    const onMove = vi.fn();

    await render(MoveToDialog, { open: true, index: 4, itemCount: 50, onMove });

    const input = page.getByRole('spinbutton', { name: 'Position' });

    await expect.element(input).toHaveValue('5');
    await input.fill('51');
    await userEvent.keyboard('{Enter}');
    expect(onMove).not.toHaveBeenCalled();
    await input.fill('50');
    await userEvent.keyboard('{Enter}');
    expect(onMove).toHaveBeenCalledExactlyOnceWith(49);
  });

  test('submits a valid position with the OK button', async () => {
    const onMove = vi.fn();

    await render(MoveToDialog, { open: true, index: 0, itemCount: 5, onMove });
    await page.getByRole('spinbutton', { name: 'Position' }).fill('3');
    await page.getByRole('button', { name: 'OK' }).click();
    await vi.waitFor(() => expect(onMove).toHaveBeenCalledExactlyOnceWith(2));
  });
});
