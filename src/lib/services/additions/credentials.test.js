import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAdditions } from '$lib/services/additions/api';
import {
  fetchCredentials,
  loadCredentials,
  saveCredentials,
  sharedCredentials,
  startCredentials,
} from '$lib/services/additions/credentials.svelte';
import { onSocketMessage } from '$lib/services/additions/socket.svelte';
import { user } from '$lib/services/user/account.svelte';

vi.mock('$lib/services/additions/api', () => ({ fetchAdditions: vi.fn() }));
vi.mock('$lib/services/additions/socket.svelte', () => ({ onSocketMessage: vi.fn() }));
vi.mock('$lib/services/user/account.svelte', () => ({ user: { account: undefined } }));

const RESPONSE = {
  api_keys: { deepl: 'abc:fx' },
  deploy_hook: { url: 'https://example.com/hook', auth_header: 'Bearer x' },
};

beforeEach(() => {
  user.account = /** @type {any} */ ({ refreshToken: 'session' });
  Object.assign(sharedCredentials, { apiKeys: {}, deployHook: null });
});

describe('fetchCredentials()', () => {
  test('keeps the credentials the service returns', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue(RESPONSE);

    await fetchCredentials();

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/credentials', { token: 'session' });
    expect(sharedCredentials).toEqual({
      apiKeys: { deepl: 'abc:fx' },
      deployHook: { url: 'https://example.com/hook', authHeader: 'Bearer x' },
    });

    vi.mocked(fetchAdditions).mockResolvedValue({ api_keys: {}, deploy_hook: null });
    await fetchCredentials();
    expect(sharedCredentials).toEqual({ apiKeys: {}, deployHook: null });
  });

  test('throws when they can’t be fetched, unlike loadCredentials()', async () => {
    vi.mocked(fetchAdditions).mockRejectedValue(new Error('Network'));

    await expect(fetchCredentials()).rejects.toThrow('Network');
    // The user can still enter their own
    await expect(loadCredentials()).resolves.toBeUndefined();
  });
});

describe('saveCredentials()', () => {
  test('sends them in the service’s shape, and keeps what it returns', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue(RESPONSE);

    await saveCredentials({
      apiKeys: { deepl: 'abc:fx' },
      deployHook: { url: 'https://example.com/hook', authHeader: 'Bearer x' },
    });

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/settings/credentials', {
      method: 'PUT',
      token: 'session',
      body: RESPONSE,
    });
    expect(sharedCredentials.deployHook).toEqual({
      url: 'https://example.com/hook',
      authHeader: 'Bearer x',
    });

    vi.mocked(fetchAdditions).mockResolvedValue({ api_keys: {}, deploy_hook: null });
    await saveCredentials({ apiKeys: {}, deployHook: null });
    expect(vi.mocked(fetchAdditions).mock.lastCall?.[1]?.body).toEqual({
      api_keys: {},
      deploy_hook: null,
    });
  });
});

describe('startCredentials()', () => {
  test('loads them, and again whenever an admin changes them, until signing out', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue(RESPONSE);

    const stop = startCredentials();

    await vi.waitFor(() => expect(sharedCredentials.apiKeys).toEqual({ deepl: 'abc:fx' }));

    const [[type, handler]] = vi.mocked(onSocketMessage).mock.calls;

    expect(type).toBe('credentials');
    vi.mocked(fetchAdditions).mockResolvedValue({ api_keys: { google: 'g' }, deploy_hook: null });
    handler({ type: 'credentials' });
    await vi.waitFor(() => expect(sharedCredentials.apiKeys).toEqual({ google: 'g' }));

    stop?.();
    expect(sharedCredentials).toEqual({ apiKeys: {}, deployHook: null });
  });

  test('doesn’t bring them back when a request ends after signing out', async () => {
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(fetchAdditions).mockReturnValue(promise);

    const stop = startCredentials();

    stop();
    resolve(RESPONSE);
    await Promise.resolve();
    await Promise.resolve();
    expect(sharedCredentials).toEqual({ apiKeys: {}, deployHook: null });
  });
});
