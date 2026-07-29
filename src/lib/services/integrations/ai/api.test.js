import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chatCompletions, messages, responses } from './api.js';

// Mock fetch globally
global.fetch = vi.fn();

const defaultOptions = {
  endpoint: 'https://api.example.com/v1/messages',
  apiKey: 'test-api-key',
  model: 'test-model',
  systemPrompt: 'You are helpful.',
  userMessage: 'Hello!',
};

describe('AI API Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('messages', () => {
    describe('header handling', () => {
      it('should set x-api-key when neither Authorization nor x-api-key headers are provided', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
        );

        await messages(defaultOptions);

        const { headers } = /** @type {RequestInit} */ (vi.mocked(fetch).mock.calls[0][1]);

        expect(/** @type {Record<string, string>} */ (headers)['x-api-key']).toBe(
          defaultOptions.apiKey,
        );
      });

      it('should not set x-api-key when Authorization header is already provided', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
        );

        const customHeaders = { Authorization: 'Bearer existing-token' };

        await messages({ ...defaultOptions, headers: customHeaders });

        const { headers } = /** @type {RequestInit} */ (vi.mocked(fetch).mock.calls[0][1]);

        expect(/** @type {Record<string, string>} */ (headers).Authorization).toBe(
          'Bearer existing-token',
        );
        expect(/** @type {Record<string, string>} */ (headers)['x-api-key']).toBeUndefined();
      });

      it('should not set x-api-key when x-api-key header is already provided', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
        );

        const customHeaders = { 'x-api-key': 'existing-key' };

        await messages({ ...defaultOptions, headers: customHeaders });

        const { headers } = /** @type {RequestInit} */ (vi.mocked(fetch).mock.calls[0][1]);

        expect(/** @type {Record<string, string>} */ (headers)['x-api-key']).toBe('existing-key');
      });

      it('should preserve other custom headers', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
        );

        const customHeaders = {
          'X-Custom-Header': 'custom-value',
          'X-Another-Header': 'another-value',
        };

        await messages({ ...defaultOptions, headers: customHeaders });

        const { headers } = /** @type {RequestInit} */ (vi.mocked(fetch).mock.calls[0][1]);

        expect(/** @type {Record<string, string>} */ (headers)['X-Custom-Header']).toBe(
          'custom-value',
        );
        expect(/** @type {Record<string, string>} */ (headers)['X-Another-Header']).toBe(
          'another-value',
        );
      });
    });

    describe('request body', () => {
      it('should include model, max_tokens, temperature, system, and messages', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
        );

        await messages(defaultOptions);

        const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

        expect(body.model).toBe(defaultOptions.model);
        expect(body.max_tokens).toBe(4000);
        expect(body.temperature).toBe(0.3);
        expect(body.system).toBe(defaultOptions.systemPrompt);
        expect(body.messages).toEqual([{ role: 'user', content: defaultOptions.userMessage }]);
      });

      it('should use custom temperature and maxTokens', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
        );

        await messages({ ...defaultOptions, temperature: 0.7, maxTokens: 2000 });

        const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

        expect(body.temperature).toBe(0.7);
        expect(body.max_tokens).toBe(2000);
      });

      it('should include extra body parameters', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }),
        );

        const extraBody = { custom_param: 'custom_value' };

        await messages({ ...defaultOptions, extraBody });

        const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

        expect(body.custom_param).toBe('custom_value');
      });
    });

    describe('response handling', () => {
      it('should return trimmed text from content array', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ content: [{ text: '  response text  ' }] }), {
            status: 200,
          }),
        );

        const result = await messages(defaultOptions);

        expect(result).toBe('response text');
      });

      it('should throw on missing content array', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

        await expect(messages(defaultOptions)).rejects.toThrow(
          'Invalid response format from Messages API.',
        );
      });

      it('should throw on empty content array', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ content: [] }), { status: 200 }),
        );

        await expect(messages(defaultOptions)).rejects.toThrow(
          'Invalid response format from Messages API.',
        );
      });

      it('should throw on non-array content', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ content: 'not-an-array' }), { status: 200 }),
        );

        await expect(messages(defaultOptions)).rejects.toThrow(
          'Invalid response format from Messages API.',
        );
      });
    });

    describe('error handling', () => {
      it('should throw with status and message on non-OK response', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: 'Invalid key' } }), {
            status: 401,
            statusText: 'Unauthorized',
          }),
        );

        await expect(messages(defaultOptions)).rejects.toThrow(
          'Messages API error: 401 Unauthorized - Invalid key',
        );
      });

      it('should throw with status only when error message is missing', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 500, statusText: 'Internal Error' }),
        );

        await expect(messages(defaultOptions)).rejects.toThrow(
          'Messages API error: 500 Internal Error',
        );
      });

      it('should throw when error body is not valid JSON', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response('not json', { status: 503, statusText: 'Unavailable' }),
        );

        await expect(messages(defaultOptions)).rejects.toThrow(
          'Messages API error: 503 Unavailable',
        );
      });
    });
  });

  describe('chatCompletions', () => {
    describe('request', () => {
      it('should send Authorization header with Bearer token', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'response' } }],
            }),
            { status: 200 },
          ),
        );

        await chatCompletions(defaultOptions);

        const { headers } = /** @type {RequestInit} */ (vi.mocked(fetch).mock.calls[0][1]);

        expect(/** @type {Record<string, string>} */ (headers).Authorization).toBe(
          `Bearer ${defaultOptions.apiKey}`,
        );
      });

      it('should include messages array with system and user messages', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'response' } }],
            }),
            { status: 200 },
          ),
        );

        await chatCompletions(defaultOptions);

        const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

        expect(body.messages).toEqual([
          { role: 'system', content: defaultOptions.systemPrompt },
          { role: 'user', content: defaultOptions.userMessage },
        ]);
      });

      it('should include reasoning_effort parameter', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'response' } }],
            }),
            { status: 200 },
          ),
        );

        await chatCompletions({ ...defaultOptions, reasoning: 'high' });

        const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

        expect(body.reasoning_effort).toBe('high');
      });

      it('should set stream to false', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'response' } }],
            }),
            { status: 200 },
          ),
        );

        await chatCompletions(defaultOptions);

        const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

        expect(body.stream).toBe(false);
      });
    });

    describe('response handling', () => {
      it('should return trimmed text from choices array', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '  response text  ' } }],
            }),
            { status: 200 },
          ),
        );

        const result = await chatCompletions(defaultOptions);

        expect(result).toBe('response text');
      });

      it('should throw on missing choices array', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

        await expect(chatCompletions(defaultOptions)).rejects.toThrow(
          'Invalid response format from Chat Completions API.',
        );
      });

      it('should throw on empty choices array', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ choices: [] }), { status: 200 }),
        );

        await expect(chatCompletions(defaultOptions)).rejects.toThrow(
          'Invalid response format from Chat Completions API.',
        );
      });

      it('should throw when message.content is missing', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              choices: [{ message: {} }],
            }),
            { status: 200 },
          ),
        );

        await expect(chatCompletions(defaultOptions)).rejects.toThrow(
          'Invalid response format from Chat Completions API.',
        );
      });
    });

    describe('error handling', () => {
      it('should throw with status and message on non-OK response', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: 'API error' } }), {
            status: 400,
            statusText: 'Bad Request',
          }),
        );

        await expect(chatCompletions(defaultOptions)).rejects.toThrow(
          'Chat Completions API error: 400 Bad Request - API error',
        );
      });

      it('should throw with status only when error message is missing', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 502, statusText: 'Bad Gateway' }),
        );

        await expect(chatCompletions(defaultOptions)).rejects.toThrow(
          'Chat Completions API error: 502 Bad Gateway',
        );
      });
    });
  });

  describe('responses', () => {
    describe('request', () => {
      it('should send Authorization header with Bearer token', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ output_text: 'response' }), { status: 200 }),
        );

        await responses(defaultOptions);

        const { headers } = /** @type {RequestInit} */ (vi.mocked(fetch).mock.calls[0][1]);

        expect(/** @type {Record<string, string>} */ (headers).Authorization).toBe(
          `Bearer ${defaultOptions.apiKey}`,
        );
      });

      it('should include instructions, input, store, and max_output_tokens', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ output_text: 'response' }), { status: 200 }),
        );

        await responses(defaultOptions);

        const body = JSON.parse(/** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body));

        expect(body.instructions).toBe(defaultOptions.systemPrompt);
        expect(body.input).toBe(defaultOptions.userMessage);
        expect(body.store).toBe(false);
        expect(body.max_output_tokens).toBe(4000);
      });
    });

    describe('response handling', () => {
      it('should return trimmed text from output_text field', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ output_text: '  response text  ' }), { status: 200 }),
        );

        const result = await responses(defaultOptions);

        expect(result).toBe('response text');
      });

      it('should parse message with output_text type from output array', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              output: [
                {
                  type: 'message',
                  content: [{ type: 'output_text', text: '  text content  ' }],
                },
              ],
            }),
            { status: 200 },
          ),
        );

        const result = await responses(defaultOptions);

        expect(result).toBe('text content');
      });

      it('should throw when output_text is not found', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              output: [
                {
                  type: 'message',
                  content: [{ type: 'other_type', data: 'value' }],
                },
              ],
            }),
            { status: 200 },
          ),
        );

        await expect(responses(defaultOptions)).rejects.toThrow(
          'Invalid response format from Responses API.',
        );
      });

      it('should throw when message content is not an array', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              output: [
                {
                  type: 'message',
                  content: 'not-an-array',
                },
              ],
            }),
            { status: 200 },
          ),
        );

        await expect(responses(defaultOptions)).rejects.toThrow(
          'Invalid response format from Responses API.',
        );
      });

      it('should throw when message is not found in output', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              output: [{ type: 'other_type', content: [] }],
            }),
            { status: 200 },
          ),
        );

        await expect(responses(defaultOptions)).rejects.toThrow(
          'Invalid response format from Responses API.',
        );
      });

      it('should handle output as empty array when output is not an array', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              output: 'not-an-array',
            }),
            { status: 200 },
          ),
        );

        await expect(responses(defaultOptions)).rejects.toThrow(
          'Invalid response format from Responses API.',
        );
      });
    });

    describe('error handling', () => {
      it('should throw with status and message on non-OK response', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: 'Rate limited' } }), {
            status: 429,
            statusText: 'Too Many Requests',
          }),
        );

        await expect(responses(defaultOptions)).rejects.toThrow(
          'Responses API error: 429 Too Many Requests - Rate limited',
        );
      });

      it('should throw with status only when error message is missing', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 500, statusText: 'Server Error' }),
        );

        await expect(responses(defaultOptions)).rejects.toThrow(
          'Responses API error: 500 Server Error',
        );
      });
    });
  });
});
