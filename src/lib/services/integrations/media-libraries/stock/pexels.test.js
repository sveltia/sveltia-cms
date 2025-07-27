import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import pexelsService from './pexels';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('svelte-i18n', () => ({
  locale: { subscribe: vi.fn() },
}));

vi.mock('@sveltia/utils/misc', () => ({
  sleep: vi.fn(),
}));

// Setup global fetch mock
global.fetch = vi.fn();

describe('integrations/media-libraries/stock/pexels', () => {
  const mockApiKey = 'test-api-key-12345678901234567890';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock the locale store to return 'en-US'
    const { get } = await import('svelte/store');

    vi.mocked(get).mockReturnValue('en-US');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(pexelsService.serviceType).toBe('stock_assets');
      expect(pexelsService.serviceId).toBe('pexels');
      expect(pexelsService.serviceLabel).toBe('Pexels');
      expect(pexelsService.serviceURL).toBe('https://www.pexels.com/');
      expect(pexelsService.showServiceLink).toBe(true);
      expect(pexelsService.hotlinking).toBe(false);
      expect(pexelsService.authType).toBe('api_key');
      expect(pexelsService.developerURL).toBe('https://www.pexels.com/api/');
      expect(pexelsService.apiKeyURL).toBe('https://www.pexels.com/api/new/');
      expect(pexelsService.apiKeyPattern).toBeInstanceOf(RegExp);
    });

    it('should validate API key pattern', () => {
      const { apiKeyPattern } = pexelsService;

      if (apiKeyPattern) {
        // Valid API key (exactly 56 alphanumeric characters)
        expect(apiKeyPattern.test('abcdef1234567890abcdef1234567890abcdef1234567890abcd1234')).toBe(
          true,
        );
        expect(apiKeyPattern.test('ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCD1234')).toBe(
          true,
        );

        // Invalid API keys
        expect(apiKeyPattern.test('short')).toBe(false);
        expect(apiKeyPattern.test('contains@special#chars')).toBe(false);
        expect(apiKeyPattern.test('abcdef1234567890abcdef1234567890abcdef1234567890abcd123')).toBe(
          false,
        ); // 55 chars
        expect(
          apiKeyPattern.test('abcdef1234567890abcdef1234567890abcdef1234567890abcd12345'),
        ).toBe(false); // 57 chars
        expect(apiKeyPattern.test('')).toBe(false);
      }
    });
  });

  describe('search function', () => {
    const mockSearchResponse = {
      photos: [
        {
          id: 12345,
          url: 'https://www.pexels.com/photo/beautiful-sunset-over-mountains-12345/',
          alt: 'Beautiful sunset over mountains',
          src: {
            large2x:
              'https://images.pexels.com/photos/12345/sunset-mountains.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
            medium:
              'https://images.pexels.com/photos/12345/sunset-mountains.jpeg?auto=compress&cs=tinysrgb&h=350',
          },
          photographer: 'John Doe',
        },
        {
          id: 67890,
          url: 'https://www.pexels.com/photo/ocean-waves-crashing-on-shore-67890/',
          alt: 'Ocean waves crashing on shore',
          src: {
            large2x:
              'https://images.pexels.com/photos/67890/ocean-waves.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
            medium:
              'https://images.pexels.com/photos/67890/ocean-waves.jpeg?auto=compress&cs=tinysrgb&h=350',
          },
          photographer: 'Jane Smith',
        },
      ],
      next_page: null,
    };

    const mockCuratedResponse = {
      photos: [
        {
          id: 11111,
          url: 'https://www.pexels.com/photo/city-skyline-at-night-11111/',
          alt: 'City skyline at night',
          src: {
            large2x:
              'https://images.pexels.com/photos/11111/city-skyline.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
            medium:
              'https://images.pexels.com/photos/11111/city-skyline.jpeg?auto=compress&cs=tinysrgb&h=350',
          },
          photographer: 'Pro Photographer',
        },
      ],
    };

    it('should search for images with query', async () => {
      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSearchResponse),
        }),
      );

      const results = await pexelsService.search('sunset', { apiKey: mockApiKey });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('https://api.pexels.com/v1/search'),
        expect.objectContaining({
          headers: { Authorization: mockApiKey },
        }),
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: '12345',
        description: 'beautiful sunset over mountains',
        previewURL: expect.stringContaining('sunset-mountains.jpeg'),
        downloadURL: expect.stringContaining('sunset-mountains.jpeg'),
        fileName: 'pexels-john-doe-12345.jpg',
        kind: 'image',
        credit: expect.stringContaining('John Doe'),
      });

      expect(results[1]).toMatchObject({
        id: '67890',
        description: 'ocean waves crashing on shore',
        fileName: 'pexels-jane-smith-67890.jpg',
        kind: 'image',
      });
    });

    it('should fetch curated photos when no query is provided', async () => {
      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockCuratedResponse),
        }),
      );

      const results = await pexelsService.search('', { apiKey: mockApiKey });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('https://api.pexels.com/v1/curated'),
        expect.objectContaining({
          headers: { Authorization: mockApiKey },
        }),
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: '11111',
        description: 'city skyline at night',
        fileName: 'pexels-pro-photographer-11111.jpg',
        kind: 'image',
      });
    });

    it('should handle multiple pages of search results', async () => {
      const { sleep } = await import('@sveltia/utils/misc');
      const sleepMock = vi.mocked(sleep);
      const fetchMock = vi.mocked(fetch);

      // Mock first page response
      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue({
            photos: [mockSearchResponse.photos[0]],
            next_page: 'https://api.pexels.com/v1/search?query=nature&page=2',
          }),
        }),
      );

      // Mock second page response
      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue({
            photos: [mockSearchResponse.photos[1]],
            next_page: null,
          }),
        }),
      );

      const results = await pexelsService.search('nature', { apiKey: mockApiKey });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleepMock).toHaveBeenCalledWith(50);
      expect(results).toHaveLength(2);
    });

    it('should handle API errors', async () => {
      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: false,
          status: 401,
        }),
      );

      await expect(pexelsService.search('test', { apiKey: mockApiKey })).rejects.toBeUndefined();
    });

    it('should use supported locale in search parameters', async () => {
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue('pt-BR'); // Portuguese (Brazil) locale

      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSearchResponse),
        }),
      );

      await pexelsService.search('test', { apiKey: mockApiKey });

      const fetchCall = fetchMock.mock.calls[0];
      const url = new URL(/** @type {string} */ (fetchCall?.[0]));

      expect(url.searchParams.get('locale')).toBe('pt-BR');
    });

    it('should fallback to English for unsupported locales', async () => {
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue('unsupported-locale');

      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSearchResponse),
        }),
      );

      await pexelsService.search('test', { apiKey: mockApiKey });

      const fetchCall = fetchMock.mock.calls[0];
      const url = new URL(/** @type {string} */ (fetchCall?.[0]));

      expect(url.searchParams.get('locale')).toBe('en-US');
    });

    it('should extract description from URL when available', async () => {
      const responseWithUrlDescription = {
        photos: [
          {
            id: 99999,
            url: 'https://www.pexels.com/photo/amazing-nature-landscape-photography-99999/',
            alt: 'Original alt text',
            src: {
              large2x: 'https://images.pexels.com/photos/99999/nature.jpeg?auto=compress',
              medium: 'https://images.pexels.com/photos/99999/nature.jpeg?auto=compress',
            },
            photographer: 'Nature Lover',
          },
        ],
      };

      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(responseWithUrlDescription),
        }),
      );

      const results = await pexelsService.search('test', { apiKey: mockApiKey });

      expect(results[0].description).toBe('amazing nature landscape photography');
    });

    it('should fallback to alt text when URL description is not available', async () => {
      const responseWithoutUrlDesc = {
        photos: [
          {
            id: 88888,
            url: 'https://www.pexels.com/photo/88888/',
            alt: 'Fallback alt text',
            src: {
              large2x: 'https://images.pexels.com/photos/88888/test.jpeg',
              medium: 'https://images.pexels.com/photos/88888/test.jpeg',
            },
            photographer: 'Test Photographer',
          },
        ],
      };

      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(responseWithoutUrlDesc),
        }),
      );

      const results = await pexelsService.search('test', { apiKey: mockApiKey });

      expect(results[0].description).toBe('Fallback alt text');
    });

    it('should properly format credit links', async () => {
      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSearchResponse),
        }),
      );

      const results = await pexelsService.search('test', { apiKey: mockApiKey });

      expect(results[0].credit).toBe(
        '<a href="https://www.pexels.com/photo/beautiful-sunset-over-mountains-12345/">Photo by John Doe on Pexels</a>',
      );
    });

    it('should limit to maximum 2 pages for search results', async () => {
      const { sleep } = await import('@sveltia/utils/misc');
      const sleepMock = vi.mocked(sleep);
      const fetchMock = vi.mocked(fetch);

      // Mock responses for 2 pages
      for (let i = 1; i <= 2; i += 1) {
        fetchMock.mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue({
              photos: [
                {
                  id: i,
                  url: `https://www.pexels.com/photo/${i}/`,
                  alt: `Photo ${i}`,
                  src: { large2x: `url${i}`, medium: `medium${i}` },
                  photographer: `Photographer ${i}`,
                },
              ],
              next_page: i < 2 ? 'next-page-url' : null, // More pages available only for first page
            }),
          }),
        );
      }

      await pexelsService.search('nature', { apiKey: mockApiKey });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleepMock).toHaveBeenCalledTimes(1); // Called between pages
    });
  });
});
