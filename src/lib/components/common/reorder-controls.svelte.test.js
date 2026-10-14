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

  test('releases the item once when the press is cancelled', async () => {
    env.hasMouse = true;

    const onGrab = vi.fn();
    const onRelease = vi.fn();

    await render(ReorderControls, { index: 0, itemCount: 2, onGrab, onRelease });

    const handle = page.getByRole('button', { name: 'Reorder Item' }).element();

    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(onGrab).toHaveBeenCalledOnce();
    // A scroll gesture cancels the press, which may end outside the handle
    globalThis.dispatchEvent(new PointerEvent('pointercancel'));
    expect(onRelease).toHaveBeenCalledOnce();
    // The window listeners are gone, so a later press elsewhere doesn’t release the item again
    globalThis.dispatchEvent(new PointerEvent('pointerup'));
    globalThis.dispatchEvent(new PointerEvent('pointercancel'));
    expect(onRelease).toHaveBeenCalledOnce();
  });

  test('moves the item with the keyboard without scrolling the page', async () => {
    env.hasMouse = true;

    const onMove = vi.fn();

    await render(ReorderControls, { index: 1, itemCount: 3, onMove });

    const handle = page.getByRole('button', { name: 'Reorder Item' }).element();

    /**
     * Press a key on the handle.
     * @param {string} key Key.
     * @returns {KeyboardEvent} Event.
     */
    const press = (key) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

      handle.dispatchEvent(event);

      return event;
    };

    expect(press('ArrowDown').defaultPrevented).toBe(true);
    expect(onMove).toHaveBeenLastCalledWith(2, 'reorder');
    expect(press('Home').defaultPrevented).toBe(true);
    expect(onMove).toHaveBeenLastCalledWith(0, 'reorder');
    // Other keys keep their default action, e.g. Tab moves the focus
    expect(press('Tab').defaultPrevented).toBe(false);
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  test('works without handlers', async () => {
    env.hasMouse = true;

    await render(ReorderControls, { index: 1, itemCount: 3 });

    const handle = page.getByRole('button', { name: 'Reorder Item' }).element();

    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    globalThis.dispatchEvent(new PointerEvent('pointerup'));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    // The controls follow the environment, e.g. when a mouse is unplugged
    env.hasMouse = false;

    await page.getByRole('button', { name: 'Move Up' }).click();
    await page.getByRole('button', { name: 'Move Down' }).click();
  });

  test('uses the given icon for the drag handle', async () => {
    env.hasMouse = true;

    await render(ReorderControls, { index: 0, itemCount: 2, icon: 'swap_vert' });

    await expect
      .element(page.getByRole('button', { name: 'Reorder Item' }))
      .toMatchTextContent('swap_vert');
  });

  test('disables both buttons on a touch device when disabled', async () => {
    env.hasMouse = false;

    await render(ReorderControls, { index: 1, itemCount: 3, disabled: true });

    await expect
      .element(page.getByRole('button', { name: 'Move Up' }))
      .toHaveAttribute('aria-disabled', 'true');
    await expect
      .element(page.getByRole('button', { name: 'Move Down' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('renders only the drag handle, and only with a mouse, for the `handle` part', async () => {
    env.hasMouse = true;

    await render(ReorderControls, { index: 1, itemCount: 3, part: 'handle' });

    await expect.element(page.getByRole('button', { name: 'Reorder Item' })).toBeVisible();
    expect(page.getByRole('button', { name: 'Move Up' }).elements()).toHaveLength(0);

    env.hasMouse = false;

    await expect.poll(() => page.getByRole('button').elements()).toHaveLength(0);
  });

  test('renders the up/down buttons on any device for the `buttons` part', async () => {
    env.hasMouse = true;

    const onMove = vi.fn();

    await render(ReorderControls, { index: 1, itemCount: 3, part: 'buttons', onMove });

    expect(page.getByRole('button', { name: 'Reorder Item' }).elements()).toHaveLength(0);
    await page.getByRole('button', { name: 'Move Up' }).click();
    expect(onMove).toHaveBeenCalledWith(0, 'move-up');

    env.hasMouse = false;

    await page.getByRole('button', { name: 'Move Down' }).click();
    expect(onMove).toHaveBeenCalledWith(2, 'move-down');
  });
});
