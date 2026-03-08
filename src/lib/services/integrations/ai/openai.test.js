import { beforeEach, describe, expect, it, vi } from 'vitest';

import { complete } from './openai.js';

// Mock fetch globally
global.fetch = vi.fn();

const defaultOptions = {
  apiKey: 'sk-proj-test-key-1234567890abcdef',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  userMessage: 'Hello!',
};

describe('OpenAI AI Client', () => {
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

    it('should send a POST request to the OpenAI Chat Completions endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );

      await complete(defaultOptions);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
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

    it('should send model, system prompt, and user message in the request body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );

      await complete(defaultOptions);

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.model).toBe(defaultOptions.model);
      expect(body.messages).toEqual([
        { role: 'system', content: defaultOptions.systemPrompt },
        { role: 'user', content: defaultOptions.userMessage },
      ]);
    });

    it('should use default temperature and max_tokens when not provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );

      await complete(defaultOptions);

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(4000);
    });

    it('should forward custom temperature and maxTokens', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        }),
      );

      await complete({ ...defaultOptions, temperature: 1.0, maxTokens: 512 });

      const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

      expect(body.temperature).toBe(1.0);
      expect(body.max_tokens).toBe(512);
    });

    it('should throw with status and message on non-OK response with error body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
          status: 401,
          statusText: 'Unauthorized',
        }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'OpenAI API error: 401 Unauthorized - Invalid API key',
      );
    });

    it('should throw with status only on non-OK response without error message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('{}', { status: 429, statusText: 'Too Many Requests' }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'OpenAI API error: 429 Too Many Requests',
      );
    });

    it('should throw on non-OK response when error body is not valid JSON', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('not json', { status: 500, statusText: 'Internal Server Error' }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'OpenAI API error: 500 Internal Server Error',
      );
    });

    it('should throw on missing choices in response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from OpenAI API.',
      );
    });

    it('should throw on empty choices array in response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [] }), { status: 200 }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from OpenAI API.',
      );
    });

    it('should throw on missing message in choice', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{}] }), { status: 200 }),
      );

      await expect(complete(defaultOptions)).rejects.toThrow(
        'Invalid response format from OpenAI API.',
      );
    });
  });
});
