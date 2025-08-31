import { beforeEach, describe, expect, it, vi } from 'vitest';

import anthropicTranslator, { normalizeLanguage } from './anthropic.js';

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
      expect(anthropicTranslator.developerURL).toBe('https://docs.anthropic.com/en/api/overview');
      expect(anthropicTranslator.apiKeyURL).toBe('https://console.anthropic.com/settings/keys');
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

    describe('getSourceLanguage', () => {
      it('should return normalized language codes', () => {
        expect(anthropicTranslator.getSourceLanguage('en')).toBe('en');
        expect(anthropicTranslator.getSourceLanguage('fr-FR')).toBe('fr');
        expect(anthropicTranslator.getSourceLanguage('zh-CN')).toBe('zh');
      });

      it('should return undefined for unsupported languages', () => {
        expect(anthropicTranslator.getSourceLanguage('unsupported')).toBeUndefined();
      });
    });

    describe('getTargetLanguage', () => {
      it('should return normalized language codes', () => {
        expect(anthropicTranslator.getTargetLanguage('en')).toBe('en');
        expect(anthropicTranslator.getTargetLanguage('fr-FR')).toBe('fr');
        expect(anthropicTranslator.getTargetLanguage('zh-CN')).toBe('zh');
      });

      it('should return undefined for unsupported languages', () => {
        expect(anthropicTranslator.getTargetLanguage('unsupported')).toBeUndefined();
      });
    });
  });

  describe('Translation Function', () => {
    const mockApiKey =
      'sk-ant-api03-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_abcdefghijklmnopqrstuvwx';

    const mockOptions = {
      sourceLocale: 'en',
      targetLocale: 'fr',
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
          body: expect.stringContaining('"model":"claude-3-5-haiku-latest"'),
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
        sourceLocale: 'en',
        targetLocale: 'es',
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
        sourceLocale: 'unsupported',
        targetLocale: 'fr',
        apiKey: mockApiKey,
      };

      await expect(anthropicTranslator.translate(['test'], options)).rejects.toThrow(
        'Source locale is not supported.',
      );
    });

    it('should throw error for unsupported target language', async () => {
      const options = {
        sourceLocale: 'en',
        targetLocale: 'unsupported',
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

      expect(requestBody.model).toBe('claude-3-5-haiku-latest');
      expect(requestBody.temperature).toBe(0.3);
      expect(requestBody.max_tokens).toBe(4000);
    });
  });
});
