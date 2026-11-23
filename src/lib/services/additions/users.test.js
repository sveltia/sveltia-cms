import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAdditions } from '$lib/services/additions/api';
import {
  additionsUsers,
  createUser,
  deleteUser,
  loadSiteSettings,
  loadUsers,
  resetPassword,
  signOutUser,
  updateUser,
} from '$lib/services/additions/users.svelte';
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
    role: 'admin',
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

describe('loadUsers', () => {
  test('loads the users and the allowed domains with the session token', async () => {
    await loadUsers();

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/users', {
      method: undefined,
      body: undefined,
      token: 'session',
    });
    expect(additionsUsers).toEqual({
      users: USERS,
      allowedDomains: ['cms.example'],
      commitAuthor: 'bot',
      signInMethods: { github: false },
      signUpRules: [],
      update: undefined,
      loaded: true,
    });
  });
});

describe('loadSiteSettings', () => {
  test('loads the settings without the users', async () => {
    await loadSiteSettings();

    expect(fetchAdditions).toHaveBeenCalledOnce();
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/settings', {
      method: undefined,
      body: undefined,
      token: 'session',
    });
    expect(additionsUsers).toMatchObject({
      users: [],
      allowedDomains: ['cms.example'],
      commitAuthor: 'bot',
      loaded: true,
    });
  });
});

describe('loadUsers with an older service', () => {
  test('falls back to the defaults of the settings it lacks', async () => {
    vi.mocked(fetchAdditions).mockImplementation(async (path) =>
      path === '/v1/users' ? { users: USERS } : {},
    );

    await loadUsers();

    expect(additionsUsers).toMatchObject({
      allowedDomains: [],
      commitAuthor: 'user',
      signInMethods: { github: false },
      signUpRules: [],
    });
  });
});

describe('createUser', () => {
  test('sends only the prehash of a generated password, and returns the password', async () => {
    const password = await createUser({
      username: 'editor',
      name: 'Editor',
      email: '',
      role: 'editor',
    });

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/users', {
      method: 'POST',
      body: {
        username: 'editor',
        name: 'Editor',
        email: null,
        role: 'editor',
        prehash: `site-1:editor:${password}`,
      },
      token: 'session',
    });
    // Only the users are reloaded after a change
    expect(fetchAdditions).toHaveBeenLastCalledWith('/v1/users', {
      method: undefined,
      body: undefined,
      token: 'session',
    });
    expect(additionsUsers.users).toEqual(USERS);
  });

  test('keeps an email', async () => {
    await createUser({ username: 'editor', name: 'Editor', email: 'e@x.org', role: 'viewer' });

    expect(vi.mocked(fetchAdditions).mock.calls[0][1]?.body?.email).toBe('e@x.org');
  });
});

describe('updateUser, signOutUser and deleteUser', () => {
  test('send the change, then reload the users', async () => {
    await updateUser('u/2', { role: 'viewer' });
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/users/u%2F2', {
      method: 'PATCH',
      body: { role: 'viewer' },
      token: 'session',
    });

    await signOutUser('u2');
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/users/u2/sessions', {
      method: 'DELETE',
      body: undefined,
      token: 'session',
    });

    await deleteUser('u2');
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/users/u2', {
      method: 'DELETE',
      body: undefined,
      token: 'session',
    });
    expect(fetchAdditions).toHaveBeenLastCalledWith('/v1/users', {
      method: undefined,
      body: undefined,
      token: 'session',
    });
  });

  test('reload the users after a refused change too, so the page shows what was kept', async () => {
    additionsUsers.users = /** @type {any} */ ([{ id: 'u1', username: 'admin', role: 'editor' }]);
    vi.mocked(fetchAdditions).mockImplementation(async (path, { method } = {}) => {
      if (method === 'PATCH') {
        throw new Error('Last admin');
      }

      return { users: USERS };
    });

    await expect(updateUser('u1', { role: 'editor' })).rejects.toThrow('Last admin');
    expect(additionsUsers.users).toEqual(USERS);
    // Still an admin, as the change was refused
    expect(user.account?.role).toBe('admin');
  });

  test('update the signed-in admin’s own role, name and email straight away', async () => {
    additionsUsers.users = /** @type {any} */ (USERS);

    await updateUser('u1', { role: 'editor' });
    expect(user.account?.role).toBe('editor');

    // Someone else’s change doesn’t touch it
    await updateUser('u2', { role: 'viewer' });
    expect(user.account?.role).toBe('editor');

    // Their name and email are updated too, and an email can be removed
    await updateUser('u1', { name: 'Ada', email: 'ada@example.com' });
    expect(user.account).toMatchObject({ role: 'editor', name: 'Ada', email: 'ada@example.com' });
    await updateUser('u1', { email: null });
    expect(user.account).toMatchObject({ name: 'Ada', email: undefined });
  });

  test('don’t list the users again once the admin has given up the role', async () => {
    additionsUsers.users = /** @type {any} */ (USERS);

    await expect(updateUser('u1', { role: 'editor' })).resolves.toBeUndefined();
    expect(fetchAdditions).not.toHaveBeenCalledWith('/v1/users', expect.anything());
  });

  test('report the change, not the list failing to load afterwards', async () => {
    const refused = new Error('Last admin');

    vi.mocked(fetchAdditions).mockImplementation(async (path, { method } = {}) => {
      if (method === 'PATCH') {
        throw refused;
      }

      throw new Error('Unreachable');
    });

    await expect(updateUser('u2', { role: 'viewer' })).rejects.toBe(refused);

    // A change that worked isn’t reported as failed
    vi.mocked(fetchAdditions).mockImplementation(async (path, { method } = {}) => {
      if (method === 'PATCH') {
        return {};
      }

      throw new Error('Unreachable');
    });
    await expect(updateUser('u2', { role: 'viewer' })).resolves.toBeUndefined();
  });
});

describe('resetPassword', () => {
  test('sends the prehash of a new temporary password, and returns the password', async () => {
    const password = await resetPassword(/** @type {any} */ ({ id: 'u2', username: 'editor' }));

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/users/u2/password', {
      method: 'POST',
      body: { prehash: `site-1:editor:${password}` },
      token: 'session',
    });
  });
});

describe('GitHub users and sign-in settings', () => {
  test('creates a user who signs in with GitHub, without a password', async () => {
    await expect(
      createUser({ username: 'mona', name: 'Mona', role: 'editor', github: 'octocat' }),
    ).resolves.toBe('');
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/users', {
      method: 'POST',
      body: { username: 'mona', name: 'Mona', email: null, role: 'editor', github: 'octocat' },
      token: 'session',
    });
  });
});
