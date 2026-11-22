// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAdditions } from '$lib/services/additions/api';
import {
  additionsSetup,
  closeSetup,
  connectGitHub,
  getOwnerType,
  getSetupResultMessage,
  openSetup,
  readSetupResult,
  rekeyDataKey,
  rewrapDataKey,
  saveAdmin,
  submitManifest,
  unlockSetup,
} from '$lib/services/additions/setup.svelte';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));
vi.mock('$lib/services/additions/api', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAdditions: vi.fn(),
}));
vi.mock('$lib/services/additions/kdf', () => ({
  derivePrehash: vi.fn(
    async ({ siteId, username, password }) => `${siteId}:${username}:${password}`,
  ),
}));

const STATUS = {
  site_id: 'site-1',
  data_key: 'ok',
  admins: 0,
  allowed_domains: [],
  github_app: null,
  installation: null,
};

beforeEach(() => {
  vi.mocked(fetchAdditions).mockReset();
  vi.mocked(fetchAdditions).mockResolvedValue(STATUS);
  closeSetup();
  additionsSetup.result = '';
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('openSetup and closeSetup', () => {
  test('open the wizard, then forget the secret and the status when it closes', async () => {
    additionsSetup.result = 'ok';
    openSetup();
    expect(additionsSetup).toMatchObject({ open: true, result: '' });

    await unlockSetup('secret');
    closeSetup();
    expect(additionsSetup).toMatchObject({ open: false, secret: '', status: undefined });
  });
});

describe('unlockSetup', () => {
  test('reads the status with the admin secret, and keeps the secret', async () => {
    await unlockSetup('secret');

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/setup/status', { token: 'secret' });
    expect(additionsSetup).toMatchObject({ secret: 'secret', status: STATUS });
  });

  test('keeps nothing when the secret is refused', async () => {
    vi.mocked(fetchAdditions).mockRejectedValue(new Error('Wrong'));

    await expect(unlockSetup('wrong')).rejects.toThrow('Wrong');
    expect(additionsSetup).toMatchObject({ secret: '', status: undefined });
  });
});

describe('saveAdmin', () => {
  test('sends the prehash of the password, allows the site, then reads the status again', async () => {
    await unlockSetup('secret');
    vi.mocked(fetchAdditions)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ...STATUS, admins: 1 });

    await saveAdmin({ username: 'kohei', password: 'admin password' });

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/setup/admin', {
      method: 'POST',
      token: 'secret',
      body: { username: 'kohei', prehash: 'site-1:kohei:admin password', allow_origin: true },
    });
    expect(additionsSetup.status?.admins).toBe(1);
  });
});

describe('getOwnerType', () => {
  test('looks the account up on GitHub', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ type: 'Organization' }))
      .mockResolvedValueOnce(Response.json({ type: 'User' }));

    await expect(getOwnerType('sveltia')).resolves.toBe('Organization');
    await expect(getOwnerType('octocat')).resolves.toBe('User');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.github.com/users/sveltia');
  });

  test('leaves the lookup to the service when GitHub refuses or can’t be reached', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ message: 'API rate limit exceeded' }, { status: 403 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(getOwnerType('sveltia')).resolves.toBeUndefined();
    await expect(getOwnerType('sveltia')).resolves.toBeUndefined();
  });
});

describe('connectGitHub', () => {
  test('submits the manifest the service returns to GitHub, coming back to this page', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ type: 'User' }));

    await unlockSetup('secret');
    vi.mocked(fetchAdditions).mockResolvedValueOnce({
      action_url: 'https://github.com/settings/apps/new?state=abc',
      manifest: { name: 'Sveltia CMS site' },
    });

    await connectGitHub({ repo: 'octocat/site' });

    expect(fetchAdditions).toHaveBeenLastCalledWith('/v1/setup/github', {
      method: 'POST',
      token: 'secret',
      body: {
        repo: 'octocat/site',
        return_url: window.location.href,
        replace: false,
        owner_type: 'User',
      },
    });
    expect(submit).toHaveBeenCalledOnce();

    const form = /** @type {HTMLFormElement} */ (document.querySelector('form'));

    expect(form.method).toBe('post');
    expect(form.action).toBe('https://github.com/settings/apps/new?state=abc');
    expect(/** @type {HTMLInputElement} */ (form.elements.namedItem('manifest')).value).toBe(
      '{"name":"Sveltia CMS site"}',
    );

    form.remove();
    submit.mockRestore();
  });
});

describe('submitManifest', () => {
  test('posts the manifest as a hidden form field', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});

    submitManifest('https://github.com/settings/apps/new', { a: 1 });

    const input = /** @type {HTMLInputElement} */ (
      document.querySelector('input[name="manifest"]')
    );

    expect(input.type).toBe('hidden');
    expect(input.value).toBe('{"a":1}');
    input.form?.remove();
    submit.mockRestore();
  });

  test('refuses to send the manifest anywhere but GitHub', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});

    // eslint-disable-next-line no-script-url
    ['javascript:alert(1)', 'https://github.com.evil.example/settings/apps/new', 'nope'].forEach(
      (url) => {
        expect(() => submitManifest(url, { a: 1 })).toThrow('isn’t on GitHub');
      },
    );
    expect(submit).not.toHaveBeenCalled();
    expect(document.querySelector('input[name="manifest"]')).toBeNull();
    submit.mockRestore();
  });
});

describe('rewrapDataKey and rekeyDataKey', () => {
  test('recover the stored secrets with or without the previous secret', async () => {
    await unlockSetup('secret');

    await rewrapDataKey('previous secret');
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/setup/secret', {
      method: 'POST',
      token: 'secret',
      body: { previous: 'previous secret' },
    });

    await rekeyDataKey();
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/setup/secret', {
      method: 'POST',
      token: 'secret',
      body: { rekey: true },
    });
    expect(fetchAdditions).toHaveBeenLastCalledWith('/v1/setup/status', { token: 'secret' });
  });
});

describe('readSetupResult', () => {
  test('reads the outcome from the URL and removes it, keeping the hash route', () => {
    window.history.replaceState(null, '', '/admin/?additions_setup=ok&x=1#/collections/posts');

    expect(readSetupResult()).toBe('ok');
    expect(additionsSetup.result).toBe('ok');
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/admin/?x=1#/collections/posts',
    );
  });

  test('does nothing without an outcome in the URL', () => {
    window.history.replaceState(null, '', '/admin/');

    expect(readSetupResult()).toBe('');
    expect(additionsSetup.result).toBe('');
  });
});

describe('getSetupResultMessage', () => {
  test('localizes known outcomes and falls back for the rest', () => {
    expect(getSetupResultMessage('ok')).toBe('additions.setup.result.ok');
    expect(getSetupResultMessage('github_wrong_account')).toBe(
      'additions.setup.result.github_wrong_account',
    );
    expect(getSetupResultMessage('something')).toBe('additions.setup.result.unexpected');
  });
});
