import { beforeEach, describe, expect, it, vi } from 'vitest';

import deeplTranslator, { availability, getSourceLanguage, getTargetLanguage } from './deepl.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('DeepL Translator Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Configuration', () => {
    it('should have correct service metadata', () => {
      expect(deeplTranslator.serviceId).toBe('deepl');
      expect(deeplTranslator.serviceLabel).toBe('DeepL');
      expect(deeplTranslator.apiLabel).toBe('DeepL API');
      expect(deeplTranslator.developerURL).toBe('https://www.deepl.com/pro-api');
      expect(deeplTranslator.apiKeyURL).toBe('https://www.deepl.com/account/summary');
      expect(deeplTranslator.apiKeyPattern).toBeInstanceOf(RegExp);
    });

    it('should validate API key pattern', () => {
      const validApiKeys = [
        '12345678-1234-1234-1234-123456789012',
        '12345678-1234-1234-1234-123456789012:fx',
        'abcdef12-3456-7890-abcd-ef1234567890',
      ];

      const invalidApiKeys = [
        'invalid-key',
        '123-456-789', // wrong format
        '12345678-1234-1234-1234-12345678901', // too short
        '',
      ];

      validApiKeys.forEach((key) => {
        expect(deeplTranslator.apiKeyPattern.test(key)).toBe(true);
      });

      invalidApiKeys.forEach((key) => {
        expect(deeplTranslator.apiKeyPattern.test(key)).toBe(false);
      });
    });
  });

  describe('Language Support', () => {
    describe('getSourceLanguage', () => {
      it('should return valid source languages', () => {
        expect(getSourceLanguage('en')).toBe('EN');
        expect(getSourceLanguage('fr')).toBe('FR');
        expect(getSourceLanguage('de')).toBe('DE');
        expect(getSourceLanguage('ja')).toBe('JA');
        expect(getSourceLanguage('zh')).toBe('ZH');
      });

      it('should handle case variations', () => {
        expect(getSourceLanguage('EN')).toBe('EN');
        expect(getSourceLanguage('En')).toBe('EN');
        expect(getSourceLanguage('eN')).toBe('EN');
      });

      it('should handle locale codes with regions', () => {
        expect(getSourceLanguage('en-US')).toBe('EN');
        expect(getSourceLanguage('fr-FR')).toBe('FR');
        expect(getSourceLanguage('de-DE')).toBe('DE');
      });

      it('should return undefined for unsupported languages', () => {
        expect(getSourceLanguage('unsupported')).toBeUndefined();
        expect(getSourceLanguage('xyz')).toBeUndefined();
        expect(getSourceLanguage('')).toBeUndefined();
        expect(getSourceLanguage('hi')).toBeUndefined(); // Hindi not supported by DeepL
      });
    });

    describe('getTargetLanguage', () => {
      it('should return valid target languages', () => {
        expect(getTargetLanguage('en')).toBe('EN');
        expect(getTargetLanguage('fr')).toBe('FR');
        expect(getTargetLanguage('de')).toBe('DE');
        expect(getTargetLanguage('ja')).toBe('JA');
      });

      it('should handle English variants', () => {
        expect(getTargetLanguage('en-GB')).toBe('EN-GB');
        expect(getTargetLanguage('en-US')).toBe('EN-US');
      });

      it('should handle Portuguese variants', () => {
        expect(getTargetLanguage('pt-BR')).toBe('PT-BR');
        expect(getTargetLanguage('pt-PT')).toBe('PT-PT');
        expect(getTargetLanguage('pt')).toBe('PT');
      });

      it('should handle Chinese variants', () => {
        expect(getTargetLanguage('zh-CN')).toBe('ZH-HANS');
        expect(getTargetLanguage('zh-SG')).toBe('ZH-HANS');
        expect(getTargetLanguage('zh-TW')).toBe('ZH-HANT');
        expect(getTargetLanguage('zh-HK')).toBe('ZH-HANT');
        expect(getTargetLanguage('zh-MO')).toBe('ZH-HANT');
        expect(getTargetLanguage('zh')).toBe('ZH');
      });

      it('should return undefined for unsupported languages', () => {
        expect(getTargetLanguage('unsupported')).toBeUndefined();
        expect(getTargetLanguage('xyz')).toBeUndefined();
        expect(getTargetLanguage('')).toBeUndefined();
        expect(getTargetLanguage('hi')).toBeUndefined(); // Hindi not supported by DeepL
      });
    });

    describe('availability', () => {
      it('should return true for supported language pairs', async () => {
        await expect(availability({ sourceLanguage: 'en', targetLanguage: 'fr' })).resolves.toBe(
          true,
        );
        await expect(availability({ sourceLanguage: 'de', targetLanguage: 'en-US' })).resolves.toBe(
          true,
        );
        await expect(availability({ sourceLanguage: 'zh', targetLanguage: 'pt-BR' })).resolves.toBe(
          true,
        );
      });

      it('should return false for unsupported source languages', async () => {
        await expect(availability({ sourceLanguage: 'hi', targetLanguage: 'en' })).resolves.toBe(
          false,
        ); // Hindi not supported
        await expect(
          availability({ sourceLanguage: 'unsupported', targetLanguage: 'fr' }),
        ).resolves.toBe(false);
      });

      it('should return false for unsupported target languages', async () => {
        await expect(availability({ sourceLanguage: 'en', targetLanguage: 'hi' })).resolves.toBe(
          false,
        ); // Hindi not supported
        await expect(
          availability({ sourceLanguage: 'en', targetLanguage: 'unsupported' }),
        ).resolves.toBe(false);
      });

      it('should return false when both languages are unsupported', async () => {
        await expect(
          availability({ sourceLanguage: 'unsupported1', targetLanguage: 'unsupported2' }),
        ).resolves.toBe(false);
      });

      it('should handle locale codes with regions', async () => {
        await expect(
          availability({ sourceLanguage: 'en-US', targetLanguage: 'fr-FR' }),
        ).resolves.toBe(true);
        await expect(
          availability({ sourceLanguage: 'zh-CN', targetLanguage: 'en-GB' }),
        ).resolves.toBe(true);
      });
    });
  });

  describe('Translation Function', () => {
    const mockApiKey = '12345678-1234-1234-1234-123456789012';
    const mockFreeApiKey = '12345678-1234-1234-1234-123456789012:fx';

    const mockOptions = {
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      apiKey: mockApiKey,
    };

    it('should successfully translate text with paid API', async () => {
      const mockResponse = {
        translations: [{ text: 'Bonjour le monde' }, { text: 'Comment allez-vous ?' }],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const texts = ['Hello world', 'How are you?'];
      const result = await deeplTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['Bonjour le monde', 'Comment allez-vous ?']);

      // Verify the correct API endpoint was called for paid API
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('api.deepl.com'));

      // Verify the URL parameters
      const calledUrl = vi.mocked(fetch).mock.calls[0][0];
      const url = new URL(String(calledUrl));

      expect(url.searchParams.get('source_lang')).toBe('EN');
      expect(url.searchParams.get('target_lang')).toBe('FR');
      expect(url.searchParams.get('auth_key')).toBe(mockApiKey);
      expect(url.searchParams.get('tag_handling')).toBe('html');
      expect(url.searchParams.get('split_sentences')).toBe('1');
      expect(url.searchParams.getAll('text')).toEqual(texts);
    });

    it('should successfully translate text with free API', async () => {
      const mockResponse = {
        translations: [{ text: 'Bonjour le monde' }],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const freeOptions = {
        ...mockOptions,
        apiKey: mockFreeApiKey,
      };

      const texts = ['Hello world'];
      const result = await deeplTranslator.translate(texts, freeOptions);

      expect(result).toEqual(['Bonjour le monde']);

      // Verify the correct API endpoint was called for free API
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('api-free.deepl.com'));
    });

    it('should handle HTML content in translation', async () => {
      const mockResponse = {
        translations: [{ text: '<p>Bonjour <strong>le monde</strong></p>' }],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const texts = ['<p>Hello <strong>world</strong></p>'];
      const result = await deeplTranslator.translate(texts, mockOptions);

      expect(result).toEqual(['<p>Bonjour <strong>le monde</strong></p>']);
    });

    it('should throw error for unsupported source locale', async () => {
      const invalidOptions = {
        ...mockOptions,
        sourceLanguage: 'unsupported',
      };

      await expect(deeplTranslator.translate(['Hello'], invalidOptions)).rejects.toThrow(
        'Source locale is not supported.',
      );
    });

    it('should throw error for unsupported target locale', async () => {
      const invalidOptions = {
        ...mockOptions,
        targetLanguage: 'unsupported',
      };

      await expect(deeplTranslator.translate(['Hello'], invalidOptions)).rejects.toThrow(
        'Target locale is not supported.',
      );
    });

    it('should handle empty text array', async () => {
      const mockResponse = {
        translations: [],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const result = await deeplTranslator.translate([], mockOptions);

      expect(result).toEqual([]);
    });

    it('should handle single text translation', async () => {
      const mockResponse = {
        translations: [{ text: 'Bonjour' }],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const result = await deeplTranslator.translate(['Hello'], mockOptions);

      expect(result).toEqual(['Bonjour']);
    });

    it('should handle special Chinese locale mappings', async () => {
      const mockResponse = {
        translations: [{ text: '你好世界' }],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const specialOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN',
        apiKey: mockApiKey,
      };

      const result = await deeplTranslator.translate(['Hello world'], specialOptions);

      expect(result).toEqual(['你好世界']);

      // Verify correct Chinese variant was used
      const calledUrl = vi.mocked(fetch).mock.calls[0][0];
      const url = new URL(String(calledUrl));

      expect(url.searchParams.get('target_lang')).toBe('ZH-HANS');
    });

    it('should handle network or API errors gracefully', async () => {
      const mockFetch = vi.mocked(fetch);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(deeplTranslator.translate(['Hello'], mockOptions)).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('Service Integration', () => {
    it('should export all required properties for TranslationService interface', () => {
      expect(deeplTranslator).toHaveProperty('serviceId');
      expect(deeplTranslator).toHaveProperty('serviceLabel');
      expect(deeplTranslator).toHaveProperty('apiLabel');
      expect(deeplTranslator).toHaveProperty('developerURL');
      expect(deeplTranslator).toHaveProperty('apiKeyURL');
      expect(deeplTranslator).toHaveProperty('apiKeyPattern');
      expect(deeplTranslator).toHaveProperty('markdownSupported');
      expect(deeplTranslator).toHaveProperty('availability');
      expect(deeplTranslator).toHaveProperty('translate');
    });

    it('should have correct markdown support flag', () => {
      expect(deeplTranslator.markdownSupported).toBe(false);
    });

    it('should have function properties that are callable', () => {
      expect(typeof availability).toBe('function');
      expect(typeof deeplTranslator.translate).toBe('function');
    });
  });

  describe('DeepL Specific Features', () => {
    const mockApiKey = '12345678-1234-1234-1234-123456789012';

    const mockOptions = {
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      apiKey: mockApiKey,
    };

    it('should include HTML tag handling in requests', async () => {
      const mockResponse = {
        translations: [{ text: 'Test' }],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      await deeplTranslator.translate(['Test'], mockOptions);

      const calledUrl = vi.mocked(fetch).mock.calls[0][0];
      const url = new URL(String(calledUrl));

      expect(url.searchParams.get('tag_handling')).toBe('html');
      expect(url.searchParams.get('split_sentences')).toBe('1');
    });

    it('should properly construct URL with multiple text parameters', async () => {
      const mockResponse = {
        translations: [{ text: 'Test 1' }, { text: 'Test 2' }, { text: 'Test 3' }],
      };

      const mockFetch = vi.mocked(fetch);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
        }),
      );

      const texts = ['Text 1', 'Text 2', 'Text 3'];

      await deeplTranslator.translate(texts, mockOptions);

      const calledUrl = vi.mocked(fetch).mock.calls[0][0];
      const url = new URL(String(calledUrl));

      expect(url.searchParams.getAll('text')).toEqual(texts);
    });
  });

  describe('Exported Helper Functions', () => {
    describe('getSourceLanguage', () => {
      it('should return valid source languages', () => {
        expect(getSourceLanguage('en')).toBe('EN');
        expect(getSourceLanguage('fr')).toBe('FR');
        expect(getSourceLanguage('de')).toBe('DE');
        expect(getSourceLanguage('ja')).toBe('JA');
        expect(getSourceLanguage('zh')).toBe('ZH');
      });

      it('should handle case variations', () => {
        expect(getSourceLanguage('EN')).toBe('EN');
        expect(getSourceLanguage('En')).toBe('EN');
        expect(getSourceLanguage('eN')).toBe('EN');
        expect(getSourceLanguage('fr')).toBe('FR');
        expect(getSourceLanguage('FR')).toBe('FR');
      });

      it('should handle locale codes with regions by using base language', () => {
        expect(getSourceLanguage('en-US')).toBe('EN');
        expect(getSourceLanguage('fr-FR')).toBe('FR');
        expect(getSourceLanguage('de-DE')).toBe('DE');
        expect(getSourceLanguage('zh-CN')).toBe('ZH');
      });

      it('should return undefined for unsupported languages', () => {
        expect(getSourceLanguage('unsupported')).toBeUndefined();
        expect(getSourceLanguage('xyz')).toBeUndefined();
        expect(getSourceLanguage('')).toBeUndefined();
        expect(getSourceLanguage('hi')).toBeUndefined(); // Hindi not supported by DeepL
        expect(getSourceLanguage('ar')).toBe('AR'); // Arabic is supported
      });
    });

    describe('getTargetLanguage', () => {
      it('should return valid target languages', () => {
        expect(getTargetLanguage('en')).toBe('EN');
        expect(getTargetLanguage('fr')).toBe('FR');
        expect(getTargetLanguage('de')).toBe('DE');
        expect(getTargetLanguage('ja')).toBe('JA');
      });

      it('should handle English variants correctly', () => {
        expect(getTargetLanguage('en-GB')).toBe('EN-GB');
        expect(getTargetLanguage('en-US')).toBe('EN-US');
        expect(getTargetLanguage('EN-GB')).toBe('EN-GB');
        expect(getTargetLanguage('EN-US')).toBe('EN-US');
      });

      it('should handle Portuguese variants correctly', () => {
        expect(getTargetLanguage('pt-BR')).toBe('PT-BR');
        expect(getTargetLanguage('pt-PT')).toBe('PT-PT');
        expect(getTargetLanguage('PT-BR')).toBe('PT-BR');
        expect(getTargetLanguage('PT-PT')).toBe('PT-PT');
        expect(getTargetLanguage('pt')).toBe('PT');
      });

      it('should handle Chinese variants with special mapping', () => {
        // Simplified Chinese variants
        expect(getTargetLanguage('zh-CN')).toBe('ZH-HANS');
        expect(getTargetLanguage('zh-SG')).toBe('ZH-HANS');
        expect(getTargetLanguage('ZH-CN')).toBe('ZH-HANS');
        expect(getTargetLanguage('ZH-SG')).toBe('ZH-HANS');

        // Traditional Chinese variants
        expect(getTargetLanguage('zh-TW')).toBe('ZH-HANT');
        expect(getTargetLanguage('zh-HK')).toBe('ZH-HANT');
        expect(getTargetLanguage('zh-MO')).toBe('ZH-HANT');
        expect(getTargetLanguage('ZH-TW')).toBe('ZH-HANT');
        expect(getTargetLanguage('ZH-HK')).toBe('ZH-HANT');
        expect(getTargetLanguage('ZH-MO')).toBe('ZH-HANT');

        // Base Chinese
        expect(getTargetLanguage('zh')).toBe('ZH');
        expect(getTargetLanguage('ZH')).toBe('ZH');
      });

      it('should fallback to base language when region is not specifically supported', () => {
        expect(getTargetLanguage('en-XX')).toBe('EN'); // Unknown English variant
        expect(getTargetLanguage('fr-XX')).toBe('FR'); // Unknown French variant
        expect(getTargetLanguage('de-XX')).toBe('DE'); // Unknown German variant
      });

      it('should return undefined for completely unsupported languages', () => {
        expect(getTargetLanguage('unsupported')).toBeUndefined();
        expect(getTargetLanguage('xyz')).toBeUndefined();
        expect(getTargetLanguage('')).toBeUndefined();
        expect(getTargetLanguage('hi')).toBeUndefined(); // Hindi not supported by DeepL
      });

      it('should handle case insensitive input', () => {
        expect(getTargetLanguage('fr')).toBe('FR');
        expect(getTargetLanguage('FR')).toBe('FR');
        expect(getTargetLanguage('Fr')).toBe('FR');
        expect(getTargetLanguage('fR')).toBe('FR');
      });
    });
  });
});
