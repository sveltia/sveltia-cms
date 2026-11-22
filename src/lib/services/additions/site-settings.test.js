import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAdditions } from '$lib/services/additions/api';
import { getServiceInfo } from '$lib/services/additions/auth.svelte';
import {
  checkForUpdate,
  loadGitHubStatus,
  replacePrivateKey,
  saveAllowedDomains,
  saveCommitAuthor,
  saveSignInSettings,
} from '$lib/services/additions/site-settings';
import { additionsUsers } from '$lib/services/additions/users.svelte';
import { user } from '$lib/services/user/account.svelte';

vi.mock('$lib/services/additions/api', () => ({ fetchAdditions: vi.fn() }));
// The strings aren’t loaded here, so the email is made of its key and its values, each wrapped in
// bidi isolates as the real strings wrap them
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(
    (key, { values = {} } = {}) =>
      `${key.split('.').slice(-2).join('.')}: ${Object.entries(values)
        .map(([name, value]) => `${name}=\u2068${value}\u2069`)
        .join(' ')}`,
  ),
}));
vi.mock('$lib/services/additions/auth.svelte', () => ({
  getServiceInfo: vi.fn(async () => ({ site_id: 'site-1' })),
  getSiteId: vi.fn(async () => 'site-1'),
}));
vi.mock('$lib/services/additions/kdf', () => ({
  derivePrehash: vi.fn(
    async ({ siteId, username, password }) => `${siteId}:${username}:${password}`,
  ),
}));
vi.mock('$lib/services/user/account.svelte', () => ({
  user: { account: undefined },
}));

const USERS = [{ id: 'u1', username: 'admin', role: 'admin' }];

beforeEach(() => {
  user.account = /** @type {any} */ ({
    backendName: 'github',
    login: 'admin',
    refreshToken: 'session',
  });
  vi.mocked(fetchAdditions).mockReset();
  vi.mocked(fetchAdditions).mockImplementation(async (path) =>
    path === '/v1/users'
      ? { users: USERS }
      : { allowed_domains: ['cms.example'], commit_author: 'bot' },
  );
  Object.assign(additionsUsers, {
    users: [],
    allowedDomains: [],
    commitAuthor: 'user',
    loaded: false,
  });
});

describe('saveAllowedDomains', () => {
  test('saves the list and keeps the one the service returns', async () => {
    vi.mocked(fetchAdditions).mockResolvedValueOnce({ allowed_domains: ['a.example'] });

    await saveAllowedDomains(['A.example']);

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/settings', {
      method: 'PATCH',
      body: { allowed_domains: ['A.example'] },
      token: 'session',
    });
    expect(additionsUsers.allowedDomains).toEqual(['a.example']);
  });
});

describe('GitHub settings', () => {
  const STATUS = { status: 'ok', app: null, installation: null, default_branch: null };

  test('checks the app', async () => {
    vi.mocked(fetchAdditions).mockResolvedValueOnce(STATUS);

    await loadGitHubStatus();

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/settings/github', {
      method: undefined,
      body: undefined,
      token: 'session',
    });
    expect(additionsUsers.github).toEqual(STATUS);
  });

  test('uploads a new private key', async () => {
    vi.mocked(fetchAdditions).mockResolvedValueOnce(STATUS);

    await replacePrivateKey(new File(['-----BEGIN RSA PRIVATE KEY-----'], 'app.pem'));

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/settings/github/private-key', {
      method: 'PUT',
      body: { private_key: '-----BEGIN RSA PRIVATE KEY-----' },
      token: 'session',
    });
    expect(additionsUsers.github).toEqual(STATUS);
  });
});

describe('saveCommitAuthor', () => {
  test('saves the mode, and applies it to the admin’s own commits straight away', async () => {
    user.account = /** @type {any} */ ({
      ...user.account,
      commitAuthor: { mode: 'user', name: 'Admin', email: 'admin@example.com' },
    });
    vi.mocked(fetchAdditions).mockResolvedValueOnce({ commit_author: 'bot' });

    await saveCommitAuthor('bot');

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/settings', {
      method: 'PATCH',
      body: { commit_author: 'bot' },
      token: 'session',
    });
    expect(additionsUsers.commitAuthor).toBe('bot');
    expect(user.account?.commitAuthor).toEqual({
      mode: 'bot',
      name: 'Admin',
      email: 'admin@example.com',
    });
  });

  test('leaves an account without a commit author alone', async () => {
    vi.mocked(fetchAdditions).mockResolvedValueOnce({ commit_author: 'bot' });

    await saveCommitAuthor('bot');

    expect(user.account?.commitAuthor).toBeUndefined();
  });
});

describe('GitHub users and sign-in settings', () => {
  test('saves the sign-in methods and the sign-up rules', async () => {
    const rules = [{ id: 'r1', type: 'github_org', org: 'acme', role: 'viewer' }];

    vi.mocked(fetchAdditions).mockResolvedValueOnce({
      sign_in_methods: { github: true },
      sign_up_rules: rules,
    });

    await saveSignInSettings({
      signInMethods: { github: true },
      signUpRules: [{ type: 'github_org', org: 'acme', role: 'viewer' }],
    });

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/settings', {
      method: 'PATCH',
      body: {
        sign_in_methods: { github: true },
        sign_up_rules: [{ type: 'github_org', org: 'acme', role: 'viewer' }],
      },
      token: 'session',
    });
    expect(additionsUsers).toMatchObject({ signInMethods: { github: true }, signUpRules: rules });
  });
});

describe('updates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    additionsUsers.update = undefined;
  });

  test('reports a newer release, looked up on UNPKG like the CMS’s own', async () => {
    vi.mocked(getServiceInfo).mockResolvedValue(
      /** @type {any} */ ({ package: '@sveltia/cms-additions', version: '0.1.0' }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ version: '0.2.0' })),
    );

    await checkForUpdate();

    expect(fetch).toHaveBeenCalledWith('https://unpkg.com/@sveltia/cms-additions/package.json');
    expect(additionsUsers.update).toEqual({ current: '0.1.0', latest: '0.2.0' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ version: '0.1.0' })),
    );
    await checkForUpdate();
    expect(additionsUsers.update).toBeUndefined();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'Not found' })),
    );
    await checkForUpdate();
    expect(additionsUsers.update).toBeUndefined();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('Offline'))),
    );
    await checkForUpdate();
    expect(additionsUsers.update).toBeUndefined();
  });

  test('reports nothing for a service that doesn’t give its package name', async () => {
    additionsUsers.update = { current: '0.1.0', latest: '0.2.0' };
    vi.mocked(getServiceInfo).mockResolvedValue(/** @type {any} */ ({ version: '0.1.0' }));
    vi.stubGlobal('fetch', vi.fn());

    await checkForUpdate();

    expect(additionsUsers.update).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('reports nothing when the service’s version can’t be read', async () => {
    additionsUsers.update = { current: '0.1.0', latest: '0.2.0' };
    vi.mocked(getServiceInfo).mockRejectedValue(new Error('Unreachable'));
    vi.stubGlobal('fetch', vi.fn());

    await checkForUpdate();

    expect(additionsUsers.update).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
