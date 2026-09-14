import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';

import ReorderControls from './reorder-controls.svelte';

// The real module detects the environment in a root effect; a plain state box can be toggled
vi.mock('$lib/services/user/env.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return { env: createState({ hasMouse: true }), initUserEnvDetection: vi.fn() };
});

describe('ReorderControls', () => {
  test('offers a drag handle with keyboard reordering when there is a mouse', async () => {
    env.hasMouse = true;

    const onGrab = vi.fn();
    const onRelease = vi.fn();
    const onMove = vi.fn();

    await render(ReorderControls, { index: 1, itemCount: 3, onGrab, onRelease, onMove });

    const handle = page.getByRole('button', { name: 'Reorder Item' });

    await expect.element(handle).toHaveAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown Home End');

    await handle.element().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(onGrab).toHaveBeenCalledOnce();
    globalThis.dispatchEvent(new PointerEvent('pointerup'));
    expect(onRelease).toHaveBeenCalledOnce();

    await handle.element().focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onMove).toHaveBeenLastCalledWith(0, 'reorder');
    await userEvent.keyboard('{End}');
    expect(onMove).toHaveBeenLastCalledWith(2, 'reorder');
    // A key that doesn’t move the item is ignored
    await userEvent.keyboard('{Enter}');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  test('offers up/down buttons on a touch device', async () => {
    env.hasMouse = false;

    const onMove = vi.fn();

    await render(ReorderControls, { index: 0, itemCount: 3, onMove });

    const up = page.getByRole('button', { name: 'Move Up' });
    const down = page.getByRole('button', { name: 'Move Down' });

    await expect.element(up).toHaveAttribute('aria-disabled', 'true');
    await down.click();
    expect(onMove).toHaveBeenCalledWith(1, 'move-down');

    await render(ReorderControls, { index: 2, itemCount: 3, onMove });
    await expect
      .element(page.getByRole('button', { name: 'Move Down' }).nth(1))
      .toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Move Up' }).nth(1).click();
    expect(onMove).toHaveBeenCalledWith(1, 'move-up');
  });

  test('can be disabled altogether', async () => {
    env.hasMouse = true;
    await render(ReorderControls, { index: 1, itemCount: 3, disabled: true });
    await expect.element(page.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });
});
