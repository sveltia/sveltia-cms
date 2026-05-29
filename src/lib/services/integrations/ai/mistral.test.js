import { beforeEach, describe, expect, it, vi } from 'vitest';

import { complete } from './mistral.js';

// Mock fetch globally
global.fetch = vi.fn();

const defaultOptions = {
  apiKey: 'abcdefghijklmnopqrstuvwxyz123456',
  model: 'mistral-small-latest',
  systemPrompt: 'You are a helpful assistant.',
  userMessage: 'Hello!',
};

describe('Mistral AI Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('complete', () => {
    it('should return trimmed response text on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '  Hello there!  ' } }] }), {
          status: 200,
        }),
      );

      const result = await complete(defaultOptions);

      expect(result).toBe('Hello there!');
    });

    it('should send a POST request to the Mistral AI endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );

      await complete(defaultOptions);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.mistral.ai/v1/chat/completions',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should include Authorization and Content-Type headers', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );

      await complete(defaultOptions);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${defaultOptions.apiKey}`,
          },
        }),
      );
    });

    it('should send model, messages, and stream=false in the request body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );

      await complete(defaultOptions);

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.model).toBe(defaultOptions.model);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]).toEqual({ role: 'system', content: defaultOptions.systemPrompt });
      expect(body.messages[1]).toEqual({ role: 'user', content: defaultOptions.userMessage });
      expect(body.stream).toBe(false);
    });

    it('should use default temperature, max_tokens, and reasoning_effort=high when not provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );

      await complete(defaultOptions);

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(4000);
      expect(body.reasoning_effort).toBe('high');
    });

    it('should forward custom temperature and maxTokens', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );

      await complete({ ...defaultOptions, temperature: 0.7, maxTokens: 512 });

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(512);
    });

    it('should send reasoning_effort=none when reasoning option is false', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );

      await complete({ ...defaultOptions, reasoning: false });

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.reasoning_effort).toBe('none');
    });

    it('should throw with status and message on non-OK response with error body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Invalid API key' }), {
          status: 401,
          statusText: 'Unauthorized',
        }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Mistral AI API error: 401 Unauthorized - Invalid API key',
      );
    });

    it('should throw with status only on non-OK response without error message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('{}', { status: 429, statusText: 'Too Many Requests' }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Mistral AI API error: 429 Too Many Requests',
      );
    });

    it('should throw on non-OK response when error body is not valid JSON', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('not json', { status: 500, statusText: 'Internal Server Error' }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Mistral AI API error: 500 Internal Server Error',
      );
    });

    it('should throw on invalid response format (missing choices)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from Mistral AI API.',
      );
    });

    it('should throw on invalid response format (empty choices array)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [] }), { status: 200 }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from Mistral AI API.',
      );
    });

    it('should throw on invalid response format (missing message content)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from Mistral AI API.',
      );
    });
  });
});
