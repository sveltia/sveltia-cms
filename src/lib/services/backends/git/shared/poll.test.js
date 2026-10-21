import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { pollUntil, SETTLE_POLL } from '$lib/services/backends/git/shared/poll';

vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn() }));

describe('SETTLE_POLL', () => {
  test('reads up to 10 times, a second apart', () => {
    expect(SETTLE_POLL).toEqual({ attempts: 10, interval: 1000 });
  });
});

describe('pollUntil()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('returns a value that has settled on the first read without waiting', async () => {
    const read = vi.fn().mockResolvedValue('done');

    await expect(pollUntil(read, (value) => value === 'done', SETTLE_POLL)).resolves.toBe('done');
    expect(read).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  test('reads again until the value settles', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce('pending')
      .mockResolvedValueOnce('pending')
      .mockResolvedValueOnce('done');

    await expect(
      pollUntil(read, (value) => value === 'done', { attempts: 5, interval: 200 }),
    ).resolves.toBe('done');
    expect(read).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(200);
  });

  test('returns the last unsettled value once the attempts run out', async () => {
    const read = vi.fn().mockResolvedValue('pending');

    await expect(
      pollUntil(read, (value) => value === 'done', { attempts: 3, interval: 1000 }),
    ).resolves.toBe('pending');
    expect(read).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test('reads once with a single attempt', async () => {
    const read = vi.fn().mockResolvedValue('pending');

    await expect(pollUntil(read, () => false, { attempts: 1, interval: 1000 })).resolves.toBe(
      'pending',
    );
    expect(read).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  test('passes on a failed read', async () => {
    const read = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    await expect(pollUntil(read, () => true, SETTLE_POLL)).rejects.toThrow('Failed to fetch');
  });
});
