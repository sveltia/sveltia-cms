import { LocalStorage } from '@sveltia/utils/storage';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAdditions } from '$lib/services/additions/api';
import {
  additionsAuth,
  cancelPasswordChange,
  changeName,
  changePassword,
  changeTemporaryPassword,
  getNewPasswordError,
  getServiceInfo,
  getSessionUser,
  getSiteId,
  linkGitHubAccount,
  loadSignInMethods,
  REFRESH_CHECK_INTERVAL,
  refreshTokenIfNeeded,
  signInWithAdditions,
  signOutFromAdditions,
  startTokenRefresh,
} from '$lib/services/additions/auth.svelte';
import { derivePrehash } from '$lib/services/additions/kdf';
import { getAdditionsURL } from '$lib/services/app/additions';
import { refreshAccessToken } from '$lib/services/backends/git/shared/api';
import {
  handleClientSideAuthPopup,
  initClientSideAuth,
  isAuthPopup,
  sendMessage,
} from '$lib/services/backends/git/shared/auth';
import { user } from '$lib/services/user/account.svelte';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));
vi.mock('@sveltia/utils/storage', () => ({ LocalStorage: { delete: vi.fn() } }));
vi.mock('$lib/services/additions/api', () => ({
  fetchAdditions: vi.fn(),
  getErrorMessage: vi.fn((code) => `message-of-${code}`),
}));
vi.mock('$lib/services/app/additions', () => ({
  getAdditionsURL: vi.fn(() => 'https://additions.example'),
}));
vi.mock('$lib/services/backends/git/shared/api', () => ({ refreshAccessToken: vi.fn() }));
vi.mock('$lib/services/backends/git/shared/auth', () => ({
  handleClientSideAuthPopup: vi.fn(),
  initClientSideAuth: vi.fn(),
  isAuthPopup: vi.fn(() => false),
  sendMessage: vi.fn(),
}));
vi.mock('$lib/services/additions/kdf', () => ({
  KDF_VERSION: 'v1',
  derivePrehash: vi.fn(async ({ password }) => `prehash-of-${password}`),
}));
vi.mock('$lib/services/user/account.svelte', () => ({ user: { account: undefined } }));

const VERSION = { api: 1, kdf: 'v1', site_id: 'site-1' };

const SESSION = {
  user: {
    id: 'u1',
    username: 'editor',
    name: 'Editor',
    email: null,
    role: 'editor',
    must_change_password: false,
  },
  git: {
    kind: 'installation',
    token: 'ghs_token',
    expires_at: '2026-10-13T00:00:00Z',
    commit_author: { mode: 'user', name: 'Editor', email: 'editor@users.noreply.example' },
  },
};

/**
 * Make the mocked API respond by path.
 * @param {Record<string, any>} responses Responses by path.
 */
const respond = (responses) => {
  vi.mocked(fetchAdditions).mockImplementation(async (path) => {
    const response = responses[path];

    if (response instanceof Error) {
      throw response;
    }

    return response;
  });
};

beforeEach(() => {
  vi.mocked(fetchAdditions).mockReset();
  additionsAuth.passwordChange = undefined;
  user.account = undefined;
});

describe('getNewPasswordError', () => {
  test('reports a short password, but not an empty field', () => {
    expect(getNewPasswordError('')).toBe('');
    expect(getNewPasswordError('short')).toBe('password_too_short');
    expect(getNewPasswordError('long enough password')).toBe('');
  });
});

describe('getServiceInfo', () => {
  test('returns the version info of a compatible service', async () => {
    respond({ '/version': VERSION });

    await expect(getServiceInfo()).resolves.toEqual(VERSION);
  });

  test('refuses an incompatible API or password derivation', async () => {
    respond({ '/version': { ...VERSION, api: 2 } });
    await expect(getServiceInfo()).rejects.toMatchObject({
      cause: { message: 'additions.error.incompatible' },
    });

    respond({ '/version': { ...VERSION, kdf: 'v2' } });
    await expect(getServiceInfo()).rejects.toThrow('Incompatible');

    respond({ '/version': undefined });
    await expect(getServiceInfo()).rejects.toThrow('Incompatible');
  });
});

describe('getSiteId', () => {
  test('reads the site ID from the service once, then remembers it for that service', async () => {
    vi.mocked(getAdditionsURL).mockReturnValue('https://other.example');
    respond({ '/version': { ...VERSION, site_id: 'site-other' } });

    try {
      await expect(getSiteId()).resolves.toBe('site-other');
      await expect(getSiteId()).resolves.toBe('site-other');
      expect(fetchAdditions).toHaveBeenCalledOnce();
    } finally {
      vi.mocked(getAdditionsURL).mockReturnValue('https://additions.example');
    }
  });
});

describe('getSessionUser', () => {
  test('makes the GitHub token the backend token and the session token the refresh token', async () => {
    respond({ '/v1/auth/session': SESSION });

    await expect(getSessionUser('session-1')).resolves.toEqual({
      backendName: 'github',
      name: 'Editor',
      login: 'editor',
      email: undefined,
      role: 'editor',
      hasPassword: true,
      commitAuthor: { mode: 'user', name: 'Editor', email: 'editor@users.noreply.example' },
      ownGitHubToken: false,
      tokenExpiresAt: '2026-10-13T00:00:00Z',
      token: 'ghs_token',
      refreshToken: 'session-1',
    });
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/auth/session', { token: 'session-1' });
  });

  test('keeps an email, and fails until the GitHub App is set up', async () => {
    respond({ '/v1/auth/session': { ...SESSION, user: { ...SESSION.user, email: 'e@x.org' } } });
    await expect(getSessionUser('s')).resolves.toMatchObject({ email: 'e@x.org' });

    // Someone who only signs in with GitHub
    respond({
      '/v1/auth/session': { ...SESSION, user: { ...SESSION.user, has_password: false } },
    });
    await expect(getSessionUser('s')).resolves.toMatchObject({ hasPassword: false });

    respond({ '/v1/auth/session': { ...SESSION, git: null } });
    await expect(getSessionUser('s')).rejects.toMatchObject({
      cause: { status: 409, message: 'additions.error.not_set_up' },
    });

    // An admin has reset the password, which has to be changed before anything else
    respond({
      '/v1/auth/session': { user: { ...SESSION.user, must_change_password: true }, git: null },
    });
    await expect(getSessionUser('s')).rejects.toMatchObject({
      cause: { status: 403, message: 'additions.error.temporary_password' },
    });
  });
});

describe('signInWithAdditions', () => {
  test('validates a cached session', async () => {
    respond({ '/v1/auth/session': SESSION });

    await expect(
      signInWithAdditions({ auto: true, token: 'old', refreshToken: 'session-1' }),
    ).resolves.toMatchObject({ token: 'ghs_token', refreshToken: 'session-1' });
  });

  test('does nothing without a session or credentials', async () => {
    await expect(signInWithAdditions({ auto: true, token: 'magic-link-token' })).resolves.toBe(
      undefined,
    );
    await expect(signInWithAdditions({ auto: false, username: 'editor' })).resolves.toBe(undefined);
    expect(fetchAdditions).not.toHaveBeenCalled();
  });

  test('signs in with a username and the prehash of the password', async () => {
    respond({
      '/version': VERSION,
      '/v1/auth/sign-in': { session_token: 'session-2', user: SESSION.user },
      '/v1/auth/session': SESSION,
    });

    await expect(
      signInWithAdditions({ auto: false, username: 'Editor', password: 'secret password' }),
    ).resolves.toMatchObject({ login: 'editor', refreshToken: 'session-2' });

    expect(derivePrehash).toHaveBeenCalledWith({
      siteId: 'site-1',
      username: 'Editor',
      password: 'secret password',
    });
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/auth/sign-in', {
      method: 'POST',
      body: { username: 'Editor', prehash: 'prehash-of-secret password' },
    });
  });

  test('reads the site ID again after a refused sign-in, in case it has changed', async () => {
    // A service of its own, as the site ID is remembered for each
    vi.mocked(getAdditionsURL).mockReturnValue('https://recreated.example');

    try {
      const credentials = { auto: false, username: 'editor', password: 'secret password' };
      const refused = new Error('Wrong', { cause: { code: 'invalid_credentials' } });

      respond({ '/version': { ...VERSION, site_id: 'site-old' }, '/v1/auth/sign-in': refused });
      await getServiceInfo();
      await expect(signInWithAdditions(credentials)).rejects.toBe(refused);
      expect(derivePrehash).toHaveBeenLastCalledWith(
        expect.objectContaining({ siteId: 'site-old' }),
      );

      // The site was added again, with a new ID
      respond({
        '/version': { ...VERSION, site_id: 'site-new' },
        '/v1/auth/sign-in': { session_token: 'session-2', user: SESSION.user },
        '/v1/auth/session': SESSION,
      });
      await expect(signInWithAdditions(credentials)).resolves.toMatchObject({ login: 'editor' });
      expect(derivePrehash).toHaveBeenLastCalledWith(
        expect.objectContaining({ siteId: 'site-new' }),
      );
    } finally {
      vi.mocked(getAdditionsURL).mockReturnValue('https://additions.example');
    }
  });

  test('asks a user with a temporary password to change it first', async () => {
    respond({
      '/version': VERSION,
      '/v1/auth/sign-in': {
        session_token: 'session-3',
        user: { ...SESSION.user, must_change_password: true },
      },
    });

    await expect(
      signInWithAdditions({ auto: false, username: 'editor', password: 'temporary' }),
    ).resolves.toBeUndefined();

    expect(additionsAuth.passwordChange).toEqual({
      username: 'editor',
      siteId: 'site-1',
      sessionToken: 'session-3',
      currentPrehash: 'prehash-of-temporary',
    });
  });
});

describe('changeTemporaryPassword', () => {
  test('changes the password and returns the new session token', async () => {
    additionsAuth.passwordChange = {
      username: 'editor',
      siteId: 'site-1',
      sessionToken: 'session-3',
      currentPrehash: 'prehash-of-temporary',
    };
    respond({ '/v1/auth/password': { session_token: 'session-4' } });

    await expect(changeTemporaryPassword('new password')).resolves.toBe('session-4');
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/auth/password', {
      method: 'POST',
      token: 'session-3',
      body: { current_prehash: 'prehash-of-temporary', new_prehash: 'prehash-of-new password' },
    });
    expect(additionsAuth.passwordChange).toBeUndefined();
  });

  test('fails when no change is pending, and keeps a pending change that failed', async () => {
    await expect(changeTemporaryPassword('new password')).rejects.toThrow('No password change');

    additionsAuth.passwordChange = {
      username: 'editor',
      siteId: 'site-1',
      sessionToken: 'session-3',
      currentPrehash: 'prehash-of-temporary',
    };
    respond({ '/v1/auth/password': new Error('Refused') });

    await expect(changeTemporaryPassword('new password')).rejects.toThrow('Refused');
    expect(additionsAuth.passwordChange).toBeDefined();
  });

  test('goes back to the sign-in form when the session has expired', async () => {
    additionsAuth.passwordChange = {
      username: 'editor',
      siteId: 'site-1',
      sessionToken: 'session-3',
      currentPrehash: 'prehash-of-temporary',
    };
    respond({
      '/v1/auth/password': new Error('Expired', {
        cause: { status: 401, code: 'unauthenticated' },
      }),
    });

    await expect(changeTemporaryPassword('new password')).rejects.toThrow('Expired');
    expect(additionsAuth.passwordChange).toBeUndefined();
  });
});

describe('changeName', () => {
  const ACCOUNT = {
    backendName: 'github',
    login: 'editor',
    name: 'Editor',
    role: 'editor',
    token: 'ghs_old',
    refreshToken: 'session-1',
  };

  test('changes the name, then reads the account again for the new commit author', async () => {
    user.account = /** @type {any} */ ({ ...ACCOUNT });
    respond({
      '/v1/auth/profile': { user: { ...SESSION.user, name: 'Ed Itor' } },
      '/v1/auth/session': {
        ...SESSION,
        user: { ...SESSION.user, name: 'Ed Itor' },
        git: { ...SESSION.git, commit_author: { mode: 'user', name: 'Ed Itor', email: 'x@y.z' } },
      },
    });

    await changeName('Ed Itor');

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/auth/profile', {
      method: 'PATCH',
      token: 'session-1',
      body: { name: 'Ed Itor' },
    });
    expect(user.account).toMatchObject({
      name: 'Ed Itor',
      commitAuthor: { name: 'Ed Itor' },
      refreshToken: 'session-1',
    });
  });

  test('shows the new name even when the account can’t be read again', async () => {
    user.account = /** @type {any} */ ({ ...ACCOUNT });
    respond({
      '/v1/auth/profile': { user: { ...SESSION.user, name: 'Ed Itor' } },
      '/v1/auth/session': new Error('Unreachable'),
    });

    await changeName('Ed Itor');

    expect(user.account).toMatchObject({ name: 'Ed Itor', token: 'ghs_old' });
  });

  test('keeps a token renewed during the request', async () => {
    user.account = /** @type {any} */ ({ ...ACCOUNT });
    vi.mocked(fetchAdditions).mockImplementation(async (path) => {
      if (path === '/v1/auth/profile') {
        user.account = /** @type {any} */ ({ ...user.account, token: 'ghs_new' });

        return { user: { ...SESSION.user, name: 'Ed Itor' } };
      }

      throw new Error('Unreachable');
    });

    await changeName('Ed Itor');

    expect(user.account).toMatchObject({ name: 'Ed Itor', token: 'ghs_new' });
  });

  test('passes on a refused change', async () => {
    const error = new Error('Invalid', { cause: { status: 400, code: 'invalid_body' } });

    user.account = /** @type {any} */ ({ ...ACCOUNT });
    respond({ '/v1/auth/profile': error });

    await expect(changeName('x'.repeat(500))).rejects.toBe(error);
    expect(user.account).toMatchObject({ name: 'Editor' });
  });
});

describe('changePassword', () => {
  const ACCOUNT = {
    backendName: 'github',
    login: 'editor',
    name: 'Editor',
    role: 'editor',
    token: 'ghs_old',
    refreshToken: 'session-1',
  };

  test('changes the password and carries on with the new session', async () => {
    user.account = /** @type {any} */ ({ ...ACCOUNT });
    respond({
      '/version': VERSION,
      '/v1/auth/password': { session_token: 'session-2' },
      '/v1/auth/session': SESSION,
    });

    await changePassword('old password', 'new password');

    expect(derivePrehash).toHaveBeenCalledWith({
      siteId: 'site-1',
      username: 'editor',
      password: 'old password',
    });
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/auth/password', {
      method: 'POST',
      token: 'session-1',
      body: { current_prehash: 'prehash-of-old password', new_prehash: 'prehash-of-new password' },
    });
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/auth/session', { token: 'session-2' });
    expect(user.account).toMatchObject({ token: 'ghs_token', refreshToken: 'session-2' });
  });

  test('keeps the new session when the GitHub token can’t be fetched', async () => {
    user.account = /** @type {any} */ ({ ...ACCOUNT });
    respond({
      '/version': VERSION,
      '/v1/auth/password': { session_token: 'session-2' },
      '/v1/auth/session': new Error('Unreachable'),
    });

    await changePassword('old password', 'new password');

    expect(user.account).toMatchObject({ token: 'ghs_old', refreshToken: 'session-2' });
  });

  test('keeps the session when the change is refused', async () => {
    user.account = /** @type {any} */ ({ ...ACCOUNT });
    respond({ '/version': VERSION, '/v1/auth/password': new Error('Wrong') });

    await expect(changePassword('wrong', 'new password')).rejects.toThrow('Wrong');
    expect(user.account).toMatchObject({ refreshToken: 'session-1' });
  });
});

describe('signOutFromAdditions', () => {
  test('ends the session, ignoring errors', async () => {
    user.account = /** @type {any} */ ({ backendName: 'github', refreshToken: 'session-1' });
    respond({ '/v1/auth/sign-out': new Error('Unreachable') });

    await expect(signOutFromAdditions()).resolves.toBeUndefined();
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/auth/sign-out', {
      method: 'POST',
      token: 'session-1',
    });
  });

  test('clears a pending password change without a session', async () => {
    additionsAuth.passwordChange = /** @type {any} */ ({ sessionToken: 'x' });

    await signOutFromAdditions();

    expect(fetchAdditions).not.toHaveBeenCalled();
    expect(additionsAuth.passwordChange).toBeUndefined();
  });
});

describe('sign-in through a provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('loads the methods the service offers besides the password', async () => {
    respond({ '/version': { ...VERSION, sign_in_methods: ['password', 'github'] } });
    await loadSignInMethods();
    expect(additionsAuth.signInMethods).toEqual(['github']);

    respond({ '/version': VERSION });
    await loadSignInMethods();
    expect(additionsAuth.signInMethods).toEqual([]);

    respond({ '/version': new Error('Unreachable') });
    await loadSignInMethods();
    expect(additionsAuth.signInMethods).toEqual([]);
  });

  test('signs in with GitHub in a popup, then loads the session', async () => {
    vi.mocked(initClientSideAuth).mockResolvedValue({ token: 'ghu_x', refreshToken: 'session-9' });
    respond({ '/v1/auth/session': { ...SESSION, git: { ...SESSION.git, kind: 'user' } } });

    await expect(signInWithAdditions({ auto: false, provider: 'github' })).resolves.toMatchObject({
      refreshToken: 'session-9',
      ownGitHubToken: true,
    });
    expect(initClientSideAuth).toHaveBeenCalledWith({
      backendName: 'github',
      clientId: 'sveltia-cms',
      authURL: 'https://additions.example/v1/auth/start/github',
      scope: '',
    });
  });

  test('finishes the sign-in in the popup, or passes the error on', async () => {
    const location = { origin: 'https://cms.example', search: '?code=c&state=s' };

    vi.stubGlobal('window', { location });
    vi.mocked(isAuthPopup).mockReturnValue(true);

    await expect(signInWithAdditions({ auto: true })).resolves.toBeUndefined();
    expect(handleClientSideAuthPopup).toHaveBeenCalledWith({
      backendName: 'github',
      apiConfig: { clientId: 'sveltia-cms', tokenURL: 'https://additions.example/v1/auth/token' },
    });

    // With the state, which names the channel the error goes over if the popup lost its opener
    location.search = '?error=not_invited&state=s';
    await signInWithAdditions({ auto: true });
    expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
    expect(sendMessage).toHaveBeenCalledWith({
      provider: 'github',
      state: 's',
      error: 'message-of-not_invited',
      errorCode: 'not_invited',
    });

    location.search = '?error=not_invited';
    await signInWithAdditions({ auto: true });
    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ state: undefined }));
    vi.mocked(isAuthPopup).mockReturnValue(false);
  });

  test('isn’t the popup in any other window', async () => {
    await expect(signInWithAdditions({ auto: true })).resolves.toBeUndefined();
    expect(handleClientSideAuthPopup).not.toHaveBeenCalled();
  });
});

describe('cancelPasswordChange', () => {
  test('goes back to the sign-in form, ending the session the temporary password started', async () => {
    additionsAuth.passwordChange = {
      username: 'editor',
      siteId: 'site',
      sessionToken: 'temporary-session',
      currentPrehash: 'prehash',
    };
    respond({ '/v1/auth/sign-out': new Error('Unreachable') });

    await cancelPasswordChange();
    expect(additionsAuth.passwordChange).toBeUndefined();
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/auth/sign-out', {
      method: 'POST',
      token: 'temporary-session',
    });

    // Nothing to end
    vi.mocked(fetchAdditions).mockClear();
    await cancelPasswordChange();
    expect(fetchAdditions).not.toHaveBeenCalled();
  });
});

describe('linkGitHubAccount', () => {
  test('links the account in a popup, carries on with the new session and ends the old one', async () => {
    user.account = /** @type {any} */ ({ backendName: 'github', refreshToken: 'session-1' });
    vi.mocked(initClientSideAuth).mockResolvedValue({ token: 'ghu_x', refreshToken: 'session-2' });
    respond({
      '/v1/auth/link/github': { link: 'link 1&x' },
      '/v1/auth/session': { ...SESSION, git: { ...SESSION.git, kind: 'user' } },
      '/v1/auth/sign-out': new Error('Unreachable'),
    });

    await linkGitHubAccount();

    // The link is asked for once the popup has opened, so the browser doesn’t block it
    const { authURL } = vi.mocked(initClientSideAuth).mock.calls[0][0];

    expect(fetchAdditions).not.toHaveBeenCalledWith('/v1/auth/link/github', expect.anything());
    expect(typeof authURL).toBe('function');
    await expect(/** @type {() => Promise<string>} */ (authURL)()).resolves.toBe(
      'https://additions.example/v1/auth/start/github?link=link%201%26x',
    );
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/auth/link/github', {
      method: 'POST',
      token: 'session-1',
    });
    expect(user.account).toMatchObject({ refreshToken: 'session-2', ownGitHubToken: true });
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/auth/sign-out', {
      method: 'POST',
      token: 'session-1',
    });
  });

  test('keeps the account when linking fails', async () => {
    const account = { backendName: 'github', refreshToken: 'session-1' };

    user.account = /** @type {any} */ (account);
    vi.mocked(initClientSideAuth).mockRejectedValue(new Error('Closed'));
    respond({ '/v1/auth/link/github': { link: 'link-1' } });

    await expect(linkGitHubAccount()).rejects.toThrow('Closed');
    expect(user.account).toEqual(account);
  });

  test('leaves a user who signed out in the meantime signed out', async () => {
    user.account = /** @type {any} */ ({ backendName: 'github', refreshToken: 'session-1' });
    vi.mocked(initClientSideAuth).mockImplementation(async () => {
      user.account = undefined;
      throw new Error('Closed');
    });
    respond({ '/v1/auth/link/github': { link: 'link-1' } });

    await expect(linkGitHubAccount()).rejects.toThrow('Closed');
    expect(user.account).toBeUndefined();
  });
});

describe('token refresh', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('refreshes the GitHub token when it expires soon', async () => {
    user.account = /** @type {any} */ ({
      refreshToken: 'session-1',
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    await refreshTokenIfNeeded();
    expect(refreshAccessToken).not.toHaveBeenCalled();

    user.account = /** @type {any} */ ({
      refreshToken: 'session-1',
      tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
    });
    vi.mocked(refreshAccessToken).mockRejectedValueOnce(new Error('Unreachable'));
    await expect(refreshTokenIfNeeded()).resolves.toBeUndefined();
    expect(refreshAccessToken).toHaveBeenCalledWith({
      clientId: 'sveltia-cms',
      tokenURL: 'https://additions.example/v1/auth/token',
      refreshToken: 'session-1',
    });

    // Nothing to refresh while signed out
    vi.mocked(refreshAccessToken).mockClear();
    user.account = undefined;
    await refreshTokenIfNeeded();
    expect(refreshAccessToken).not.toHaveBeenCalled();

    // Nothing to refresh without an expiry, e.g. a session from before
    vi.mocked(refreshAccessToken).mockClear();
    user.account = /** @type {any} */ ({ refreshToken: 'session-1' });
    await refreshTokenIfNeeded();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  test('checks every minute while signed in with Sveltia CMS Additions', async () => {
    vi.useFakeTimers();
    user.account = /** @type {any} */ ({
      refreshToken: 'session-1',
      tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
    });

    const stop = startTokenRefresh();

    await vi.advanceTimersByTimeAsync(REFRESH_CHECK_INTERVAL);
    expect(refreshAccessToken).toHaveBeenCalledOnce();
    stop?.();
    await vi.advanceTimersByTimeAsync(REFRESH_CHECK_INTERVAL);
    expect(refreshAccessToken).toHaveBeenCalledOnce();
  });
});
