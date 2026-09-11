import { describe, expect, it } from 'vitest';

import { awaitPendingFieldUpdates, trackPendingFieldUpdate } from './pending.js';

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

    resolve();
    await waiting;
    expect(done).toBe(true);
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
});
