import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { assertResponseOK, isLocalHostname, isSecureURL, sendRequest } from './networking';

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
