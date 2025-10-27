import { beforeEach, describe, expect, it, vi } from 'vitest';

import openaiTranslator, { availability } from './openai.js';

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

describe('OpenAI Translator Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Configuration', () => {
    it('should have correct service metadata', () => {
      expect(openaiTranslator.serviceId).toBe('openai');
      expect(openaiTranslator.serviceLabel).toBe('OpenAI GPT');
      expect(openaiTranslator.apiLabel).toBe('OpenAI API');
      expect(openaiTranslator.developerURL).toBe('https://platform.openai.com/docs/overview');
      expect(openaiTranslator.apiKeyURL).toBe('https://platform.openai.com/api-keys');
      expect(openaiTranslator.apiKeyPattern).toBeInstanceOf(RegExp);
    });

    it('should validate API key pattern', () => {
      const validApiKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyzABCDEF';

      const invalidApiKeys = [
        'sk-invalid',
        'invalid-key',
        '',
        'sk-1234567890',
        'ak-1234567890abcdefghijklmnopqrstuvwxyzABCDEF',
      ];

      expect(openaiTranslator.apiKeyPattern.test(validApiKey)).toBe(true);

      invalidApiKeys.forEach((key) => {
        expect(openaiTranslator.apiKeyPattern.test(key)).toBe(false);
      });
    });

    it('should support markdown', () => {
      expect(openaiTranslator.markdownSupported).toBe(true);
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
    const mockApiKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyzABCDEF';

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
      const result = await openaiTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['Bonjour le monde', 'Comment allez-vous ?']);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
        }),
      );
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
      const result = await openaiTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['# Bonjour **monde**', 'Voici une [lien](https://example.com)']);
    });

    it('should throw error for unsupported source locale', async () => {
      const invalidOptions = {
        ...mockOptions,
        sourceLanguage: 'unsupported',
      };

      await expect(openaiTranslator.translate(['Hello'], invalidOptions)).rejects.toThrow(
        'Source locale is not supported.',
      );
    });

    it('should throw error for unsupported target locale', async () => {
      const invalidOptions = {
        ...mockOptions,
        targetLanguage: 'unsupported',
      };

      await expect(openaiTranslator.translate(['Hello'], invalidOptions)).rejects.toThrow(
        'Target locale is not supported.',
      );
    });

    it('should handle API errors with error message', async () => {
      const errorResponse = {
        error: {
          message: 'Invalid API key',
        },
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(errorResponse), {
          status: 401,
          statusText: 'Unauthorized',
        }),
      );

      await expect(openaiTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'OpenAI API error: 401 Unauthorized - Invalid API key',
      );
    });

    it('should handle API errors without error message', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response('{}', {
          status: 429,
          statusText: 'Too Many Requests',
        }),
      );

      await expect(openaiTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'OpenAI API error: 429 Too Many Requests',
      );
    });

    it('should handle API errors when error JSON parsing fails', async () => {
      const mockFetch = vi.mocked(fetch);

      // Create a Response that fails to parse as JSON
      const mockResponse = new Response('Invalid JSON', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(openaiTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'OpenAI API error: 500 Internal Server Error',
      );
    });

    it('should handle invalid response format', async () => {
      const mockResponse = {
        choices: [],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      await expect(openaiTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Invalid response format from OpenAI API.',
      );
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(openaiTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Network error',
      );
    });

    it('should handle unknown errors', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockRejectedValueOnce('Unknown error');

      await expect(openaiTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Failed to translate text with OpenAI API.',
      );
    });

    it('should handle empty text array', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
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

      const result = await openaiTranslator.translate([], mockOptions);

      expect(result).toEqual([]);
    });

    it('should handle single text translation', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(['Bonjour']),
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

      const result = await openaiTranslator.translate(['Hello'], mockOptions);

      expect(result).toEqual(['Bonjour']);
    });

    it('should handle multiline text translation', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(['Bonjour\nComment allez-vous ?\nBonne journée !']),
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

      const multilineText = 'Hello\nHow are you?\nHave a great day!';
      const result = await openaiTranslator.translate([multilineText], mockOptions);

      expect(result).toEqual(['Bonjour\nComment allez-vous ?\nBonne journée !']);
    });

    it('should handle translation count mismatch', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(['Bonjour']), // Only one translation for two inputs
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

      await expect(
        openaiTranslator.translate(['Hello', 'How are you'], mockOptions),
      ).rejects.toThrow('Translation count mismatch');
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'This is not valid JSON',
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

      await expect(openaiTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Failed to parse JSON response from OpenAI API.',
      );
    });

    it('should handle invalid JSON structure', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                invalidStructure: ['Bonjour'],
              }),
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

      await expect(openaiTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Invalid JSON structure in OpenAI API response.',
      );
    });
  });

  describe('Service Integration', () => {
    it('should export all required properties for TranslationService interface', () => {
      expect(openaiTranslator).toHaveProperty('serviceId');
      expect(openaiTranslator).toHaveProperty('serviceLabel');
      expect(openaiTranslator).toHaveProperty('apiLabel');
      expect(openaiTranslator).toHaveProperty('developerURL');
      expect(openaiTranslator).toHaveProperty('apiKeyURL');
      expect(openaiTranslator).toHaveProperty('apiKeyPattern');
      expect(openaiTranslator).toHaveProperty('markdownSupported');
      expect(openaiTranslator).toHaveProperty('availability');
      expect(openaiTranslator).toHaveProperty('translate');
    });

    it('should have correct markdown support flag', () => {
      expect(openaiTranslator.markdownSupported).toBe(true);
    });

    it('should have function properties that are callable', () => {
      expect(typeof availability).toBe('function');
      expect(typeof openaiTranslator.translate).toBe('function');
    });
  });

  describe('OpenAI Specific Features', () => {
    const mockApiKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyzABCDEF';

    const mockOptions = {
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      apiKey: mockApiKey,
    };

    it('should include markdown preservation instructions in prompt', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(['Test']),
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

      await openaiTranslator.translate(['Test'], mockOptions);

      const requestBody = JSON.parse(
        /** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body),
      );

      expect(requestBody.messages[0].content).toContain('markdown formatting');
      expect(requestBody.messages[0].content).toContain('HTML tags');
      expect(requestBody.messages[0].content).toContain('JSON array');
      expect(requestBody.model).toBe('gpt-4o-mini');
      expect(requestBody.temperature).toBe(0.3);
    });

    it('should use proper authentication header', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(['Test']),
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

      await openaiTranslator.translate(['Test'], mockOptions);

      const headers = vi.mocked(fetch).mock.calls[0][1]?.headers;

      expect(headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mockApiKey}`,
      });
    });
  });
});
