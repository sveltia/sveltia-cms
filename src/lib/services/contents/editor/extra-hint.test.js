// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import { createRawState, createRootEffect } from '$lib/services/utils/state.svelte';

import { setExtraHint } from './extra-hint.svelte.js';

const { getContext } = vi.hoisted(() => ({ getContext: vi.fn() }));

vi.mock('svelte', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getContext,
}));

/**
 * Wait for the effects to run.
 * @returns {Promise<void>} Promise that resolves after a short delay.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

/**
 * Stand-in for a hint component.
 * @returns {void}
 */
const Hint = () => {};

describe('setExtraHint()', () => {
  it('should set the component to the `extraHint` box in the field editor context', async () => {
    const extraHint = createRawState();

    getContext.mockReturnValue({ extraHint });

    const stop = createRootEffect(() => {
      setExtraHint(Hint);
    });

    await wait();
    expect(getContext).toHaveBeenCalledWith('field-editor');
    expect(extraHint.current).toBe(Hint);

    stop();
  });

  it('should do nothing without a field editor context', async () => {
    getContext.mockReturnValue(undefined);

    const stop = createRootEffect(() => {
      expect(() => setExtraHint(Hint)).not.toThrow();
    });

    await wait();
    stop();
  });
});
