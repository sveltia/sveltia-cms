/* eslint-disable jsdoc/require-param-description */
/* eslint-disable jsdoc/require-returns */
/* eslint-disable jsdoc/require-description */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { complete } from './google.js';

// Mock fetch globally
global.fetch = vi.fn();

const defaultOptions = {
  apiKey: 'AIzaSyTestKey1234567890abcdefghijk',
  model: 'gemini-2.5-flash-lite',
  systemPrompt: 'You are a helpful assistant.',
  userMessage: 'Hello!',
};

/** @param {string} text */
const successResponse = (text) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
  });

describe('Google Gemini AI Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('complete', () => {
    it('should return trimmed response text on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successResponse('  Hello there!  '));

      const result = await complete(defaultOptions);

      expect(result).toBe('Hello there!');
    });

    it('should send a POST request to the Gemini generateContent endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successResponse('ok'));

      await complete(defaultOptions);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`${defaultOptions.model}:generateContent`),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should include the API key in the URL query string', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successResponse('ok'));

      await complete(defaultOptions);

      const url = /** @type {string} */ (vi.mocked(fetch).mock.calls[0][0]);

      expect(url).toContain(`key=${defaultOptions.apiKey}`);
    });

    it('should send system prompt, user message, and model in the request body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successResponse('ok'));

      await complete(defaultOptions);

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.system_instruction).toEqual({
        parts: [{ text: defaultOptions.systemPrompt }],
      });
      expect(body.contents).toEqual([{ parts: [{ text: defaultOptions.userMessage }] }]);
    });

    it('should use default temperature and maxOutputTokens when not provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successResponse('ok'));

      await complete(defaultOptions);

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.generationConfig.temperature).toBe(0.3);
      expect(body.generationConfig.maxOutputTokens).toBe(4000);
    });

    it('should forward custom temperature and maxTokens', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successResponse('ok'));

      await complete({ ...defaultOptions, temperature: 0.9, maxTokens: 1024 });

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.generationConfig.temperature).toBe(0.9);
      expect(body.generationConfig.maxOutputTokens).toBe(1024);
    });

    it('should include responseMimeType when responseFormat is provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successResponse('["ok"]'));

      await complete({ ...defaultOptions, responseFormat: 'application/json' });

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.generationConfig.responseMimeType).toBe('application/json');
    });

    it('should omit responseMimeType when responseFormat is not provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successResponse('ok'));

      await complete(defaultOptions);

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.generationConfig.responseMimeType).toBeUndefined();
    });

    it('should throw with status and message on non-OK response with error body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
          status: 401,
          statusText: 'Unauthorized',
        }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Gemini API error: 401 Unauthorized - Invalid API key',
      );
    });

    it('should throw with status only on non-OK response without error message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('{}', { status: 500, statusText: 'Internal Server Error' }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Gemini API error: 500 Internal Server Error',
      );
    });

    it('should throw on non-OK response when error body is not valid JSON', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('not json', { status: 503, statusText: 'Service Unavailable' }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Gemini API error: 503 Service Unavailable',
      );
    });

    it('should throw on missing candidates array in response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from Gemini API.',
      );
    });

    it('should throw on empty candidates array in response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from Gemini API.',
      );
    });

    it('should throw on missing content parts in candidate', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }), { status: 200 }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from Gemini API.',
      );
    });
  });
});
