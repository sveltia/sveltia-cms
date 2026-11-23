import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { fetchUserProfile } from '$lib/services/backends/git/shared/user';

vi.mock('$lib/services/backends/git/shared/api');

const mockUserState = vi.hoisted(() => ({ account: /** @type {any} */ (undefined) }));

vi.mock('$lib/services/user/account.svelte', () => ({ user: mockUserState }));

const fieldMap = { name: 'full_name', login: 'username', profileURL: 'web_url' };

const response = {
  id: 7,
  full_name: 'Jane Doe',
  username: 'jane',
  email: 'jane@example.com',
  avatar_url: 'https://example.com/jane.png',
  web_url: 'https://example.com/jane',
  // Ignored, because the field map points elsewhere
  name: 'ignored',
  login: 'ignored',
};

describe('fetchUserProfile', () => {
  beforeEach(() => {
    mockUserState.account = undefined;
    vi.mocked(fetchAPI).mockResolvedValue(response);
  });

  test('fetches `/user` with the tokens and maps the fields', async () => {
    const result = await fetchUserProfile({ token: 'tok', refreshToken: 'ref' }, 'gitea', fieldMap);

    expect(fetchAPI).toHaveBeenCalledExactlyOnceWith('/user', {
      token: 'tok',
      refreshToken: 'ref',
    });
    expect(result).toEqual({
      backendName: 'gitea',
      id: 7,
      name: 'Jane Doe',
      login: 'jane',
      email: 'jane@example.com',
      avatarURL: 'https://example.com/jane.png',
      profileURL: 'https://example.com/jane',
      bot: false,
      token: 'tok',
      refreshToken: 'ref',
    });
  });

  test('keeps the `bot` flag from the response', async () => {
    vi.mocked(fetchAPI).mockResolvedValue({ ...response, bot: true });

    const result = await fetchUserProfile({ token: 'tok' }, 'gitlab', fieldMap);

    expect(result.bot).toBe(true);
  });

  test('leaves missing response fields undefined', async () => {
    vi.mocked(fetchAPI).mockResolvedValue({});

    const result = await fetchUserProfile({ token: 'tok' }, 'github', fieldMap);

    expect(result).toEqual({
      backendName: 'github',
      id: undefined,
      name: undefined,
      login: undefined,
      email: undefined,
      avatarURL: undefined,
      profileURL: undefined,
      bot: false,
      token: 'tok',
      refreshToken: undefined,
    });
  });

  test('uses the tokens renewed while fetching the profile', async () => {
    vi.mocked(fetchAPI).mockImplementation(async () => {
      mockUserState.account = { token: 'new-tok', refreshToken: 'new-ref' };

      return response;
    });

    const result = await fetchUserProfile({ token: 'old-tok', refreshToken: 'old-ref' }, 'gitlab', {
      name: 'name',
      login: 'username',
      profileURL: 'web_url',
    });

    expect(result.token).toBe('new-tok');
    expect(result.refreshToken).toBe('new-ref');
  });

  test('keeps the given tokens over a stale account left in the store', async () => {
    // A previous session’s account, not renewed during the request, must not lend its tokens to
    // the user signing in now
    mockUserState.account = { token: 'tok-a', refreshToken: 'ref-a' };

    const result = await fetchUserProfile(
      { token: 'tok-b', refreshToken: 'ref-b' },
      'gitea',
      fieldMap,
    );

    expect(result.token).toBe('tok-b');
    expect(result.refreshToken).toBe('ref-b');
  });

  test('uses the tokens renewed while fetching over a stored account', async () => {
    mockUserState.account = { token: 'old-tok', refreshToken: 'old-ref' };
    vi.mocked(fetchAPI).mockImplementation(async () => {
      mockUserState.account = { token: 'new-tok', refreshToken: 'new-ref' };

      return response;
    });

    const result = await fetchUserProfile(
      { token: 'old-tok', refreshToken: 'old-ref' },
      'gitlab',
      fieldMap,
    );

    expect(result.token).toBe('new-tok');
    expect(result.refreshToken).toBe('new-ref');
  });

  test('keeps the given tokens when the signed-in user has the same token', async () => {
    mockUserState.account = { token: 'tok', refreshToken: 'other-ref' };

    const result = await fetchUserProfile({ token: 'tok', refreshToken: 'ref' }, 'gitea', fieldMap);

    expect(result.token).toBe('tok');
    expect(result.refreshToken).toBe('ref');
  });

  test('keeps the given tokens when the signed-in user has no token', async () => {
    mockUserState.account = { refreshToken: 'other-ref' };

    const result = await fetchUserProfile({ token: 'tok', refreshToken: 'ref' }, 'gitea', fieldMap);

    expect(result.token).toBe('tok');
    expect(result.refreshToken).toBe('ref');
  });

  test('passes on an API error', async () => {
    const error = new Error('Unauthorized');

    vi.mocked(fetchAPI).mockRejectedValue(error);

    await expect(fetchUserProfile({ token: 'tok' }, 'github', fieldMap)).rejects.toBe(error);
  });
});
