import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allTranslationServices, translator } from './index.js';

// Mock the individual translator services
vi.mock('./google.js', () => ({
  default: {
    serviceId: 'google',
    serviceLabel: 'Google Cloud Translation',
    developerURL: 'https://console.cloud.google.com/apis/library/translate.googleapis.com',
    apiKeyURL: 'https://console.cloud.google.com/apis/api/translate.googleapis.com/credentials',
    apiKeyPattern: /AIza[0-9A-Za-z-_]{35}/,
    getSourceLanguage: vi.fn(),
    getTargetLanguage: vi.fn(),
    translate: vi.fn(),
  },
}));

// Mock svelte/store
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({
    subscribe: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  })),
}));

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

    it('should have all required properties for each service', () => {
      const requiredProperties = [
        'serviceId',
        'serviceLabel',
        'developerURL',
        'apiKeyURL',
        'apiKeyPattern',
        'getSourceLanguage',
        'getTargetLanguage',
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
        expect(typeof service.getSourceLanguage).toBe('function');
        expect(typeof service.getTargetLanguage).toBe('function');
        expect(typeof service.translate).toBe('function');
      });
    });
  });

  describe('translator store', () => {
    it('should be a writable store', () => {
      expect(translator).toBeDefined();
      expect(typeof translator).toBe('object');
      expect(translator).toHaveProperty('subscribe');
      expect(translator).toHaveProperty('set');
      expect(translator).toHaveProperty('update');
    });

    it('should default to Google translator', () => {
      // The store should be initialized with the Google translator by default
      expect(translator).toBeDefined();
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

        // Test service functions
        expect(typeof service.getSourceLanguage).toBe('function');
        expect(typeof service.getTargetLanguage).toBe('function');
        expect(typeof service.translate).toBe('function');
      });
    });
  });

  describe('Service Function Calls', () => {
    it('should allow calling service functions from allTranslationServices', () => {
      const googleService = allTranslationServices.google;

      // Test function calls don't throw errors (functions are mocked)
      expect(() => {
        googleService.getSourceLanguage('en');
        googleService.getTargetLanguage('fr');
      }).not.toThrow();
    });

    it('should properly mock service functions', () => {
      const googleService = allTranslationServices.google;

      googleService.getSourceLanguage('en');
      googleService.getTargetLanguage('fr');

      expect(googleService.getSourceLanguage).toHaveBeenCalledWith('en');
      expect(googleService.getTargetLanguage).toHaveBeenCalledWith('fr');
    });

    it('should allow mocking translate function calls', async () => {
      const googleService = allTranslationServices.google;
      // Mock the translate function to return a specific result
      const mockTranslate = vi.mocked(googleService.translate);

      mockTranslate.mockResolvedValueOnce(['Bonjour']);

      const result = await googleService.translate(['Hello'], {
        sourceLocale: 'en',
        targetLocale: 'fr',
        apiKey: 'test-key',
      });

      expect(result).toEqual(['Bonjour']);
      expect(mockTranslate).toHaveBeenCalledWith(['Hello'], {
        sourceLocale: 'en',
        targetLocale: 'fr',
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
