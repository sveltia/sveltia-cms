import { describe, expect, test } from 'vitest';

import { deferRejection } from './defer';

describe('deferRejection()', () => {
  test('returns the same promise', async () => {
    const promise = Promise.resolve('done');

    expect(deferRejection(promise)).toBe(promise);
    await expect(promise).resolves.toBe('done');
  });

  test('still delivers the rejection to whoever awaits the promise', async () => {
    const error = new Error('Failed');
    const promise = deferRejection(Promise.reject(error));

    // Let the rejection go unhandled for a while, which would be reported without the handler
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    await expect(promise).rejects.toBe(error);
  });
});
