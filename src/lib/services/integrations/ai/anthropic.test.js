import { beforeEach, describe, expect, it, vi } from 'vitest';

import { complete } from './anthropic.js';

// Mock fetch globally
global.fetch = vi.fn();

const defaultOptions = {
  apiKey: 'sk-ant-api03-test-key',
  model: 'claude-haiku-4-5',
  systemPrompt: 'You are a helpful assistant.',
  userMessage: 'Hello!',
};

describe('Anthropic AI Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('complete', () => {
    it('should return trimmed response text on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: '  Hello there!  ' }] }), { status: 200 }),
      );

      const result = await complete(defaultOptions);

      expect(result).toBe('Hello there!');
    });

    it('should send a POST request to the Anthropic Messages API endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
      );

      await complete(defaultOptions);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should include required Anthropic headers', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
      );

      await complete(defaultOptions);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': defaultOptions.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          }),
        }),
      );
    });

    it('should send model, system prompt, and user message in the request body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
      );

      await complete(defaultOptions);

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.model).toBe(defaultOptions.model);
      expect(body.system).toBe(defaultOptions.systemPrompt);
      expect(body.messages).toEqual([{ role: 'user', content: defaultOptions.userMessage }]);
    });

    it('should use default temperature and maxTokens when not provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
      );

      await complete(defaultOptions);

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(4000);
    });

    it('should forward custom temperature and maxTokens', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
      );

      await complete({ ...defaultOptions, temperature: 0.8, maxTokens: 1000 });

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.temperature).toBe(0.8);
      expect(body.max_tokens).toBe(1000);
    });

    it('should throw with status and message on non-OK response with error body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
          status: 401,
          statusText: 'Unauthorized',
        }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Anthropic API error: 401 Unauthorized - Invalid API key',
      );
    });

    it('should throw with status only on non-OK response without error message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('{}', { status: 500, statusText: 'Internal Server Error' }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Anthropic API error: 500 Internal Server Error',
      );
    });

    it('should throw on non-OK response when error body is not valid JSON', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('not json', { status: 503, statusText: 'Service Unavailable' }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Anthropic API error: 503 Service Unavailable',
      );
    });

    it('should throw on missing content array in response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from Anthropic API.',
      );
    });

    it('should throw on empty content array in response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [] }), { status: 200 }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from Anthropic API.',
      );
    });
  });
});
