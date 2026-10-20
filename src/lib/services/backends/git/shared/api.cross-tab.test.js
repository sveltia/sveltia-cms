import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { User } from '$lib/types/private';
 */

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key) => key),
}));

const USER_STORAGE_KEY = 'sveltia-cms.user';
const TOKEN_URL = 'https://gitlab.com/oauth/token';
/**
 * `localStorage` shared by the tabs.
 * @type {Map<string, string>}
 */
const storage = new Map();

/**
 * `localStorage` that writes to {@link storage}.
 */
const localStorageMock = {
  /**
   * Get an item.
   * @param {string} key Key.
   * @returns {string | null} Value.
   */
  getItem: (key) => storage.get(key) ?? null,
  /**
   * Set an item.
   * @param {string} key Key.
   * @param {string} value Value.
   */
  setItem: (key, value) => {
    storage.set(key, value);
  },
  /**
   * Remove an item.
   * @param {string} key Key.
   */
  removeItem: (key) => {
    storage.delete(key);
  },
};

/**
 * A GitLab-like server, which revokes both the access token and the refresh token once the
 * refresh token is used.
 */
const server = { accessToken: '', refreshToken: '', count: 0 };
/**
 * `storage` event listeners registered by each tab.
 * @type {((event: any) => void)[]}
 */
let storageListeners = [];

/**
 * Handle a request to the mocked server.
 * @param {string} url Request URL.
 * @param {RequestInit} init Request options.
 * @returns {Promise<Response>} Response.
 */
const handleRequest = async (url, init) => {
  if (url === TOKEN_URL) {
    const { refresh_token: refreshToken } = JSON.parse(/** @type {string} */ (init.body));

    if (refreshToken !== server.refreshToken) {
      return Response.json({ error: 'invalid_grant' }, { status: 400 });
    }

    server.count += 1;
    server.accessToken = `access-${server.count}`;
    server.refreshToken = `refresh-${server.count}`;

    return Response.json({
      access_token: server.accessToken,
      refresh_token: server.refreshToken,
    });
  }

  if (new Headers(init.headers).get('Authorization') !== `Bearer ${server.accessToken}`) {
    return Response.json({ message: '401 Unauthorized' }, { status: 401 });
  }

  return Response.json({ ok: true });
};

/**
 * Open a tab signed in as the given user.
 * @param {User} account User.
 * @returns {Promise<{ api: typeof import('./api'), user: { account: User | null | undefined } }>}
 * The tab’s API module and user store.
 */
const openTab = async (account) => {
  /** @type {{ account: User | null | undefined }} */
  const user = { account: undefined };

  // Each tab loads the modules anew, with a user store of its own
  vi.resetModules();
  vi.doMock('$lib/services/user/account.svelte', () => ({ user }));

  const api = await import('./api');

  Object.assign(api.apiConfig, {
    clientId: 'client-id',
    tokenURL: TOKEN_URL,
    restBaseURL: 'https://gitlab.com/api/v4',
    authScheme: 'Bearer',
  });
  user.account = { ...account };

  return { api, user };
};

/**
 * Get the user stored by the tabs.
 * @returns {any} Stored user.
 */
const getStoredUser = () => JSON.parse(/** @type {string} */ (storage.get(USER_STORAGE_KEY)));

/** @type {User} */
const ALICE = {
  backendName: 'gitlab',
  id: 1,
  login: 'alice',
  token: 'access-0',
  refreshToken: 'refresh-0',
};

describe('Token refresh across tabs', () => {
  beforeEach(() => {
    storage.clear();
    storage.set(USER_STORAGE_KEY, JSON.stringify(ALICE));
    storageListeners = [];
    // The access token has expired, but the refresh token can still be used
    Object.assign(server, { accessToken: 'unknown', refreshToken: 'refresh-0', count: 0 });

    vi.stubGlobal('fetch', vi.fn(handleRequest));
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal(
      'addEventListener',
      vi.fn((type, listener) => {
        if (type === 'storage') {
          storageListeners.push(listener);
        }
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should take the tokens another tab has refreshed instead of refreshing again', async () => {
    const tabA = await openTab(ALICE);
    const tabB = await openTab(ALICE);

    await expect(tabA.api.fetchAPI('/user')).resolves.toEqual({ ok: true });
    expect(getStoredUser()).toEqual({ ...ALICE, token: 'access-1', refreshToken: 'refresh-1' });

    // Tab B still has the old tokens, which the server has revoked
    expect(tabB.user.account?.token).toBe('access-0');
    await expect(tabB.api.fetchAPI('/user')).resolves.toEqual({ ok: true });
    expect(tabB.user.account).toEqual({ ...ALICE, token: 'access-1', refreshToken: 'refresh-1' });
    expect(server.count).toBe(1);

    // The next refresh in either tab uses the new refresh token
    server.accessToken = 'unknown';
    await expect(tabB.api.fetchAPI('/user')).resolves.toEqual({ ok: true });
    await expect(tabA.api.fetchAPI('/user')).resolves.toEqual({ ok: true });
    expect(tabA.user.account).toEqual({ ...ALICE, token: 'access-2', refreshToken: 'refresh-2' });
    expect(server.count).toBe(2);
  });

  it('should let only one tab refresh at a time', async () => {
    const tabA = await openTab(ALICE);
    const tabB = await openTab(ALICE);

    await expect(
      Promise.all([tabA.api.fetchAPI('/user'), tabB.api.fetchAPI('/user')]),
    ).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(server.count).toBe(1);
    expect(tabA.user.account?.token).toBe('access-1');
    expect(tabB.user.account?.token).toBe('access-1');
  });

  it('should still read the stored tokens without the Web Locks API', async () => {
    vi.stubGlobal('navigator', {});

    const tabA = await openTab(ALICE);
    const tabB = await openTab(ALICE);

    await expect(tabA.api.fetchAPI('/user')).resolves.toEqual({ ok: true });
    await expect(tabB.api.fetchAPI('/user')).resolves.toEqual({ ok: true });
    expect(tabB.user.account?.token).toBe('access-1');
    expect(server.count).toBe(1);
  });

  it('should refresh when no user is stored', async () => {
    const tab = await openTab(ALICE);

    storage.clear();
    await expect(tab.api.fetchAPI('/user')).resolves.toEqual({ ok: true });
    expect(server.count).toBe(1);
    expect(getStoredUser()).toEqual({ ...ALICE, token: 'access-1', refreshToken: 'refresh-1' });
  });

  it('should not take the tokens of another account', async () => {
    const tab = await openTab(ALICE);

    // Someone else has signed in on another tab
    storage.set(
      USER_STORAGE_KEY,
      JSON.stringify({ ...ALICE, id: 2, login: 'bob', token: 'bob', refreshToken: 'bob' }),
    );
    await expect(tab.api.fetchAPI('/user')).resolves.toEqual({ ok: true });
    expect(tab.user.account).toEqual({ ...ALICE, token: 'access-1', refreshToken: 'refresh-1' });

    // Nor of the same account on another backend
    server.accessToken = 'unknown';
    storage.set(
      USER_STORAGE_KEY,
      JSON.stringify({ ...ALICE, backendName: 'github', token: 'gh', refreshToken: 'gh' }),
    );
    await expect(tab.api.fetchAPI('/user')).resolves.toEqual({ ok: true });
    expect(tab.user.account?.token).toBe('access-2');
  });

  it('should not take the stored tokens for a request sent with the ones being signed in with', async () => {
    const tab = await openTab(ALICE);

    // The user store and the stored user are a previous session, while the request uses the tokens
    // just issued
    server.refreshToken = 'new-refresh';
    storage.set(
      USER_STORAGE_KEY,
      JSON.stringify({ ...ALICE, token: 'stale', refreshToken: 'stale-refresh' }),
    );
    await expect(
      tab.api.fetchAPI('/user', { token: 'new-access', refreshToken: 'new-refresh' }),
    ).resolves.toEqual({ ok: true });
    expect(server.count).toBe(1);
  });

  it('should take the tokens another tab stores', async () => {
    const tabA = await openTab(ALICE);
    const tabB = await openTab(ALICE);
    const [, onStorageChangeB] = storageListeners;

    await tabA.api.fetchAPI('/user');
    onStorageChangeB({ key: USER_STORAGE_KEY, newValue: storage.get(USER_STORAGE_KEY) });
    expect(tabB.user.account).toEqual({ ...ALICE, token: 'access-1', refreshToken: 'refresh-1' });

    // So the next request is sent with the new token
    vi.mocked(fetch).mockClear();
    await expect(tabB.api.fetchAPI('/user')).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('should ignore other storage changes', async () => {
    const tab = await openTab(ALICE);
    const [onStorageChange] = storageListeners;
    const { account } = tab.user;

    [
      { key: 'sveltia-cms.prefs', newValue: '{}' },
      { key: USER_STORAGE_KEY, newValue: null },
      { key: USER_STORAGE_KEY, newValue: '{' },
      { key: USER_STORAGE_KEY, newValue: 'null' },
      // Signed out
      { key: USER_STORAGE_KEY, newValue: JSON.stringify({ backendName: 'gitlab' }) },
      // Another account
      { key: USER_STORAGE_KEY, newValue: JSON.stringify({ ...ALICE, id: 2, token: 'bob' }) },
      // No refresh token
      {
        key: USER_STORAGE_KEY,
        newValue: JSON.stringify({ ...ALICE, token: 'a', refreshToken: '' }),
      },
      // The same tokens
      { key: USER_STORAGE_KEY, newValue: JSON.stringify({ ...ALICE, name: 'Alice' }) },
    ].forEach((event) => onStorageChange(event));

    expect(tab.user.account).toBe(account);

    tab.user.account = null;
    onStorageChange({ key: USER_STORAGE_KEY, newValue: JSON.stringify(ALICE) });
    expect(tab.user.account).toBeNull();
  });

  it('should take a stored token without a refresh token', async () => {
    const { refreshToken, ...account } = ALICE;
    const tab = await openTab(account);
    const [onStorageChange] = storageListeners;

    onStorageChange({
      key: USER_STORAGE_KEY,
      newValue: JSON.stringify({ ...account, token: 'access-new', refreshToken: '' }),
    });
    expect(tab.user.account).toEqual({ ...account, token: 'access-new', refreshToken: undefined });
  });
});
