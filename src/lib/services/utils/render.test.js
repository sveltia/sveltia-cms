import { flushSync } from 'svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { requestFlushSync } from './render';

vi.mock('svelte', () => ({
  flushSync: vi.fn(),
}));

/**
 * Wait for the queued microtask to run.
 * @returns {Promise<void>} Promise that resolves after the microtask queue is drained.
 */
const drainMicrotasks = () =>
  new Promise((resolve) => {
    queueMicrotask(() => resolve(undefined));
  });

describe('requestFlushSync()', () => {
  beforeEach(() => {
    vi.mocked(flushSync).mockClear();
  });

  test('flushes once, after the current microtask checkpoint', async () => {
    requestFlushSync();

    // Not flushed synchronously
    expect(flushSync).not.toHaveBeenCalled();

    await drainMicrotasks();
    expect(flushSync).toHaveBeenCalledTimes(1);
  });

  test('coalesces repeated requests into a single flush', async () => {
    requestFlushSync();
    requestFlushSync();
    requestFlushSync();

    await drainMicrotasks();
    expect(flushSync).toHaveBeenCalledTimes(1);
  });

  test('allows a new flush to be queued after the previous one ran', async () => {
    requestFlushSync();
    await drainMicrotasks();
    expect(flushSync).toHaveBeenCalledTimes(1);

    requestFlushSync();
    await drainMicrotasks();
    expect(flushSync).toHaveBeenCalledTimes(2);
  });
});
