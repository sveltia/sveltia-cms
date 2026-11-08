import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  assertResponseOK,
  fetchOK,
  getRetryDelay,
  isLocalHostname,
  isSecureURL,
  MAX_RETRY_DELAY,
  sendRequest,
} from './networking';

vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn().mockResolvedValue(undefined) }));

// Mock global fetch
const mockFetch = vi.fn();

global.fetch = mockFetch;

describe('isLocalHostname', () => {
  test('should accept localhost, its subdomains and the loopback addresses', () => {
    ['localhost', 'mysite.localhost', '127.0.0.1', '[::1]'].forEach((hostname) => {
      expect(isLocalHostname(hostname)).toBe(true);
    });
  });

  test('should reject other hostnames', () => {
    ['example.com', 'localhost.example.com', 'notlocalhost', '192.168.0.1', '::1'].forEach(
      (hostname) => {
        expect(isLocalHostname(hostname)).toBe(false);
      },
    );
  });
});

describe('isSecureURL', () => {
  test('should allow HTTPS URLs', () => {
    expect(isSecureURL('https://example.com/hook')).toBe(true);
  });

  test('should allow localhost HTTP URLs', () => {
    expect(isSecureURL('http://localhost:3000/hook')).toBe(true);
    expect(isSecureURL('http://127.0.0.1:3000/hook')).toBe(true);
  });

  test('should allow HTTP URLs on a subdomain of localhost', () => {
    expect(isSecureURL('http://mysite.localhost:4321/admin/config.yml')).toBe(true);
    expect(isSecureURL('http://localhost.example.com/hook')).toBe(false);
  });

  test('should reject non-local HTTP URLs', () => {
    expect(isSecureURL('http://example.com/hook')).toBe(false);
  });

  test('should reject non-HTTP protocols', () => {
    expect(isSecureURL('ftp://example.com/hook')).toBe(false);
  });

  test('should resolve relative URLs against the provided base URL', () => {
    expect(isSecureURL('/hook', 'https://example.com')).toBe(true);
    expect(isSecureURL('/hook', 'http://example.com')).toBe(false);
  });

  test('should return false for invalid URLs that throw during parsing', () => {
    expect(isSecureURL('http://[invalid]:80')).toBe(false);
  });
});

describe('sendRequest', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should send successful JSON request', async () => {
    const mockResponse = { data: 'test' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockResponse),
    });

    const result = await sendRequest('https://api.example.com/data');

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      cache: 'no-cache',
      headers: expect.any(Headers),
    });
    expect(result).toEqual(mockResponse);
  });

  test('should set correct headers for JSON requests', async () => {
    const mockResponse = { data: 'test' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockResponse),
    });

    await sendRequest('https://api.example.com/data');

    const [, init] = mockFetch.mock.calls[0];
    const { headers } = init;

    expect(headers.get('Accept')).toBe('application/json');
  });

  test('should reject Authorization headers over insecure remote HTTP', async () => {
    await expect(
      sendRequest('http://api.example.com/data', { headers: { Authorization: 'token secret' } }),
    ).rejects.toThrow('Refusing to send credentials over an insecure connection');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('should allow Authorization headers over localhost HTTP', async () => {
    const mockResponse = { data: 'test' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockResponse),
    });

    await expect(
      sendRequest('http://localhost:3000/data', { headers: { Authorization: 'token secret' } }),
    ).resolves.toEqual(mockResponse);
  });

  test('should handle POST requests with JSON body', async () => {
    const mockResponse = { success: true };
    const requestBody = { name: 'test' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockResponse),
    });

    await sendRequest('https://api.example.com/data', {
      method: 'POST',
      body: /** @type {any} */ (requestBody),
    });

    const [, init] = mockFetch.mock.calls[0];
    const { headers } = init;

    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.body).toBe(JSON.stringify(requestBody));
  });

  test('should return text response when responseType is text', async () => {
    const mockText = 'plain text response';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      text: () => Promise.resolve(mockText),
    });

    const result = await sendRequest('https://api.example.com/data', {}, { responseType: 'text' });

    expect(result).toBe(mockText);
  });

  test('should return blob response when responseType is blob', async () => {
    const mockBlob = new Blob(['test']);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      blob: () => Promise.resolve(mockBlob),
    });

    const result = await sendRequest('https://api.example.com/data', {}, { responseType: 'blob' });

    expect(result).toBe(mockBlob);
  });

  test('should return raw response when responseType is raw', async () => {
    const mockResponse = { ok: true, status: 200 };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await sendRequest('https://api.example.com/data', {}, { responseType: 'raw' });

    expect(result).toBe(mockResponse);
  });

  test('should refresh the token on 401 for a raw response', async () => {
    const mockRefreshFunction = vi.fn().mockResolvedValue({ token: 'new-token' });
    const mockSuccessResponse = { ok: true, status: 200 };

    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    mockFetch.mockResolvedValueOnce(mockSuccessResponse);

    const result = await sendRequest(
      'https://api.example.com/data',
      { headers: { Authorization: 'Bearer old-token' } },
      { responseType: 'raw', refreshAccessToken: mockRefreshFunction },
    );

    expect(mockRefreshFunction).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer new-token');
    expect(result).toBe(mockSuccessResponse);
  });

  test('should return a raw 401 response as is after the token has been refreshed', async () => {
    const mockRefreshFunction = vi.fn().mockResolvedValue({ token: 'new-token' });
    const mockErrorResponse = { ok: false, status: 401 };

    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    mockFetch.mockResolvedValueOnce(mockErrorResponse);

    const result = await sendRequest(
      'https://api.example.com/data',
      { headers: { Authorization: 'token old-token' } },
      { responseType: 'raw', refreshAccessToken: mockRefreshFunction },
    );

    expect(mockRefreshFunction).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toBe(mockErrorResponse);
  });

  test('should retry once on 502 for a raw response', async () => {
    const { sleep } = await import('@sveltia/utils/misc');
    const mockErrorResponse = { ok: false, status: 502 };
    const mockSuccessResponse = { ok: true, status: 200 };

    mockFetch.mockResolvedValueOnce(mockErrorResponse);
    mockFetch.mockResolvedValueOnce(mockSuccessResponse);

    const result = await sendRequest('https://api.example.com/data', {}, { responseType: 'raw' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(result).toBe(mockSuccessResponse);

    // The retry is made once only
    mockFetch.mockResolvedValueOnce(mockErrorResponse);
    mockFetch.mockResolvedValueOnce(mockErrorResponse);

    expect(await sendRequest('https://api.example.com/data', {}, { responseType: 'raw' })).toBe(
      mockErrorResponse,
    );
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  test('should return a raw 401 response as is without a token refresh function', async () => {
    const mockErrorResponse = { ok: false, status: 401 };

    mockFetch.mockResolvedValueOnce(mockErrorResponse);

    const result = await sendRequest('https://api.example.com/data', {}, { responseType: 'raw' });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toBe(mockErrorResponse);
  });

  test('should throw error when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(sendRequest('https://api.example.com/data')).rejects.toThrow(
      'Failed to send the request',
    );
  });

  test('should throw error when JSON parsing fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    await expect(sendRequest('https://api.example.com/data')).rejects.toThrow(
      'Failed to parse the response',
    );
  });

  test('should handle GraphQL errors in 200 OK response', async () => {
    const mockResponse = {
      errors: [{ message: 'GraphQL error' }],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockResponse),
    });

    await expect(sendRequest('https://api.example.com/graphql')).rejects.toThrow(
      'Server responded with an error',
    );
  });

  test('should handle 401 unauthorized with token refresh', async () => {
    const mockRefreshFunction = vi.fn().mockResolvedValue({ token: 'new-token' });
    const mockErrorResponse = { error: 'Unauthorized' };
    const mockSuccessResponse = { data: 'success' };

    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockErrorResponse),
      headers: {
        // eslint-disable-next-line jsdoc/require-jsdoc
        get: () => 'token old-token',
      },
    });

    // Second call (after refresh) returns success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockSuccessResponse),
    });

    const result = await sendRequest(
      'https://api.example.com/data',
      { headers: { Authorization: 'token old-token' } },
      { refreshAccessToken: mockRefreshFunction },
    );

    expect(mockRefreshFunction).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual(mockSuccessResponse);
  });

  test('should handle 401 unauthorized with token refresh when no Authorization header', async () => {
    const mockRefreshFunction = vi.fn().mockResolvedValue({ token: 'new-token' });
    const mockErrorResponse = { error: 'Unauthorized' };
    const mockSuccessResponse = { data: 'success' };

    // First call returns 401 without Authorization header
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockErrorResponse),
    });

    // Second call (after refresh) returns success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockSuccessResponse),
    });

    const result = await sendRequest(
      'https://api.example.com/data',
      {},
      { refreshAccessToken: mockRefreshFunction },
    );

    expect(mockRefreshFunction).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Should default to 'token' scheme when no Authorization header exists
    const [, secondInit] = mockFetch.mock.calls[1];

    expect(secondInit.headers.get('Authorization')).toBe('token new-token');
    expect(result).toEqual(mockSuccessResponse);
  });

  test('should retry once on 502 and succeed', async () => {
    const { sleep } = await import('@sveltia/utils/misc');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve({ message: 'Bad Gateway' }),
    });

    const mockSuccessResponse = { data: 'success' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockSuccessResponse),
    });

    const result = await sendRequest('https://api.example.com/data');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(result).toEqual(mockSuccessResponse);
  });

  test('should throw after exhausting 502 retries', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve({ message: 'Bad Gateway' }),
    });

    await expect(sendRequest('https://api.example.com/data')).rejects.toThrow(
      'Server responded with an error',
    );

    // Initial request + 1 retry
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('should not retry a request with side effects on 502', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 502,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve({ message: 'Bad Gateway' }),
    };

    mockFetch.mockResolvedValue(mockErrorResponse);

    // A REST request that writes data, which may have taken effect behind the gateway
    await expect(
      sendRequest('https://api.example.com/dispatches', {
        method: 'POST',
        body: /** @type {any} */ ({ ref: 'main' }),
      }),
    ).rejects.toThrow('Server responded with an error');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await expect(sendRequest('https://api.example.com/data', { method: 'DELETE' })).rejects.toThrow(
      'Server responded with an error',
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // A GraphQL mutation
    await expect(
      sendRequest('https://api.example.com/graphql', {
        method: 'POST',
        body: /** @type {any} */ ({
          query: ' mutation($input: CreateCommitOnBranchInput!) { x }',
          variables: {},
        }),
      }),
    ).rejects.toThrow('Server responded with an error');
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // A body that isn’t JSON
    await expect(
      sendRequest('https://api.example.com/upload', { method: 'PUT', body: 'raw data' }),
    ).rejects.toThrow('Server responded with an error');
    expect(mockFetch).toHaveBeenCalledTimes(4);

    // A raw response
    expect(
      await sendRequest(
        'https://api.example.com/pipeline',
        { method: 'POST', body: /** @type {any} */ ({ ref: 'main' }) },
        { responseType: 'raw' },
      ),
    ).toBe(mockErrorResponse);
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  test('should retry a request with side effects on 502 when it opts in', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 502,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve({ message: 'Bad Gateway' }),
    };

    mockFetch.mockResolvedValueOnce(mockErrorResponse);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve({ id: 'commit-sha' }),
    });

    // A commit that the server refuses to apply twice
    expect(
      await sendRequest(
        'https://api.example.com/commits',
        { method: 'POST', body: /** @type {any} */ ({ branch: 'main' }) },
        { retryable: true },
      ),
    ).toEqual({ id: 'commit-sha' });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // A read that opts out
    mockFetch.mockResolvedValueOnce(mockErrorResponse);

    await expect(
      sendRequest('https://api.example.com/data', {}, { retryable: false }),
    ).rejects.toThrow('Server responded with an error');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test.each([429, 503, 504])(
    'should retry a request without side effects on %i',
    async (status) => {
      const { sleep } = await import('@sveltia/utils/misc');

      mockFetch.mockResolvedValueOnce(
        new Response('busy', { status, headers: { 'Retry-After': '3' } }),
      );
      mockFetch.mockResolvedValueOnce(Response.json({ data: 'success' }));

      expect(await sendRequest('https://api.example.com/data')).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenLastCalledWith(3000);
    },
  );

  test('should retry a GraphQL query and a raw response on a transient error', async () => {
    const { sleep } = await import('@sveltia/utils/misc');

    mockFetch.mockResolvedValueOnce(new Response('busy', { status: 503 }));
    mockFetch.mockResolvedValueOnce(Response.json({ data: { viewer: {} } }));
    expect(
      await sendRequest('https://api.example.com/graphql', {
        method: 'POST',
        body: /** @type {any} */ ({ query: '{ viewer { login } }' }),
      }),
    ).toEqual({ data: { viewer: {} } });

    const okResponse = new Response('ok');

    mockFetch.mockResolvedValueOnce(
      new Response('busy', { status: 429, headers: { 'Retry-After': '1' } }),
    );
    mockFetch.mockResolvedValueOnce(okResponse);
    expect(await sendRequest('https://api.example.com/data', {}, { responseType: 'raw' })).toBe(
      okResponse,
    );
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenLastCalledWith(1000);
  });

  test('should not retry a request the server asks to send again much later', async () => {
    const response = new Response('busy', { status: 429, headers: { 'Retry-After': '60' } });

    mockFetch.mockResolvedValue(response);

    await expect(sendRequest('https://api.example.com/data')).rejects.toMatchObject({
      cause: { status: 429 },
    });
    expect(await sendRequest('https://api.example.com/data', {}, { responseType: 'raw' })).toBe(
      response,
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // A gateway can time out after a large commit has landed, and the repeat would be refused
  test.each([429, 503, 504])(
    'should not retry a request with side effects on %i, even when it opts in',
    async (status) => {
      mockFetch.mockResolvedValue(new Response('busy', { status }));

      await expect(
        sendRequest(
          'https://api.example.com/commits',
          { method: 'POST', body: /** @type {any} */ ({ branch: 'main' }) },
          { retryable: true },
        ),
      ).rejects.toMatchObject({ cause: { status } });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    },
  );

  test('should keep a request retryable after refreshing the token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve({ message: 'Bad Gateway' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve({ id: 'commit-sha' }),
    });

    const refreshAccessToken = vi.fn().mockResolvedValue({ token: 'new-token' });

    expect(
      await sendRequest(
        'https://api.example.com/commits',
        {
          method: 'POST',
          headers: { Authorization: 'token old-token' },
          body: /** @type {any} */ ({ branch: 'main' }),
        },
        { retryable: true, refreshAccessToken },
      ),
    ).toEqual({ id: 'commit-sha' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('should retry a GraphQL query on 502', async () => {
    const mockSuccessResponse = { data: { viewer: { login: 'me' } } };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve({ message: 'Bad Gateway' }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockSuccessResponse),
    });

    const result = await sendRequest('https://api.example.com/graphql', {
      method: 'POST',
      body: /** @type {any} */ ({ query: 'query { viewer { login } }', variables: {} }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual(mockSuccessResponse);

    // The serialized body is sent again as is
    expect(mockFetch.mock.calls[1][1].body).toBe(mockFetch.mock.calls[0][1].body);
  });

  test('should retry a HEAD request on 502 for a raw response', async () => {
    const mockSuccessResponse = { ok: true, status: 200 };

    mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });
    mockFetch.mockResolvedValueOnce(mockSuccessResponse);

    expect(
      await sendRequest(
        'https://api.example.com/data',
        { method: 'head' },
        { responseType: 'raw' },
      ),
    ).toBe(mockSuccessResponse);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('should handle server errors with message', async () => {
    const mockErrorResponse = {
      message: 'Server error message',
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockErrorResponse),
    });

    await expect(sendRequest('https://api.example.com/data')).rejects.toThrow(
      'Server responded with an error',
    );
  });

  test('should handle server errors with error field', async () => {
    const mockErrorResponse = {
      error: 'Custom error message',
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockErrorResponse),
    });

    await expect(sendRequest('https://api.example.com/data')).rejects.toThrow(
      'Server responded with an error',
    );
  });

  test('should handle server errors with errors array', async () => {
    const mockErrorResponse = {
      errors: ['Error 1', 'Error 2'],
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockErrorResponse),
    });

    await expect(sendRequest('https://api.example.com/data')).rejects.toThrow(
      'Server responded with an error',
    );
  });

  test('should handle non-object error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve('Not an object'),
    });

    await expect(sendRequest('https://api.example.com/data')).rejects.toThrow(
      'Server responded with an error',
    );
  });

  // A gateway typically answers a 502 with an HTML page rather than JSON
  test('should retry on 502 with a non-JSON body', async () => {
    const mockSuccessResponse = { data: 'success' };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockSuccessResponse),
    });

    const result = await sendRequest('https://api.example.com/data');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual(mockSuccessResponse);
  });

  test('should refresh the token on 401 with a non-JSON body', async () => {
    const mockRefreshFunction = vi.fn().mockResolvedValue({ token: 'new-token' });
    const mockSuccessResponse = { data: 'success' };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.resolve(mockSuccessResponse),
    });

    const result = await sendRequest(
      'https://api.example.com/data',
      { headers: { Authorization: 'token old-token' } },
      { refreshAccessToken: mockRefreshFunction },
    );

    expect(mockRefreshFunction).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual(mockSuccessResponse);
  });

  test('should report the status of an error response with a non-JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    });

    await expect(sendRequest('https://api.example.com/data')).rejects.toMatchObject({
      message: 'Server responded with an error',
      cause: { status: 404 },
    });
  });

  test('should report the status of a blob request error with a non-JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      // eslint-disable-next-line jsdoc/require-jsdoc
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    });

    await expect(
      sendRequest('https://api.example.com/file', {}, { responseType: 'blob' }),
    ).rejects.toMatchObject({
      message: 'Server responded with an error',
      cause: { status: 403 },
    });
  });
});

describe('getRetryDelay', () => {
  test('should read a number of seconds', () => {
    expect(getRetryDelay(503, new Headers({ 'Retry-After': '2' }))).toBe(2000);
    expect(getRetryDelay(429, new Headers({ 'Retry-After': ' 0 ' }))).toBe(0);
  });

  test('should read an HTTP date', () => {
    vi.useFakeTimers({ now: new Date('2026-11-08T12:00:00Z') });

    try {
      expect(
        getRetryDelay(503, new Headers({ 'Retry-After': 'Sun, 08 Nov 2026 12:00:05 GMT' })),
      ).toBe(5000);
      // A date in the past means the request can be sent again right away
      expect(
        getRetryDelay(503, new Headers({ 'Retry-After': 'Sun, 08 Nov 2026 11:00:00 GMT' })),
      ).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test('should not retry sooner than the server asks', () => {
    expect(getRetryDelay(503, new Headers({ 'Retry-After': '10' }))).toBe(MAX_RETRY_DELAY);
    expect(getRetryDelay(503, new Headers({ 'Retry-After': '11' }))).toBeUndefined();
    expect(getRetryDelay(429, new Headers({ 'Retry-After': '60' }))).toBeUndefined();
  });

  test('should wait a second without a valid header, except for a rate limit', () => {
    expect(getRetryDelay(503, undefined)).toBe(1000);
    expect(getRetryDelay(504, new Headers())).toBe(1000);
    expect(getRetryDelay(502, new Headers({ 'Retry-After': 'soon' }))).toBe(1000);
    // A rate limit without a delay typically lasts until the limit resets, a minute or more later
    expect(getRetryDelay(429, new Headers())).toBeUndefined();
    expect(getRetryDelay(429, new Headers({ 'Retry-After': 'soon' }))).toBeUndefined();
  });
});

describe('assertResponseOK', () => {
  test('should resolve when the response is OK', async () => {
    await expect(
      assertResponseOK(new Response('ok', { status: 200 }), 'Failed'),
    ).resolves.toBeUndefined();
  });

  test('should throw with the response body appended to the message', async () => {
    await expect(
      assertResponseOK(new Response('Access Denied', { status: 403 }), 'Failed to list objects'),
    ).rejects.toThrow(new Error('Failed to list objects: Access Denied'));
  });

  test('should throw on a 404 response unless it’s allowed', async () => {
    await expect(
      assertResponseOK(new Response('Not Found', { status: 404 }), 'Failed'),
    ).rejects.toThrow('Failed: Not Found');
    await expect(
      assertResponseOK(new Response('Not Found', { status: 404 }), 'Failed', {
        allowNotFound: true,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('fetchOK', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('should pass the arguments through and return an OK response', async () => {
    const response = new Response('ok', { status: 200 });
    const init = { headers: { Accept: 'image/*' } };

    mockFetch.mockResolvedValueOnce(response);
    await expect(fetchOK('https://example.com/a.jpg', init)).resolves.toBe(response);
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/a.jpg', init);

    mockFetch.mockResolvedValueOnce(response);
    await fetchOK('https://example.com/b.jpg');
    expect(mockFetch).toHaveBeenLastCalledWith('https://example.com/b.jpg');
  });

  test('should throw when the response status is not OK', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
    await expect(fetchOK('https://example.com/a.jpg')).rejects.toThrow(new Error('HTTP 404'));
  });
});
