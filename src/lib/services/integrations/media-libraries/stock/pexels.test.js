import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import pexelsService, { getLocale, list, parseResults, search } from './pexels';

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
  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock the locale store to return 'en-US'
    vi.mocked(get).mockReturnValue('en-US');

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
      // eslint-disable-next-line import/no-named-as-default-member
      expect(pexelsService.list).toBeDefined();
      // eslint-disable-next-line import/no-named-as-default-member
      expect(pexelsService.search).toBeDefined();
    });

    it('should have named exports available', () => {
      expect(typeof parseResults).toBe('function');
      expect(typeof getLocale).toBe('function');
      expect(typeof list).toBe('function');
      expect(typeof search).toBe('function');
    });
  });

  describe('utility functions', () => {
    describe('getLocale', () => {
      it('should return "en-US" by default', () => {
        expect(getLocale()).toBe('en-US');
      });

      it('should find exact locale match (case-insensitive)', () => {
        vi.mocked(get).mockReturnValue('pt-BR');
        expect(getLocale()).toBe('pt-BR');

        vi.mocked(get).mockReturnValue('ES-ES');
        expect(getLocale()).toBe('es-ES');
      });

      it('should find language match when exact locale not available', () => {
        vi.mocked(get).mockReturnValue('es');
        expect(getLocale()).toBe('es-ES');

        vi.mocked(get).mockReturnValue('zh');
        expect(getLocale()).toBe('zh-TW'); // First match in the list

        vi.mocked(get).mockReturnValue('fr');
        expect(getLocale()).toBe('fr-FR');
      });

      it('should fallback to en-US for unsupported locales', () => {
        vi.mocked(get).mockReturnValue('unsupported-locale');
        expect(getLocale()).toBe('en-US');

        vi.mocked(get).mockReturnValue('xyz-ABC');
        expect(getLocale()).toBe('en-US');
      });
    });

    describe('parseResults', () => {
      it('should parse API response correctly', () => {
        /** @type {any} */
        const mockResponse = {
          total_results: 100,
          page: 1,
          per_page: 15,
          photos: [
            {
              id: 123456,
              width: 3000,
              height: 2000,
              url: 'https://www.pexels.com/photo/sample-123456/',
              photographer: 'John Doe',
              photographer_url: 'https://www.pexels.com/@john-doe',
              photographer_id: 789,
              avg_color: '#2E342A',
              src: {
                original: 'https://images.pexels.com/photos/123456/original.jpeg',
                large2x: 'https://images.pexels.com/photos/123456/large2x.jpeg',
                large: 'https://images.pexels.com/photos/123456/large.jpeg',
                medium: 'https://images.pexels.com/photos/123456/medium.jpeg',
                small: 'https://images.pexels.com/photos/123456/small.jpeg',
                portrait: 'https://images.pexels.com/photos/123456/portrait.jpeg',
                landscape: 'https://images.pexels.com/photos/123456/landscape.jpeg',
                tiny: 'https://images.pexels.com/photos/123456/tiny.jpeg',
              },
              alt: 'Sample photo description',
            },
          ],
        };

        /** @type {any} */
        const result = parseResults(mockResponse.photos);

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          id: '123456',
          description: 'sample',
          previewURL: 'https://images.pexels.com/photos/123456/medium.jpeg',
          downloadURL: 'https://images.pexels.com/photos/123456/large2x.jpeg',
          fileName: 'pexels-john-doe-123456.jpg',
          kind: 'image',
          credit:
            '<a href="https://www.pexels.com/photo/sample-123456/">Photo by John Doe on Pexels</a>',
        });
      });

      it('should handle missing alt text', () => {
        /** @type {any} */
        const mockResponse = {
          total_results: 1,
          page: 1,
          per_page: 15,
          photos: [
            {
              id: 123456,
              width: 3000,
              height: 2000,
              url: 'https://www.pexels.com/photo/123456/',
              photographer: 'Jane Smith',
              photographer_url: 'https://www.pexels.com/@jane-smith',
              photographer_id: 456,
              avg_color: '#3A2E42',
              src: {
                original: 'https://images.pexels.com/photos/123456/original.jpeg',
                large2x: 'https://images.pexels.com/photos/123456/large2x.jpeg',
                large: 'https://images.pexels.com/photos/123456/large.jpeg',
                medium: 'https://images.pexels.com/photos/123456/medium.jpeg',
                small: 'https://images.pexels.com/photos/123456/small.jpeg',
                portrait: 'https://images.pexels.com/photos/123456/portrait.jpeg',
                landscape: 'https://images.pexels.com/photos/123456/landscape.jpeg',
                tiny: 'https://images.pexels.com/photos/123456/tiny.jpeg',
              },
            },
          ],
        };

        /** @type {any} */
        const result = parseResults(mockResponse.photos);

        expect(result[0].description).toBeUndefined();
      });

      it('should handle empty response', () => {
        /** @type {any} */
        const mockResponse = {
          total_results: 0,
          page: 1,
          per_page: 15,
          photos: [],
        };

        /** @type {any} */
        const result = parseResults(mockResponse.photos);

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(0);
      });
    });
  });

  describe('service tests', () => {
    const mockApiKey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcd1234';

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

    describe('list function', () => {
      const mockListResponse = {
        photos: [
          {
            id: 54321,
            url: 'https://www.pexels.com/photo/curated-sunset-landscape-54321/',
            alt: 'Curated sunset landscape',
            src: {
              large2x:
                'https://images.pexels.com/photos/54321/sunset-landscape.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
              medium:
                'https://images.pexels.com/photos/54321/sunset-landscape.jpeg?auto=compress&cs=tinysrgb&h=350',
            },
            photographer: 'Curated User',
          },
          {
            id: 98765,
            url: 'https://www.pexels.com/photo/featured-ocean-waves-98765/',
            alt: 'Featured ocean waves',
            src: {
              large2x:
                'https://images.pexels.com/photos/98765/ocean-waves.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
              medium:
                'https://images.pexels.com/photos/98765/ocean-waves.jpeg?auto=compress&cs=tinysrgb&h=350',
            },
            photographer: 'Featured User',
          },
        ],
      };

      it('should fetch curated pictures', async () => {
        const fetchMock = vi.mocked(fetch);

        fetchMock.mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockListResponse),
          }),
        );

        const results = await list({ apiKey: mockApiKey });

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('https://api.pexels.com/v1/curated?per_page=80'),
          expect.objectContaining({
            headers: { Authorization: mockApiKey },
          }),
        );

        expect(results).toHaveLength(2);
        expect(results[0]).toMatchObject({
          id: '54321',
          description: 'curated sunset landscape',
          previewURL: expect.stringContaining('sunset-landscape.jpeg'),
          downloadURL: expect.stringContaining('sunset-landscape.jpeg'),
          fileName: 'pexels-curated-user-54321.jpg',
          kind: 'image',
          credit: expect.stringContaining('Curated User'),
        });

        expect(results[1]).toMatchObject({
          id: '98765',
          description: 'featured ocean waves',
          previewURL: expect.stringContaining('ocean-waves.jpeg'),
          downloadURL: expect.stringContaining('ocean-waves.jpeg'),
          fileName: 'pexels-featured-user-98765.jpg',
          kind: 'image',
          credit: expect.stringContaining('Featured User'),
        });
      });

      it('should handle API errors in list', async () => {
        const fetchMock = vi.mocked(fetch);

        fetchMock.mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: false,
            status: 401,
          }),
        );

        await expect(list({ apiKey: mockApiKey })).rejects.toBeUndefined();
      });

      it('should include required list parameters', async () => {
        const fetchMock = vi.mocked(fetch);

        fetchMock.mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue({ photos: [] }),
          }),
        );

        await list({ apiKey: mockApiKey });

        const fetchCall = fetchMock.mock.calls[0];
        const url = new URL(/** @type {string} */ (fetchCall?.[0]));

        expect(url.searchParams.get('per_page')).toBe('80');
        expect(fetchCall?.[1]?.headers).toEqual({ Authorization: mockApiKey });
      });

      it('should properly format credit links in list results', async () => {
        const fetchMock = vi.mocked(fetch);

        fetchMock.mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockListResponse),
          }),
        );

        const results = await list({ apiKey: mockApiKey });

        expect(results[0].credit).toBe(
          '<a href="https://www.pexels.com/photo/curated-sunset-landscape-54321/">Photo by Curated User on Pexels</a>',
        );
        expect(results[1].credit).toBe(
          '<a href="https://www.pexels.com/photo/featured-ocean-waves-98765/">Photo by Featured User on Pexels</a>',
        );
      });

      it('should extract description from URL when available in list results', async () => {
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

        const results = await list({ apiKey: mockApiKey });

        expect(results[0].description).toBe('amazing nature landscape photography');
      });

      it('should fallback to alt text when URL description is not available in list results', async () => {
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

        const results = await list({ apiKey: mockApiKey });

        expect(results[0].description).toBe('Fallback alt text');
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

      it('should search for images with query', async () => {
        const fetchMock = vi.mocked(fetch);

        fetchMock.mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockSearchResponse),
          }),
        );

        const results = await search('sunset', { apiKey: mockApiKey });

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

      it('should search with empty query', async () => {
        const fetchMock = vi.mocked(fetch);

        fetchMock.mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue({ photos: [], next_page: null }),
          }),
        );

        const results = await search('', { apiKey: mockApiKey });

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('https://api.pexels.com/v1/search'),
          expect.objectContaining({
            headers: { Authorization: mockApiKey },
          }),
        );

        const fetchCall = fetchMock.mock.calls[0];
        const url = new URL(/** @type {string} */ (fetchCall?.[0]));

        expect(url.searchParams.get('query')).toBe('');
        expect(results).toHaveLength(0);
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

        const results = await search('nature', { apiKey: mockApiKey });

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

        await expect(search('test', { apiKey: mockApiKey })).rejects.toBeUndefined();
      });

      it('should use supported locale in search parameters', async () => {
        vi.mocked(get).mockReturnValue('pt-BR'); // Portuguese (Brazil) locale

        const fetchMock = vi.mocked(fetch);

        fetchMock.mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockSearchResponse),
          }),
        );

        await search('test', { apiKey: mockApiKey });

        const fetchCall = fetchMock.mock.calls[0];
        const url = new URL(/** @type {string} */ (fetchCall?.[0]));

        expect(url.searchParams.get('locale')).toBe('pt-BR');
      });

      it('should fallback to English for unsupported locales', async () => {
        vi.mocked(get).mockReturnValue('unsupported-locale');

        const fetchMock = vi.mocked(fetch);

        fetchMock.mockResolvedValueOnce(
          /** @type {any} */ ({
            ok: true,
            json: vi.fn().mockResolvedValue(mockSearchResponse),
          }),
        );

        await search('test', { apiKey: mockApiKey });

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

        const results = await search('test', { apiKey: mockApiKey });

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

        const results = await search('test', { apiKey: mockApiKey });

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

        const results = await search('test', { apiKey: mockApiKey });

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

        await search('nature', { apiKey: mockApiKey });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(sleepMock).toHaveBeenCalledTimes(1); // Called between pages
      });
    });
  });
});
