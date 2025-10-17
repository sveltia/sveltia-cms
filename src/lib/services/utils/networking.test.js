import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { sendRequest } from './networking';

// Mock global fetch
const mockFetch = vi.fn();

global.fetch = mockFetch;

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
});
