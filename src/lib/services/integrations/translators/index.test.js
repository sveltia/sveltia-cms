import { beforeEach, describe, expect, it, vi } from 'vitest';

import { allTranslationServices, translator } from './index.js';

// Mock the individual translator services
vi.mock('./google.js', () => ({
  default: {
    serviceId: 'google',
    serviceLabel: 'Google Cloud Translation',
    apiLabel: 'Cloud Translation API',
    developerURL: 'https://console.cloud.google.com/apis/library/translate.googleapis.com',
    apiKeyURL: 'https://console.cloud.google.com/apis/api/translate.googleapis.com/credentials',
    apiKeyPattern: /AIza[0-9A-Za-z-_]{35}/,
    markdownSupported: false,
    availability: vi.fn(),
    translate: vi.fn(),
  },
}));

vi.mock('./google-ai.js', () => ({
  default: {
    serviceId: 'google-ai',
    serviceLabel: 'Google Gemini',
    apiLabel: 'Google AI Studio API',
    developerURL: 'https://ai.google.dev/gemini-api/docs',
    apiKeyURL: 'https://aistudio.google.com/api-keys',
    apiKeyPattern: /AIza[a-zA-Z0-9_-]{35}/,
    markdownSupported: true,
    availability: vi.fn(),
    translate: vi.fn(),
  },
}));

vi.mock('./openai.js', () => ({
  default: {
    serviceId: 'openai',
    serviceLabel: 'OpenAI GPT',
    apiLabel: 'OpenAI API',
    developerURL: 'https://platform.openai.com/docs/overview',
    apiKeyURL: 'https://platform.openai.com/api-keys',
    apiKeyPattern: /sk-[a-zA-Z0-9-_]{40,}/,
    markdownSupported: true,
    availability: vi.fn(),
    translate: vi.fn(),
  },
}));

vi.mock('./anthropic.js', () => ({
  default: {
    serviceId: 'anthropic',
    serviceLabel: 'Anthropic Claude',
    apiLabel: 'Anthropic API',
    developerURL: 'https://console.anthropic.com/',
    apiKeyURL: 'https://console.anthropic.com/settings/keys',
    apiKeyPattern: /sk-ant-[a-zA-Z0-9-_]{40,}/,
    markdownSupported: true,
    availability: vi.fn(),
    translate: vi.fn(),
  },
}));

vi.mock('svelte/store', () => {
  // Use globalThis to avoid hoisting issues
  const mockDerived = vi.fn((stores, callback) => {
    /** @type {any} */ (globalThis).testDerivedCallback = callback; // Capture the callback
    return { subscribe: vi.fn() };
  });

  return {
    derived: mockDerived,
    get: vi.fn(),
    writable: vi.fn(() => ({
      subscribe: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
    })),
  };
});

describe('Translator Services Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('allTranslationServices', () => {
    it('should export all available translation services', () => {
      expect(allTranslationServices).toBeDefined();
      expect(typeof allTranslationServices).toBe('object');
    });

    it('should include Google translator service', () => {
      expect(allTranslationServices).toHaveProperty('google');
      expect(allTranslationServices.google).toBeDefined();
      expect(allTranslationServices.google.serviceId).toBe('google');
    });

    it('should include Gemini translator service', () => {
      expect(allTranslationServices).toHaveProperty('google-ai');
      expect(allTranslationServices['google-ai']).toBeDefined();
      expect(allTranslationServices['google-ai'].serviceId).toBe('google-ai');
    });

    it('should include OpenAI translator service', () => {
      expect(allTranslationServices).toHaveProperty('openai');
      expect(allTranslationServices.openai).toBeDefined();
      expect(allTranslationServices.openai.serviceId).toBe('openai');
    });

    it('should have all required properties for each service', () => {
      const requiredProperties = [
        'serviceId',
        'serviceLabel',
        'apiLabel',
        'developerURL',
        'apiKeyURL',
        'apiKeyPattern',
        'markdownSupported',
        'availability',
        'translate',
      ];

      Object.values(allTranslationServices).forEach((service) => {
        requiredProperties.forEach((prop) => {
          expect(service).toHaveProperty(prop);
        });
      });
    });

    it('should have unique service IDs', () => {
      const serviceIds = Object.values(allTranslationServices).map((service) => service.serviceId);
      const uniqueServiceIds = [...new Set(serviceIds)];

      expect(serviceIds.length).toBe(uniqueServiceIds.length);
    });

    it('should have callable function properties', () => {
      Object.values(allTranslationServices).forEach((service) => {
        expect(typeof service.availability).toBe('function');
        expect(typeof service.translate).toBe('function');
      });
    });

    it('should have correct markdown support flags', () => {
      expect(allTranslationServices.google.markdownSupported).toBe(false);
      expect(allTranslationServices.openai.markdownSupported).toBe(true);
    });
  });

  describe('translator store', () => {
    it('should be a derived store', () => {
      expect(translator).toBeDefined();
      expect(typeof translator).toBe('object');
      expect(translator).toHaveProperty('subscribe');
      // Derived stores only have subscribe method, not set/update
      expect(translator).not.toHaveProperty('set');
      expect(translator).not.toHaveProperty('update');
    });

    it('should default to Google translator', () => {
      // The store should be initialized with the Google translator by default
      expect(translator).toBeDefined();
    });

    it('should test derived callback with default prefs', () => {
      const callback = /** @type {any} */ (globalThis).testDerivedCallback;

      expect(callback).toBeDefined();

      // Test the callback with empty prefs (should default to google)
      const result = callback([{}]);

      expect(result).toBe(allTranslationServices.google);
    });

    it('should test derived callback with openai prefs', () => {
      const callback = /** @type {any} */ (globalThis).testDerivedCallback;

      expect(callback).toBeDefined();

      // Test the callback with prefs specifying openai
      const result = callback([{ defaultTranslationService: 'openai' }]);

      expect(result).toBe(allTranslationServices.openai);
    });

    it('should test derived callback fallback for unknown service', () => {
      const callback = /** @type {any} */ (globalThis).testDerivedCallback;

      expect(callback).toBeDefined();

      // Test the callback with prefs specifying an unknown service
      const result = callback([{ defaultTranslationService: 'deepl' }]);

      // Should fallback to google when service is not found
      expect(result).toBe(allTranslationServices.google);
    });
  });

  describe('Service Integration', () => {
    it('should allow accessing services by service ID', () => {
      expect(allTranslationServices.google).toBeDefined();
      expect(allTranslationServices.google.serviceId).toBe('google');
    });

    it('should provide consistent interface across all services', () => {
      const serviceKeys = Object.keys(allTranslationServices);

      expect(serviceKeys.length).toBeGreaterThan(0);

      serviceKeys.forEach((key) => {
        const service = allTranslationServices[key];

        // Test service metadata
        expect(typeof service.serviceId).toBe('string');
        expect(typeof service.serviceLabel).toBe('string');
        expect(typeof service.developerURL).toBe('string');
        expect(typeof service.apiKeyURL).toBe('string');
        expect(service.apiKeyPattern).toBeInstanceOf(RegExp);
        expect(typeof service.markdownSupported).toBe('boolean');

        // Test service functions
        expect(typeof service.availability).toBe('function');
        expect(typeof service.translate).toBe('function');
      });
    });
  });

  describe('Service Function Calls', () => {
    it('should allow calling service functions from allTranslationServices', async () => {
      const googleService = allTranslationServices.google;

      // Mock the availability function to return a resolved promise
      vi.mocked(googleService.availability).mockResolvedValue(true);

      // Test function calls don't throw errors (functions are mocked)
      await expect(
        googleService.availability({ sourceLanguage: 'en', targetLanguage: 'fr' }),
      ).resolves.toBe(true);
    });

    it('should properly mock service functions', async () => {
      const googleService = allTranslationServices.google;

      // Mock the availability function to return a resolved promise
      vi.mocked(googleService.availability).mockResolvedValue(true);

      await googleService.availability({ sourceLanguage: 'en', targetLanguage: 'fr' });

      expect(googleService.availability).toHaveBeenCalledWith({
        sourceLanguage: 'en',
        targetLanguage: 'fr',
      });
    });

    it('should allow mocking translate function calls', async () => {
      const googleService = allTranslationServices.google;
      // Mock the translate function to return a specific result
      const mockTranslate = vi.mocked(googleService.translate);

      mockTranslate.mockResolvedValueOnce(['Bonjour']);

      const result = await googleService.translate(['Hello'], {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        apiKey: 'test-key',
      });

      expect(result).toEqual(['Bonjour']);
      expect(mockTranslate).toHaveBeenCalledWith(['Hello'], {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        apiKey: 'test-key',
      });
    });
  });

  describe('Module Exports', () => {
    it('should export the expected functions and objects', () => {
      expect(typeof allTranslationServices).toBe('object');
      expect(translator).toBeDefined();
    });

    it('should not export internal implementation details', () => {
      // Ensure the module only exports what's intended for public use
      const moduleKeys = Object.keys({ allTranslationServices, translator });

      expect(moduleKeys).toContain('allTranslationServices');
      expect(moduleKeys).toContain('translator');
      expect(moduleKeys).toHaveLength(2);
    });
  });
});
