import { describe, expect, it } from 'vitest';

import {
  afterPendingFieldUpdates,
  awaitPendingFieldUpdates,
  fieldUpdatePending,
  trackPendingFieldUpdate,
} from './pending.js';

describe('editor/pending', () => {
  it('resolves immediately when nothing is pending', async () => {
    await expect(awaitPendingFieldUpdates()).resolves.toBeUndefined();
  });

  it('waits for the tracked updates to settle', async () => {
    /** @type {any} */
    let resolve;
    let done = false;

    trackPendingFieldUpdate(
      new Promise((_resolve) => {
        resolve = _resolve;
      }),
    );

    const waiting = awaitPendingFieldUpdates().then(() => {
      done = true;
    });

    await Promise.resolve();
    expect(done).toBe(false);
    expect(fieldUpdatePending.current).toBe(true);

    resolve();
    await waiting;
    expect(done).toBe(true);
    expect(fieldUpdatePending.current).toBe(false);
  });

  it('only counts an update carrying a change made by the user', async () => {
    /** @type {any} */
    let resolve;

    const promise = new Promise((_resolve) => {
      resolve = _resolve;
    });

    // An editor converting a value it was given, e.g. the body of the entry being opened
    trackPendingFieldUpdate(promise, { userChange: false });

    let done = false;

    const waiting = awaitPendingFieldUpdates().then(() => {
      done = true;
    });

    await Promise.resolve();
    // A save still waits for it, but the entry doesn’t count as changed
    expect(done).toBe(false);
    expect(fieldUpdatePending.current).toBe(false);

    // The user makes a change while it’s in flight
    trackPendingFieldUpdate(promise);
    expect(fieldUpdatePending.current).toBe(true);

    resolve();
    await waiting;
    expect(done).toBe(true);
    expect(fieldUpdatePending.current).toBe(false);
  });

  it('tolerates a rejected update', async () => {
    const promise = Promise.reject(new Error('editor gone'));

    // Avoid an unhandled rejection from the promise itself
    promise.catch(() => {});
    trackPendingFieldUpdate(promise);

    await expect(awaitPendingFieldUpdates()).resolves.toBeUndefined();
  });

  it('drains updates that are added while waiting', async () => {
    /** @type {any} */
    let resolveSecond;
    let secondDone = false;

    const second = new Promise((_resolve) => {
      resolveSecond = _resolve;
    }).then(() => {
      secondDone = true;
    });

    trackPendingFieldUpdate(
      new Promise((resolve) => {
        setTimeout(() => {
          trackPendingFieldUpdate(second);
          resolve();
        }, 0);
      }),
    );

    setTimeout(resolveSecond, 5);

    await awaitPendingFieldUpdates();
    expect(secondDone).toBe(true);
  });

  it('runs a function once the tracked updates have settled', async () => {
    /** @type {any} */
    let resolve;
    /** @type {string[]} */
    const calls = [];

    trackPendingFieldUpdate(
      new Promise((_resolve) => {
        resolve = _resolve;
      }).then(() => {
        calls.push('update');
      }),
    );

    const running = afterPendingFieldUpdates(() => {
      calls.push('fn');
    });

    await Promise.resolve();
    expect(calls).toEqual([]);

    resolve();
    await running;
    expect(calls).toEqual(['update', 'fn']);
  });
});
