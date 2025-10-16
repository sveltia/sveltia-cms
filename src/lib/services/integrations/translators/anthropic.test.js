import { beforeEach, describe, expect, it, vi } from 'vitest';

import anthropicTranslator, { availability, normalizeLanguage } from './anthropic.js';

// Mock the getLocaleLabel function
vi.mock('$lib/services/contents/i18n', () => ({
  getLocaleLabel: vi.fn((locale) => {
    /** @type {Record<string, string>} */
    const labels = {
      en: 'English',
      fr: 'French',
      de: 'German',
      es: 'Spanish',
      zh: 'Chinese',
      ja: 'Japanese',
    };

    return labels[locale] || locale;
  }),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Anthropic Translator Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Configuration', () => {
    it('should have correct service metadata', () => {
      expect(anthropicTranslator.serviceId).toBe('anthropic');
      expect(anthropicTranslator.serviceLabel).toBe('Anthropic Claude');
      expect(anthropicTranslator.apiLabel).toBe('Anthropic API');
      expect(anthropicTranslator.developerURL).toBe('https://docs.claude.com/en/api/overview');
      expect(anthropicTranslator.apiKeyURL).toBe('https://platform.claude.com/settings/keys');
      expect(anthropicTranslator.apiKeyPattern).toBeInstanceOf(RegExp);
    });

    it('should validate API key pattern', () => {
      const validApiKey =
        'sk-ant-api03-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_abcdefghijklmnopqrstuvwx';

      const invalidApiKeys = [
        'sk-invalid',
        'invalid-key',
        '',
        'sk-ant-api03-short',
        'ak-ant-api03-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_abcdefghijklmnopqrstuvwx',
      ];

      expect(anthropicTranslator.apiKeyPattern.test(validApiKey)).toBe(true);

      invalidApiKeys.forEach((key) => {
        expect(anthropicTranslator.apiKeyPattern.test(key)).toBe(false);
      });
    });

    it('should support markdown', () => {
      expect(anthropicTranslator.markdownSupported).toBe(true);
    });
  });

  describe('Language Normalization', () => {
    describe('normalizeLanguage', () => {
      it('should normalize basic language codes', () => {
        expect(normalizeLanguage('en')).toBe('en');
        expect(normalizeLanguage('fr')).toBe('fr');
        expect(normalizeLanguage('de')).toBe('de');
        expect(normalizeLanguage('ja')).toBe('ja');
        expect(normalizeLanguage('zh')).toBe('zh');
      });

      it('should handle locale codes with regions', () => {
        expect(normalizeLanguage('en-US')).toBe('en');
        expect(normalizeLanguage('fr-FR')).toBe('fr');
        expect(normalizeLanguage('zh-CN')).toBe('zh');
        expect(normalizeLanguage('pt-BR')).toBe('pt');
      });

      it('should handle case variations', () => {
        expect(normalizeLanguage('EN')).toBe('en');
        expect(normalizeLanguage('Fr')).toBe('fr');
        expect(normalizeLanguage('ZH-CN')).toBe('zh');
      });

      it('should handle underscore separators', () => {
        expect(normalizeLanguage('en_US')).toBe('en');
        expect(normalizeLanguage('zh_CN')).toBe('zh');
      });

      it('should return undefined for unsupported languages', () => {
        expect(normalizeLanguage('unsupported')).toBeUndefined();
        expect(normalizeLanguage('xyz')).toBeUndefined();
        expect(normalizeLanguage('')).toBeUndefined();
      });
    });

    describe('availability', () => {
      it('should return true for supported language pairs', async () => {
        await expect(availability({ sourceLanguage: 'en', targetLanguage: 'fr' })).resolves.toBe(
          true,
        );
        await expect(
          availability({ sourceLanguage: 'fr-FR', targetLanguage: 'zh-CN' }),
        ).resolves.toBe(true);
        await expect(availability({ sourceLanguage: 'es', targetLanguage: 'ja' })).resolves.toBe(
          true,
        );
      });

      it('should return false for unsupported source languages', async () => {
        await expect(
          availability({ sourceLanguage: 'unsupported', targetLanguage: 'fr' }),
        ).resolves.toBe(false);
      });

      it('should return false for unsupported target languages', async () => {
        await expect(
          availability({ sourceLanguage: 'en', targetLanguage: 'unsupported' }),
        ).resolves.toBe(false);
      });

      it('should return false when both languages are unsupported', async () => {
        await expect(
          availability({ sourceLanguage: 'unsupported1', targetLanguage: 'unsupported2' }),
        ).resolves.toBe(false);
      });
    });
  });

  describe('Translation Function', () => {
    const mockApiKey =
      'sk-ant-api03-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_abcdefghijklmnopqrstuvwx';

    const mockOptions = {
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      apiKey: mockApiKey,
    };

    it('should successfully translate text', async () => {
      const mockResponse = {
        content: [
          {
            text: JSON.stringify({
              translations: ['Bonjour le monde', 'Comment allez-vous ?'],
            }),
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const texts = ['Hello world', 'How are you?'];
      const result = await anthropicTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['Bonjour le monde', 'Comment allez-vous ?']);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': mockApiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          }),
          body: expect.stringContaining('"model":"claude-haiku-4-5"'),
        }),
      );
    });

    it('should include proper system prompt in request', async () => {
      const mockResponse = {
        content: [
          {
            text: JSON.stringify({
              translations: ['Hola mundo'],
            }),
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const texts = ['Hello world'];

      const options = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        apiKey: mockApiKey,
      };

      await anthropicTranslator.translate(texts, options);

      const requestBody = JSON.parse(
        /** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body),
      );

      expect(requestBody.system).toContain('You are a professional translator');
      expect(requestBody.system).toContain('English to Spanish');
      expect(requestBody.system).toContain('Preserve all markdown formatting');
      expect(requestBody.messages[0].content).toContain(JSON.stringify(texts));
    });

    it('should handle markdown content preservation instructions', async () => {
      const mockResponse = {
        content: [
          {
            text: JSON.stringify({
              translations: ['# Bonjour **monde**'],
            }),
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const texts = ['# Hello **world**'];
      const result = await anthropicTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['# Bonjour **monde**']);

      const requestBody = JSON.parse(
        /** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body),
      );

      expect(requestBody.system).toContain('Preserve all markdown formatting');
      expect(requestBody.system).toContain('headers, links, bold, italic, code blocks');
    });

    it('should throw error for unsupported source language', async () => {
      const options = {
        sourceLanguage: 'unsupported',
        targetLanguage: 'fr',
        apiKey: mockApiKey,
      };

      await expect(anthropicTranslator.translate(['test'], options)).rejects.toThrow(
        'Source locale is not supported.',
      );
    });

    it('should throw error for unsupported target language', async () => {
      const options = {
        sourceLanguage: 'en',
        targetLanguage: 'unsupported',
        apiKey: mockApiKey,
      };

      await expect(anthropicTranslator.translate(['test'], options)).rejects.toThrow(
        'Target locale is not supported.',
      );
    });

    it('should handle API error responses', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: 'Invalid API key' },
          }),
          {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      await expect(anthropicTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'Anthropic API error: 401 Unauthorized - Invalid API key',
      );
    });

    it('should handle malformed response structure', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            // Missing content field
          }),
          {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      await expect(anthropicTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'Invalid response format from Anthropic API.',
      );
    });

    it('should handle invalid JSON in response content', async () => {
      const mockResponse = {
        content: [
          {
            text: 'invalid json response',
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(anthropicTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'Failed to parse JSON response from Anthropic API.',
      );
    });

    it('should handle missing translations array in response', async () => {
      const mockResponse = {
        content: [
          {
            text: JSON.stringify({
              // Missing translations field
              other: 'data',
            }),
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(anthropicTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'Invalid JSON structure in Anthropic API response.',
      );
    });

    it('should handle translation count mismatch', async () => {
      const mockResponse = {
        content: [
          {
            text: JSON.stringify({
              translations: ['Only one translation'], // Should have 2
            }),
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const texts = ['First text', 'Second text'];

      await expect(anthropicTranslator.translate(texts, mockOptions)).rejects.toThrow(
        'Translation count mismatch: expected 2, got 1',
      );
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(anthropicTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'Network error',
      );
    });

    it('should handle unknown errors', async () => {
      const mockFetch = vi.mocked(fetch);

      // eslint-disable-next-line prefer-promise-reject-errors
      mockFetch.mockRejectedValueOnce('Unknown error');

      await expect(anthropicTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'Failed to translate text with Anthropic API.',
      );
    });

    it('should use correct model and temperature', async () => {
      const mockResponse = {
        content: [
          {
            text: JSON.stringify({
              translations: ['Test'],
            }),
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await anthropicTranslator.translate(['test'], mockOptions);

      const requestBody = JSON.parse(
        /** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body),
      );

      expect(requestBody.model).toBe('claude-haiku-4-5');
      expect(requestBody.temperature).toBe(0.3);
      expect(requestBody.max_tokens).toBe(4000);
    });
  });
});
