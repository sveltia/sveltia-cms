import { describe, expect, test } from 'vitest';

import { createResetMenuState } from './reset-menu.svelte.js';

describe('createResetMenuState()', () => {
  test('starts with nothing available and the dialog closed', () => {
    const menu = createResetMenuState(() => ({ restore: true, clear: true }));

    expect(menu.availability).toEqual({ restore: false, clear: false });
    expect(menu.action).toBe('revert');
    expect(menu.dialogOpen).toBe(false);
  });

  test('checks the availability on demand', () => {
    /** @type {{ restore: boolean, clear: boolean } | undefined} */
    let result = { restore: true, clear: false };
    const menu = createResetMenuState(() => result);

    menu.update();
    expect(menu.availability).toEqual({ restore: true, clear: false });

    // A check that can’t be made leaves the availability as it is
    result = undefined;
    menu.update();
    expect(menu.availability).toEqual({ restore: true, clear: false });
  });

  test('opens the dialog for the chosen action, which can be closed again', () => {
    const menu = createResetMenuState(() => undefined);

    menu.select('clear');
    expect(menu.action).toBe('clear');
    expect(menu.dialogOpen).toBe(true);

    menu.dialogOpen = false;
    expect(menu.dialogOpen).toBe(false);
    expect(menu.action).toBe('clear');
  });
});
