import { describe, expect, test, vi } from 'vitest';

import { fetchAPI } from '$lib/services/backends/git/shared/api';

import { fetchAPIOrUndefined } from './api-optional';

vi.mock('$lib/services/backends/git/shared/api');

describe('fetchAPIOrUndefined()', () => {
  test('returns the response data, passing the options on', async () => {
    vi.mocked(fetchAPI).mockResolvedValue({ sha: 'abc' });

    await expect(fetchAPIOrUndefined('/branches/main', { responseType: 'json' })).resolves.toEqual({
      sha: 'abc',
    });
    expect(fetchAPI).toHaveBeenCalledWith('/branches/main', { responseType: 'json' });
  });

  test('returns undefined for a missing resource', async () => {
    vi.mocked(fetchAPI).mockRejectedValue(new Error('Not Found', { cause: { status: 404 } }));

    await expect(fetchAPIOrUndefined('/branches/gone')).resolves.toBeUndefined();
    expect(vi.mocked(fetchAPI).mock.calls).toEqual([['/branches/gone']]);
  });

  test('passes on any other failure', async () => {
    const error = new Error('Unauthorized', { cause: { status: 401 } });

    vi.mocked(fetchAPI).mockRejectedValue(error);

    await expect(fetchAPIOrUndefined('/branches/main')).rejects.toBe(error);
  });

  test('passes on a failure without a status', async () => {
    const error = new Error('Network error');

    vi.mocked(fetchAPI).mockRejectedValue(error);

    await expect(fetchAPIOrUndefined('/branches/main')).rejects.toBe(error);
  });
});
