import { beforeEach, describe, expect, it, vi } from 'vitest';

import deepseekTranslator, { availability } from './deepseek.js';

// Mock the i18n functions
vi.mock('$lib/services/contents/i18n', () => ({
  getLocaleLabel: vi.fn((locale, options) => {
    // Normalize locale code (handle both - and _ separators, case variations)
    const normalizedLocale = String(locale || '')
      .toLowerCase()
      .replace(/_/g, '-');

    /** @type {Record<string, string>} */
    const labels = {
      // Base languages
      en: 'English',
      fr: 'French',
      de: 'German',
      es: 'Spanish',
      zh: 'Chinese',
      ja: 'Japanese',
      pt: 'Portuguese',
      // Regional variants
      'en-ca': 'Canadian English',
      'en-us': 'American English',
      'en-gb': 'British English',
      'fr-ca': 'Canadian French',
      'fr-fr': 'French (France)',
      'zh-cn': 'Chinese (China)',
      'zh-tw': 'Chinese (Taiwan)',
      'pt-br': 'Brazilian Portuguese',
      'pt-pt': 'European Portuguese',
      'es-mx': 'Mexican Spanish',
      'es-es': 'Spanish (Spain)',
      'de-de': 'German (Germany)',
      'de-at': 'Austrian German',
    };

    // When displayLocale is 'en', undefined, or not provided, return the English name
    if (!options || !options.displayLocale || options.displayLocale === 'en') {
      return labels[normalizedLocale] || undefined;
    }

    // Otherwise return the label or the locale itself (for other display locales)
    return labels[normalizedLocale] || locale;
  }),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('DeepSeek Translator Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Configuration', () => {
    it('should have correct service metadata', () => {
      expect(deepseekTranslator.serviceId).toBe('deepseek');
      expect(deepseekTranslator.serviceLabel).toBe('DeepSeek');
      expect(deepseekTranslator.apiLabel).toBe('DeepSeek API');
      expect(deepseekTranslator.developerURL).toBe('https://api-docs.deepseek.com/');
      expect(deepseekTranslator.apiKeyURL).toBe('https://platform.deepseek.com/api_keys');
      expect(deepseekTranslator.apiKeyPattern).toBeInstanceOf(RegExp);
    });

    it('should validate API key pattern', () => {
      const validApiKey = 'sk-1234567890abcdefghijklmnopqrstuvwx';

      const invalidApiKeys = [
        'sk-short',
        'invalid-key',
        '',
        'pk-1234567890abcdefghijklmnopqrstuvwx',
        '1234567890abcdefghijklmnopqrstuvwxyz',
      ];

      expect(deepseekTranslator.apiKeyPattern.test(validApiKey)).toBe(true);

      invalidApiKeys.forEach((key) => {
        expect(deepseekTranslator.apiKeyPattern.test(key)).toBe(false);
      });
    });

    it('should support markdown', () => {
      expect(deepseekTranslator.markdownSupported).toBe(true);
    });
  });

  describe('Availability', () => {
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

  describe('Translation Function', () => {
    const mockApiKey = 'sk-1234567890abcdefghijklmnopqrstuvwx';

    const mockOptions = {
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      apiKey: mockApiKey,
    };

    it('should successfully translate text', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(['Bonjour le monde', 'Comment allez-vous ?']),
            },
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
      const result = await deepseekTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['Bonjour le monde', 'Comment allez-vous ?']);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
        }),
      );
    });

    it('should send the correct model in the request body', async () => {
      const mockResponse = {
        choices: [{ message: { content: JSON.stringify(['Bonjour le monde']) } }],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await deepseekTranslator.translate(['Hello world'], mockOptions);

      const requestBody = JSON.parse(
        /** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body),
      );

      expect(requestBody.model).toBe('deepseek-chat');
      expect(requestBody.stream).toBe(false);
    });

    it('should include proper system and user messages in request', async () => {
      const mockResponse = {
        choices: [{ message: { content: JSON.stringify(['Hola mundo']) } }],
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

      await deepseekTranslator.translate(texts, options);

      const requestBody = JSON.parse(
        /** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body),
      );

      expect(requestBody.messages).toHaveLength(2);
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages[0].content).toContain('You are a professional translator');
      expect(requestBody.messages[0].content).toContain('English to Spanish');
      expect(requestBody.messages[0].content).toContain('Preserve all markdown formatting');
      expect(requestBody.messages[1].role).toBe('user');
      expect(requestBody.messages[1].content).toContain(JSON.stringify(texts));
    });

    it('should handle markdown content in translation', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                '# Bonjour **monde**',
                'Voici une [lien](https://example.com)',
              ]),
            },
          },
        ],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const texts = ['# Hello **world**', 'Here is a [link](https://example.com)'];
      const result = await deepseekTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['# Bonjour **monde**', 'Voici une [lien](https://example.com)']);
    });

    it('should throw error for unsupported source locale', async () => {
      const invalidOptions = {
        ...mockOptions,
        sourceLanguage: 'unsupported',
      };

      await expect(deepseekTranslator.translate(['Hello'], invalidOptions)).rejects.toThrow(
        'Source locale is not supported.',
      );
    });

    it('should throw error for unsupported target locale', async () => {
      const invalidOptions = {
        ...mockOptions,
        targetLanguage: 'unsupported',
      };

      await expect(deepseekTranslator.translate(['Hello'], invalidOptions)).rejects.toThrow(
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

      await expect(deepseekTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'DeepSeek API error: 401 Unauthorized - Invalid API key',
      );
    });

    it('should handle API error responses without error message', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(deepseekTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'DeepSeek API error: 500 Internal Server Error',
      );
    });

    it('should handle API errors when error JSON parsing fails', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response('Invalid JSON', {
          status: 503,
          statusText: 'Service Unavailable',
        }),
      );

      await expect(deepseekTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'DeepSeek API error: 503 Service Unavailable',
      );
    });

    it('should handle malformed response structure', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(deepseekTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'Invalid response format from DeepSeek API.',
      );
    });

    it('should handle invalid JSON in response content', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'invalid json response' } }],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(deepseekTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'Failed to parse JSON response from DeepSeek API.',
      );
    });

    it('should handle unknown non-Error exceptions', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockRejectedValueOnce('Unknown error');

      await expect(deepseekTranslator.translate(['test'], mockOptions)).rejects.toThrow(
        'Failed to translate text with DeepSeek API.',
      );
    });
  });
});
