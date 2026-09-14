import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';

import ShortcutsDialog from './shortcuts-dialog.svelte';

describe('ShortcutsDialog', () => {
  test('lists the shortcuts with the platform’s modifier key', async () => {
    env.isMacOS = false;

    await render(ShortcutsDialog, { open: true });

    const dialog = page.getByRole('dialog', { name: 'Keyboard Shortcuts' });

    await expect.element(dialog).toBeVisible();

    const rows = dialog.getByRole('row').elements();

    expect(rows).toHaveLength(6);
    expect(rows[2].textContent).toContain('Search');
    expect([...rows[2].querySelectorAll('kbd')].map((kbd) => kbd.textContent)).toEqual([
      'Ctrl',
      'F',
    ]);
  });

  test('shows the Command key on macOS', async () => {
    env.isMacOS = true;

    await render(ShortcutsDialog, { open: true });

    expect(page.getByRole('row').elements()[2].querySelector('kbd')).toHaveTextContent('⌘');
  });

  test('reports when closed', async () => {
    const onClose = vi.fn();
    const props = $state({ open: true, onClose });

    await render(ShortcutsDialog, props);
    await page.getByRole('button', { name: 'Close' }).click();

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(props.open).toBe(false);
  });
});
