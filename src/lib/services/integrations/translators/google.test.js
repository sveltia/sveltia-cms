import { beforeEach, describe, expect, it, vi } from 'vitest';

import googleTranslator, { normalizeLanguage } from './google.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Google Translator Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Configuration', () => {
    it('should have correct service metadata', () => {
      expect(googleTranslator.serviceId).toBe('google');
      expect(googleTranslator.serviceLabel).toBe('Google Cloud Translation');
      expect(googleTranslator.apiLabel).toBe('Cloud Translation API');
      expect(googleTranslator.developerURL).toBe(
        'https://console.cloud.google.com/apis/library/translate.googleapis.com',
      );
      expect(googleTranslator.apiKeyURL).toBe(
        'https://console.cloud.google.com/apis/api/translate.googleapis.com/credentials',
      );
      expect(googleTranslator.apiKeyPattern).toBeInstanceOf(RegExp);
    });

    it('should validate API key pattern', () => {
      const validApiKey = 'AIzaSyB12345678901234567890123456789012';

      const invalidApiKeys = [
        'invalid-key',
        'AIza123', // too short
        'BIzaSyB12345678901234567890123456789012', // wrong prefix
        '',
      ];

      expect(googleTranslator.apiKeyPattern.test(validApiKey)).toBe(true);

      invalidApiKeys.forEach((key) => {
        expect(googleTranslator.apiKeyPattern.test(key)).toBe(false);
      });
    });
  });

  describe('Language Support', () => {
    describe('getSourceLanguage', () => {
      it('should normalize valid locale codes', () => {
        expect(googleTranslator.getSourceLanguage('en')).toBe('en');
        expect(googleTranslator.getSourceLanguage('fr')).toBe('fr');
        expect(googleTranslator.getSourceLanguage('zh-CN')).toBe('zh-CN');
        expect(googleTranslator.getSourceLanguage('pt-BR')).toBe('pt-BR');
      });

      it('should handle locale code variations', () => {
        expect(googleTranslator.getSourceLanguage('fr-fr')).toBe('fr-FR');
        expect(googleTranslator.getSourceLanguage('zh_CN')).toBe('zh-CN');
        expect(googleTranslator.getSourceLanguage('zh_TW')).toBe('zh-TW');
      });

      it('should fallback to language code when region is not supported', () => {
        expect(googleTranslator.getSourceLanguage('en-XX')).toBe('en');
        expect(googleTranslator.getSourceLanguage('fr-XX')).toBe('fr');
      });

      it('should return undefined for unsupported languages', () => {
        expect(googleTranslator.getSourceLanguage('unsupported')).toBeUndefined();
        expect(googleTranslator.getSourceLanguage('xyz')).toBeUndefined();
        expect(googleTranslator.getSourceLanguage('')).toBeUndefined();
      });
    });

    describe('getTargetLanguage', () => {
      it('should normalize valid locale codes', () => {
        expect(googleTranslator.getTargetLanguage('en')).toBe('en');
        expect(googleTranslator.getTargetLanguage('ja')).toBe('ja');
        expect(googleTranslator.getTargetLanguage('zh-TW')).toBe('zh-TW');
      });

      it('should handle locale code variations', () => {
        expect(googleTranslator.getTargetLanguage('zh-cn')).toBe('zh-CN');
        expect(googleTranslator.getTargetLanguage('pt_br')).toBe('pt-BR');
      });

      it('should return undefined for unsupported languages', () => {
        expect(googleTranslator.getTargetLanguage('unsupported')).toBeUndefined();
        expect(googleTranslator.getTargetLanguage('')).toBeUndefined();
      });
    });
  });

  describe('Translation Function', () => {
    const mockApiKey = 'AIzaSyB12345678901234567890123456789012';

    const mockOptions = {
      sourceLocale: 'en',
      targetLocale: 'fr',
      apiKey: mockApiKey,
    };

    it('should successfully translate text', async () => {
      const mockResponse = {
        data: {
          translations: [
            { translatedText: 'Bonjour le monde' },
            { translatedText: 'Comment allez-vous ?' },
          ],
        },
      };

      const mockFetch = vi.mocked(fetch);

      // Use a more complete mock response object
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const texts = ['Hello world', 'How are you?'];
      const result = await googleTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['Bonjour le monde', 'Comment allez-vous ?']);
      expect(fetch).toHaveBeenCalledWith(
        'https://translation.googleapis.com/language/translate/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': mockApiKey,
          },
          body: JSON.stringify({
            q: texts,
            source: 'en',
            target: 'fr',
            format: 'html',
          }),
        },
      );
    });

    it('should handle HTML content in translation', async () => {
      const mockResponse = {
        data: {
          translations: [{ translatedText: '<p>Bonjour <strong>le monde</strong></p>' }],
        },
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const texts = ['<p>Hello <strong>world</strong></p>'];
      const result = await googleTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['<p>Bonjour <strong>le monde</strong></p>']);
    });

    it('should throw error for unsupported source locale', async () => {
      const invalidOptions = {
        ...mockOptions,
        sourceLocale: 'unsupported',
      };

      await expect(googleTranslator.translate(['Hello'], invalidOptions)).rejects.toThrow(
        'Source locale is not supported.',
      );
    });

    it('should throw error for unsupported target locale', async () => {
      const invalidOptions = {
        ...mockOptions,
        targetLocale: 'unsupported',
      };

      await expect(googleTranslator.translate(['Hello'], invalidOptions)).rejects.toThrow(
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
          status: 400,
          statusText: 'Bad Request',
        }),
      );

      await expect(googleTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Google Translate API error: 400 Bad Request - Invalid API key',
      );
    });

    it('should handle API errors without error message', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response('{}', {
          status: 403,
          statusText: 'Forbidden',
        }),
      );

      await expect(googleTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Google Translate API error: 403 Forbidden',
      );
    });

    it('should handle JSON parsing errors', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response('invalid json', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

      await expect(googleTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Google Translate API error: 500 Internal Server Error',
      );
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(googleTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Network error',
      );
    });

    it('should handle unknown errors', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockRejectedValueOnce('Unknown error');

      await expect(googleTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Failed to translate text with Google Translate API.',
      );
    });

    it('should handle empty text array', async () => {
      const mockResponse = {
        data: {
          translations: [],
        },
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const result = await googleTranslator.translate([], mockOptions);

      expect(result).toEqual([]);
    });

    it('should handle special locale cases', async () => {
      const mockResponse = {
        data: {
          translations: [{ translatedText: '你好世界' }],
        },
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const specialOptions = {
        sourceLocale: 'en',
        targetLocale: 'zh-CN',
        apiKey: mockApiKey,
      };

      const result = await googleTranslator.translate(['Hello world'], specialOptions);

      expect(result).toEqual(['你好世界']);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            q: ['Hello world'],
            source: 'en',
            target: 'zh-CN',
            format: 'html',
          }),
        }),
      );
    });
  });

  describe('Service Integration', () => {
    it('should export all required properties for TranslationService interface', () => {
      expect(googleTranslator).toHaveProperty('serviceId');
      expect(googleTranslator).toHaveProperty('serviceLabel');
      expect(googleTranslator).toHaveProperty('apiLabel');
      expect(googleTranslator).toHaveProperty('developerURL');
      expect(googleTranslator).toHaveProperty('apiKeyURL');
      expect(googleTranslator).toHaveProperty('apiKeyPattern');
      expect(googleTranslator).toHaveProperty('markdownSupported');
      expect(googleTranslator).toHaveProperty('getSourceLanguage');
      expect(googleTranslator).toHaveProperty('getTargetLanguage');
      expect(googleTranslator).toHaveProperty('translate');
    });

    it('should have correct markdown support flag', () => {
      expect(googleTranslator.markdownSupported).toBe(false);
    });

    it('should have function properties that are callable', () => {
      expect(typeof googleTranslator.getSourceLanguage).toBe('function');
      expect(typeof googleTranslator.getTargetLanguage).toBe('function');
      expect(typeof googleTranslator.translate).toBe('function');
    });
  });

  describe('Exported Helper Functions', () => {
    describe('normalizeLanguage', () => {
      it('should normalize locale codes correctly', () => {
        expect(normalizeLanguage('en')).toBe('en');
        expect(normalizeLanguage('fr')).toBe('fr');
        expect(normalizeLanguage('zh-CN')).toBe('zh-CN');
        expect(normalizeLanguage('pt-BR')).toBe('pt-BR');
      });

      it('should handle case variations', () => {
        expect(normalizeLanguage('fr-fr')).toBe('fr-FR');
        expect(normalizeLanguage('zh-cn')).toBe('zh-CN');
        expect(normalizeLanguage('zh_TW')).toBe('zh-TW');
        expect(normalizeLanguage('Pt-Br')).toBe('pt-BR');
      });

      it('should handle underscore separators', () => {
        expect(normalizeLanguage('zh_CN')).toBe('zh-CN');
        expect(normalizeLanguage('zh_TW')).toBe('zh-TW');
        expect(normalizeLanguage('pt_BR')).toBe('pt-BR');
      });

      it('should fallback to language code when region is not supported', () => {
        expect(normalizeLanguage('en-XX')).toBe('en');
        expect(normalizeLanguage('fr-YY')).toBe('fr');
        expect(normalizeLanguage('de-ZZ')).toBe('de');
      });

      it('should return undefined for completely unsupported languages', () => {
        expect(normalizeLanguage('unsupported')).toBeUndefined();
        expect(normalizeLanguage('xyz')).toBeUndefined();
        expect(normalizeLanguage('')).toBeUndefined();
        expect(normalizeLanguage('invalid-format-code')).toBeUndefined();
      });

      it('should handle edge cases', () => {
        expect(normalizeLanguage('a')).toBeUndefined(); // too short
        expect(normalizeLanguage('abcd')).toBeUndefined(); // too long without region
        expect(normalizeLanguage('zh-')).toBe('zh'); // falls back to base language
        expect(normalizeLanguage('-CN')).toBeUndefined(); // incomplete
      });
    });
  });
});
