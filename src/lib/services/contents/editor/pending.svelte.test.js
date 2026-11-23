// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { createRawState, createRootEffect } from '$lib/services/utils/state.svelte';

import { awaitPendingFieldUpdates, fieldUpdatePending } from './pending.js';
import { trackPendingWhile } from './pending.svelte.js';

/**
 * Wait for the effects to run.
 * @returns {Promise<void>} Promise that resolves after a short delay.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

describe('editor/pending.svelte', () => {
  it('registers a pending update while the editor is pending', async () => {
    const pending = createRawState(false);

    const stop = createRootEffect(() => {
      trackPendingWhile(() => pending.current);
    });

    await wait();
    expect(fieldUpdatePending.current).toBe(false);

    pending.current = true;
    await wait();
    expect(fieldUpdatePending.current).toBe(true);

    let settled = false;

    const waiting = awaitPendingFieldUpdates().then(() => {
      settled = true;
    });

    await wait();
    expect(settled).toBe(false);

    pending.current = false;
    await waiting;
    expect(settled).toBe(true);
    expect(fieldUpdatePending.current).toBe(false);

    stop();
  });

  it('settles the update when the editor goes away while pending', async () => {
    const pending = createRawState(true);

    const stop = createRootEffect(() => {
      trackPendingWhile(() => pending.current);
    });

    await wait();
    expect(fieldUpdatePending.current).toBe(true);

    stop();
    await awaitPendingFieldUpdates();
    expect(fieldUpdatePending.current).toBe(false);
  });
});
