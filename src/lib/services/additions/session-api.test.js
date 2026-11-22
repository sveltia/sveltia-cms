import { describe, expect, test, vi } from 'vitest';

import { fetchAdditions } from '$lib/services/additions/api';
import { fetchWithSession } from '$lib/services/additions/session-api';
import { user } from '$lib/services/user/account.svelte';

vi.mock('$lib/services/additions/api', () => ({ fetchAdditions: vi.fn() }));

describe('fetchWithSession', () => {
  test('sends the request with the signed-in user’s session token', async () => {
    user.account = /** @type {any} */ ({ refreshToken: 'session-1' });
    vi.mocked(fetchAdditions).mockResolvedValue({ ok: true });

    await expect(
      fetchWithSession('/v1/users', { method: 'POST', body: { a: 1 } }),
    ).resolves.toEqual({ ok: true });
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/users', {
      method: 'POST',
      body: { a: 1 },
      token: 'session-1',
    });

    await fetchWithSession('/v1/credentials');
    expect(fetchAdditions).toHaveBeenLastCalledWith('/v1/credentials', {
      method: undefined,
      body: undefined,
      token: 'session-1',
    });
  });
});
