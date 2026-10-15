import { describe, expect, test, vi } from 'vitest';

import { deferDraftWrite } from './deferred';

describe('Test deferDraftWrite()', () => {
  test('runs the write in a microtask', async () => {
    const write = vi.fn();

    deferDraftWrite(write);
    expect(write).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(write).toHaveBeenCalledOnce();
  });

  test('runs the writes in the order they were deferred', async () => {
    /** @type {number[]} */
    const order = [];

    deferDraftWrite(() => order.push(1));
    deferDraftWrite(() => order.push(2));

    await Promise.resolve();
    expect(order).toEqual([1, 2]);
  });
});
