import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAdditions, getErrorMessage, isGitHubURL } from '$lib/services/additions/api';
import { getAdditionsURL } from '$lib/services/app/additions';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));
vi.mock('$lib/services/app/additions', () => ({
  getAdditionsURL: vi.fn(() => 'https://additions.example'),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getErrorMessage', () => {
  test('localizes known error codes and falls back for the rest', () => {
    expect(getErrorMessage('invalid_credentials')).toBe('additions.error.invalid_credentials');
    expect(getErrorMessage('something_else')).toBe('additions.error.unexpected');
    expect(getErrorMessage(undefined)).toBe('additions.error.unexpected');
  });
});

describe('fetchAdditions', () => {
  test('sends JSON with the session token and returns the parsed response', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));

    await expect(
      fetchAdditions('/v1/auth/password', { method: 'POST', body: { a: 1 }, token: 'session' }),
    ).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe('https://additions.example/v1/auth/password');
    expect(init).toMatchObject({ method: 'POST', body: '{"a":1}' });
    expect(Object.fromEntries(init.headers)).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: 'Bearer session',
    });
  });

  test('sends a plain GET request by default', async () => {
    fetchMock.mockResolvedValue(Response.json({}));

    await fetchAdditions('/version');

    const [, init] = fetchMock.mock.calls[0];

    expect(init).toMatchObject({ method: 'GET' });
    expect(init.body).toBeUndefined();
    expect(Object.fromEntries(init.headers)).toEqual({ accept: 'application/json' });
  });

  test('sends a request without side effects again after a transient error', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response('Bad gateway', { status: 502 }))
      .mockResolvedValueOnce(Response.json({ version: '1.0.0' }));

    try {
      const promise = fetchAdditions('/version');

      await vi.runAllTimersAsync();
      await expect(promise).resolves.toEqual({ version: '1.0.0' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('never sends the session token over an insecure connection', async () => {
    vi.mocked(getAdditionsURL).mockReturnValueOnce('http://additions.example');

    const error = await fetchAdditions('/v1/auth/session', { token: 'session' }).catch((ex) => ex);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(error.cause.message).toBe('additions.error.insecure_connection');
    expect(error.cause.error.message).toMatch(/insecure connection/);
  });

  test('throws an error with the status, code and localized message', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: 'user_disabled', message: 'Disabled.' } }, { status: 403 }),
    );

    const error = await fetchAdditions('/v1/auth/sign-in').catch((ex) => ex);

    expect(error.message).toBe('Disabled.');
    expect(error.cause).toEqual({
      status: 403,
      code: 'user_disabled',
      message: 'additions.error.user_disabled',
    });
  });

  test('throws a generic error for a response that isn’t JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }));

    // Not sent again, as it has side effects
    const error = await fetchAdditions('/v1/auth/sign-out', { method: 'POST' }).catch((ex) => ex);

    expect(fetchMock).toHaveBeenCalledOnce();

    expect(error.message).toBe('Request failed with 502');
    expect(error.cause).toMatchObject({ status: 502, message: 'additions.error.unexpected' });
  });

  test('throws a localized error when the service can’t be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await fetchAdditions('/version').catch((ex) => ex);

    expect(error.cause.message).toBe('additions.error.unreachable');
  });
});

describe('isGitHubURL', () => {
  test('accepts only pages on github.com', () => {
    expect(isGitHubURL('https://github.com/settings/apps/my-app')).toBe(true);
    expect(isGitHubURL('https://github.com/organizations/acme/settings/apps/new?state=x')).toBe(
      true,
    );
    expect(isGitHubURL('http://github.com/settings/apps')).toBe(false);
    expect(isGitHubURL('https://github.com.evil.example/')).toBe(false);
    // eslint-disable-next-line no-script-url
    expect(isGitHubURL('javascript:alert(1)')).toBe(false);
    expect(isGitHubURL('/settings/apps')).toBe(false);
    expect(isGitHubURL(undefined)).toBe(false);
  });
});
