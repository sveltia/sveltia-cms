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

  test('lists every shortcut with its keys in a labelled table', async () => {
    env.isMacOS = false;

    await render(ShortcutsDialog, { open: true });

    const table = page.getByRole('table', { name: 'Keyboard Shortcuts' });

    await expect.element(table).toBeVisible();
    expect(
      table
        .getByRole('row')
        .elements()
        .map((row) => [
          row.querySelector('.feature')?.textContent?.trim(),
          [...row.querySelectorAll('kbd')].map((kbd) => kbd.textContent).join('+'),
        ]),
    ).toEqual([
      ['View Content Library', 'Alt+1'],
      ['View Asset Library', 'Alt+2'],
      ['Search for entries and assets', 'Ctrl+F'],
      ['Create a new entry', 'Ctrl+E'],
      ['Save an entry', 'Ctrl+S'],
      ['Cancel entry editing', 'Escape'],
    ]);
    // Only the Close button is offered
    expect(page.getByRole('dialog').getByRole('button').elements()).toHaveLength(1);
  });

  test('opens and closes with the bound prop', async () => {
    const props = $state({ open: false });

    await render(ShortcutsDialog, props);
    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    props.open = true;
    await expect.element(page.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeVisible();

    // The dialog can be closed without a handler
    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => props.open).toBe(false);
  });
});
