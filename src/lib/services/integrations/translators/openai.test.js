import { beforeEach, describe, expect, it, vi } from 'vitest';

import openaiTranslator, { normalizeLanguage } from './openai.js';

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

      it('should return undefined for unsupported languages', () => {
        expect(normalizeLanguage('unsupported')).toBeUndefined();
        expect(normalizeLanguage('xyz')).toBeUndefined();
        expect(normalizeLanguage('')).toBeUndefined();
      });
    });

    describe('getSourceLanguage', () => {
      it('should return normalized language codes', () => {
        expect(openaiTranslator.getSourceLanguage('en')).toBe('en');
        expect(openaiTranslator.getSourceLanguage('fr-FR')).toBe('fr');
        expect(openaiTranslator.getSourceLanguage('zh-CN')).toBe('zh');
      });

      it('should return undefined for unsupported languages', () => {
        expect(openaiTranslator.getSourceLanguage('unsupported')).toBeUndefined();
      });
    });

    describe('getTargetLanguage', () => {
      it('should return normalized language codes', () => {
        expect(openaiTranslator.getTargetLanguage('en')).toBe('en');
        expect(openaiTranslator.getTargetLanguage('fr-FR')).toBe('fr');
        expect(openaiTranslator.getTargetLanguage('zh-CN')).toBe('zh');
      });

      it('should return undefined for unsupported languages', () => {
        expect(openaiTranslator.getTargetLanguage('unsupported')).toBeUndefined();
      });
    });
  });

  describe('Translation Function', () => {
    const mockApiKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyzABCDEF';

    const mockOptions = {
      sourceLocale: 'en',
      targetLocale: 'fr',
      apiKey: mockApiKey,
    };

    it('should successfully translate text', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: ['Bonjour le monde', 'Comment allez-vous ?'],
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
          body: expect.stringContaining('"response_format":{"type":"json_object"}'),
        }),
      );
    });

    it('should handle markdown content in translation', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: ['# Bonjour **monde**', 'Voici une [lien](https://example.com)'],
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

      const texts = ['# Hello **world**', 'Here is a [link](https://example.com)'];
      const result = await openaiTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['# Bonjour **monde**', 'Voici une [lien](https://example.com)']);
    });

    it('should throw error for unsupported source locale', async () => {
      const invalidOptions = {
        ...mockOptions,
        sourceLocale: 'unsupported',
      };

      await expect(openaiTranslator.translate(['Hello'], invalidOptions)).rejects.toThrow(
        'Source locale is not supported.',
      );
    });

    it('should throw error for unsupported target locale', async () => {
      const invalidOptions = {
        ...mockOptions,
        targetLocale: 'unsupported',
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
              content: JSON.stringify({
                translations: [],
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

      const result = await openaiTranslator.translate([], mockOptions);

      expect(result).toEqual([]);
    });

    it('should handle single text translation', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: ['Bonjour'],
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

      const result = await openaiTranslator.translate(['Hello'], mockOptions);

      expect(result).toEqual(['Bonjour']);
    });

    it('should handle multiline text translation', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: ['Bonjour\nComment allez-vous ?\nBonne journée !'],
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

      const multilineText = 'Hello\nHow are you?\nHave a great day!';
      const result = await openaiTranslator.translate([multilineText], mockOptions);

      expect(result).toEqual(['Bonjour\nComment allez-vous ?\nBonne journée !']);
    });

    it('should handle translation count mismatch', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: ['Bonjour'], // Only one translation for two inputs
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
      expect(openaiTranslator).toHaveProperty('getSourceLanguage');
      expect(openaiTranslator).toHaveProperty('getTargetLanguage');
      expect(openaiTranslator).toHaveProperty('translate');
    });

    it('should have correct markdown support flag', () => {
      expect(openaiTranslator.markdownSupported).toBe(true);
    });

    it('should have function properties that are callable', () => {
      expect(typeof openaiTranslator.getSourceLanguage).toBe('function');
      expect(typeof openaiTranslator.getTargetLanguage).toBe('function');
      expect(typeof openaiTranslator.translate).toBe('function');
    });
  });

  describe('OpenAI Specific Features', () => {
    const mockApiKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyzABCDEF';

    const mockOptions = {
      sourceLocale: 'en',
      targetLocale: 'fr',
      apiKey: mockApiKey,
    };

    it('should include markdown preservation instructions in prompt', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: ['Test'],
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

      await openaiTranslator.translate(['Test'], mockOptions);

      const requestBody = JSON.parse(
        /** @type {string} */ (vi.mocked(fetch).mock.calls[0][1]?.body),
      );

      expect(requestBody.messages[0].content).toContain('markdown formatting');
      expect(requestBody.messages[0].content).toContain('HTML tags');
      expect(requestBody.messages[0].content).toContain('JSON object');
      expect(requestBody.model).toBe('gpt-4o-mini');
      expect(requestBody.temperature).toBe(0.3);
      expect(requestBody.response_format).toEqual({ type: 'json_object' });
    });

    it('should use proper authentication header', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: ['Test'],
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

      await openaiTranslator.translate(['Test'], mockOptions);

      const headers = vi.mocked(fetch).mock.calls[0][1]?.headers;

      expect(headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mockApiKey}`,
      });
    });
  });

  describe('Exported Helper Functions', () => {
    describe('normalizeLanguage edge cases', () => {
      it('should handle various separators', () => {
        expect(normalizeLanguage('zh-CN')).toBe('zh');
        expect(normalizeLanguage('zh_CN')).toBe('zh');
        expect(normalizeLanguage('pt-BR')).toBe('pt');
      });

      it('should be case insensitive', () => {
        expect(normalizeLanguage('EN')).toBe('en');
        expect(normalizeLanguage('Fr')).toBe('fr');
        expect(normalizeLanguage('DE')).toBe('de');
      });

      it('should handle edge cases', () => {
        expect(normalizeLanguage('a')).toBeUndefined();
        expect(normalizeLanguage('123')).toBeUndefined();
        expect(normalizeLanguage('en-US-x-custom')).toBe('en');
      });
    });
  });
});
