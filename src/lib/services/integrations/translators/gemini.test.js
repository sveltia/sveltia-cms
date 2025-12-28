import { beforeEach, describe, expect, it, vi } from 'vitest';

import geminiTranslator, { availability } from './gemini.js';

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

describe('Gemini Translator Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Configuration', () => {
    it('should have correct service metadata', () => {
      expect(geminiTranslator.serviceId).toBe('gemini');
      expect(geminiTranslator.serviceLabel).toBe('Google Gemini');
      expect(geminiTranslator.apiLabel).toBe('Google AI Studio API');
      expect(geminiTranslator.developerURL).toBe('https://ai.google.dev/gemini-api/docs');
      expect(geminiTranslator.apiKeyURL).toBe('https://aistudio.google.com/api-keys');
      expect(geminiTranslator.apiKeyPattern).toBeInstanceOf(RegExp);
    });

    it('should validate API key pattern', () => {
      const validApiKey = 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567';

      const invalidApiKeys = [
        'AIza-invalid',
        'invalid-key',
        '',
        'AIzaShort',
        'BIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
      ];

      expect(geminiTranslator.apiKeyPattern.test(validApiKey)).toBe(true);

      invalidApiKeys.forEach((key) => {
        expect(geminiTranslator.apiKeyPattern.test(key)).toBe(false);
      });
    });

    it('should support markdown', () => {
      expect(geminiTranslator.markdownSupported).toBe(true);
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

    it('should return false when source language is unsupported', async () => {
      await expect(availability({ sourceLanguage: 'xx-YY', targetLanguage: 'en' })).resolves.toBe(
        false,
      );
    });

    it('should return false when target language is unsupported', async () => {
      await expect(availability({ sourceLanguage: 'en', targetLanguage: 'xx-YY' })).resolves.toBe(
        false,
      );
    });

    it('should return false when both languages are unsupported', async () => {
      await expect(
        availability({ sourceLanguage: 'xx-YY', targetLanguage: 'yy-XX' }),
      ).resolves.toBe(false);
    });
  });

  describe('Translation', () => {
    it('should successfully translate single text', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '["Bonjour le monde"]',
                },
              ],
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

      const result = await geminiTranslator.translate(['Hello world'], {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
      });

      expect(result).toEqual(['Bonjour le monde']);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-2.5-flash-lite:generateContent'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should successfully translate multiple texts', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '["Bonjour", "Comment allez-vous?", "Au revoir"]',
                },
              ],
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

      const result = await geminiTranslator.translate(['Hello', 'How are you?', 'Goodbye'], {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
      });

      expect(result).toEqual(['Bonjour', 'Comment allez-vous?', 'Au revoir']);
    });

    it('should preserve markdown formatting', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '["# Titre\\n\\nTexte avec **gras** et *italique*."]',
                },
              ],
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

      const result = await geminiTranslator.translate(
        ['# Title\n\nText with **bold** and *italic*.'],
        {
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
        },
      );

      expect(result).toEqual(['# Titre\n\nTexte avec **gras** et *italique*.']);
    });

    it('should handle regional language variants', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '["Olá"]',
                },
              ],
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

      const result = await geminiTranslator.translate(['Hello'], {
        sourceLanguage: 'en-US',
        targetLanguage: 'pt-BR',
        apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
      });

      expect(result).toEqual(['Olá']);
    });

    it('should throw error when source locale is unsupported', async () => {
      await expect(
        geminiTranslator.translate(['Hello'], {
          sourceLanguage: 'xx-YY',
          targetLanguage: 'fr',
          apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
        }),
      ).rejects.toThrow('Source locale is not supported.');
    });

    it('should throw error when target locale is unsupported', async () => {
      await expect(
        geminiTranslator.translate(['Hello'], {
          sourceLanguage: 'en',
          targetLanguage: 'xx-YY',
          apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
        }),
      ).rejects.toThrow('Target locale is not supported.');
    });

    it('should throw error when API returns non-OK status', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
          status: 401,
          statusText: 'Unauthorized',
        }),
      );

      await expect(
        geminiTranslator.translate(['Hello'], {
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          apiKey: 'invalid-key',
        }),
      ).rejects.toThrow('Gemini API error: 401 Unauthorized - Invalid API key');
    });

    it('should throw error when response format is invalid', async () => {
      const mockResponse = {
        candidates: [],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      await expect(
        geminiTranslator.translate(['Hello'], {
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
        }),
      ).rejects.toThrow('Invalid response format from Gemini API.');
    });

    it('should throw error when JSON parsing fails', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Invalid JSON response',
                },
              ],
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
        geminiTranslator.translate(['Hello'], {
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
        }),
      ).rejects.toThrow('Failed to parse JSON response from Gemini API.');
    });

    it('should throw error when response is not an array', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"translation": "Bonjour"}',
                },
              ],
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
        geminiTranslator.translate(['Hello'], {
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
        }),
      ).rejects.toThrow('Invalid JSON structure in Gemini API response.');
    });

    it('should throw error when translation count mismatches', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '["Bonjour", "Au revoir"]',
                },
              ],
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
        geminiTranslator.translate(['Hello', 'How are you?', 'Goodbye'], {
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
        }),
      ).rejects.toThrow('Translation count mismatch: expected 3, got 2');
    });

    it('should handle fetch errors gracefully', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        geminiTranslator.translate(['Hello'], {
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
        }),
      ).rejects.toThrow('Network error');
    });

    it('should make API request with correct payload structure', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '["Bonjour"]',
                },
              ],
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

      await geminiTranslator.translate(['Hello'], {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
      });

      const requestBody = JSON.parse(/** @type {string} */ (mockFetch.mock.calls[0][1]?.body));

      expect(requestBody).toMatchObject({
        system_instruction: {
          parts: expect.any(Array),
        },
        contents: expect.any(Array),
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json',
        },
      });
    });
  });
});
