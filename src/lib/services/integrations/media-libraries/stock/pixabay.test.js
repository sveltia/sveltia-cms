import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import pixabayService, { getLocale, list, parseResults, search } from './pixabay';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('svelte-i18n', () => ({
  locale: { subscribe: vi.fn() },
}));

// Setup global fetch mock
global.fetch = vi.fn();

describe('integrations/media-libraries/stock/pixabay', () => {
  const mockApiKey = '12345-1234567890abcdef1234567890';

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
      expect(pixabayService.serviceType).toBe('stock_assets');
      expect(pixabayService.serviceId).toBe('pixabay');
      expect(pixabayService.serviceLabel).toBe('Pixabay');
      expect(pixabayService.serviceURL).toBe('https://pixabay.com/');
      expect(pixabayService.showServiceLink).toBe(true);
      expect(pixabayService.hotlinking).toBe(false);
      expect(pixabayService.authType).toBe('api_key');
      expect(pixabayService.developerURL).toBe('https://pixabay.com/service/about/api/');
      expect(pixabayService.apiKeyURL).toBe('https://pixabay.com/api/docs/#api_key');
      expect(pixabayService.apiKeyPattern).toBeInstanceOf(RegExp);
      // eslint-disable-next-line import/no-named-as-default-member
      expect(pixabayService.list).toBeDefined();
      // eslint-disable-next-line import/no-named-as-default-member
      expect(pixabayService.search).toBeDefined();
    });

    it('should have named exports available', () => {
      expect(typeof parseResults).toBe('function');
      expect(typeof getLocale).toBe('function');
      expect(typeof list).toBe('function');
      expect(typeof search).toBe('function');
    });

    it('should validate API key pattern', () => {
      const { apiKeyPattern } = pixabayService;

      if (apiKeyPattern) {
        // Valid API key pattern: digits-25 hex chars (lowercase)
        expect(apiKeyPattern.test('12345-1234567890abcdef12345678f')).toBe(true);
        expect(apiKeyPattern.test('999-1234567890abcdef123456789')).toBe(true);
        expect(apiKeyPattern.test('1-abcdef1234567890abcdef123')).toBe(true);

        // Invalid API keys
        expect(apiKeyPattern.test('short')).toBe(false);
        expect(apiKeyPattern.test('12345-1234567890ABCDEF123456789')).toBe(false); // uppercase hex
        expect(apiKeyPattern.test('12345-1234567890abcdef12345678')).toBe(false); // 24 hex chars
        expect(apiKeyPattern.test('12345-1234567890abcdef123456789012')).toBe(false); // 26 hex chars
        expect(apiKeyPattern.test('abcde-1234567890abcdef123456789')).toBe(false); // letters before dash
        expect(apiKeyPattern.test('12345_1234567890abcdef123456789')).toBe(false); // underscore instead of dash
        expect(apiKeyPattern.test('')).toBe(false);
      }
    });
  });

  describe('utility functions', () => {
    describe('getLocale', () => {
      it('should return supported locale', async () => {
        const { get } = await import('svelte/store');

        vi.mocked(get).mockReturnValue('de-DE');

        expect(getLocale()).toBe('de');
      });

      it('should fallback to English for unsupported locales', async () => {
        const { get } = await import('svelte/store');

        vi.mocked(get).mockReturnValue('unsupported-locale');

        expect(getLocale()).toBe('en');
      });
    });

    describe('parseResults', () => {
      it('should parse API results correctly', () => {
        const mockApiResults = [
          {
            id: 12345,
            webformatURL: 'https://pixabay.com/get/sunset-mountains_640.jpg',
            previewURL: 'https://cdn.pixabay.com/photo/2021/01/01/01/01/sunset-mountains_150.jpg',
            largeImageURL: 'https://pixabay.com/get/sunset-mountains_1280.jpg',
            imageWidth: 1920,
            imageHeight: 1080,
            pageURL: 'https://pixabay.com/photos/sunset-mountains-landscape-12345/',
            tags: 'sunset, mountains, landscape',
            user: 'johndoe',
          },
          {
            id: 67890,
            webformatURL: 'https://pixabay.com/get/ocean-waves_640.jpg',
            previewURL: 'https://cdn.pixabay.com/photo/2021/02/01/01/01/ocean-waves_150.jpg',
            largeImageURL: 'https://pixabay.com/get/ocean-waves_1280.jpg',
            imageWidth: 1280,
            imageHeight: 1920,
            pageURL: 'https://pixabay.com/photos/ocean-waves-water-67890/',
            tags: 'ocean, waves, water',
            user: 'janesmith',
          },
        ];

        const results = parseResults(mockApiResults);

        expect(results).toHaveLength(2);
        expect(results[0]).toMatchObject({
          id: '12345',
          description: 'sunset, mountains, landscape',
          previewURL: expect.stringContaining('sunset-mountains_180.jpg'),
          downloadURL: expect.stringContaining('sunset-mountains_1280.jpg'),
          fileName: 'sunset-mountains_1280.jpg',
          kind: 'image',
          credit: expect.stringContaining('johndoe'),
        });

        expect(results[1]).toMatchObject({
          id: '67890',
          description: 'ocean, waves, water',
          previewURL: expect.stringContaining('ocean-waves_340.jpg'),
          fileName: 'ocean-waves_1280.jpg',
          kind: 'image',
        });
      });

      it('should adjust preview URL based on image orientation', () => {
        const landscapeResult = parseResults([
          {
            id: 1,
            webformatURL: 'https://pixabay.com/get/image_640.jpg',
            previewURL: 'https://pixabay.com/get/image_150.jpg',
            largeImageURL: 'https://pixabay.com/get/image_1280.jpg',
            imageWidth: 1920,
            imageHeight: 1080, // landscape
            pageURL: 'https://pixabay.com/photos/1/',
            tags: 'landscape',
            user: 'user',
          },
        ]);

        const portraitResult = parseResults([
          {
            id: 2,
            webformatURL: 'https://pixabay.com/get/image_640.jpg',
            previewURL: 'https://pixabay.com/get/image_150.jpg',
            largeImageURL: 'https://pixabay.com/get/image_1280.jpg',
            imageWidth: 1080,
            imageHeight: 1920, // portrait
            pageURL: 'https://pixabay.com/photos/2/',
            tags: 'portrait',
            user: 'user',
          },
        ]);

        expect(landscapeResult[0].previewURL).toContain('_180.'); // landscape gets 180px width
        expect(portraitResult[0].previewURL).toContain('_340.'); // portrait gets 340px width
      });
    });
  });

  describe('list function', () => {
    const mockListResponse = {
      hits: [
        {
          id: 54321,
          webformatURL: 'https://pixabay.com/get/curated-image_640.jpg',
          previewURL: 'https://cdn.pixabay.com/photo/2021/01/01/01/01/curated-image_150.jpg',
          largeImageURL: 'https://pixabay.com/get/curated-image_1280.jpg',
          imageWidth: 1920,
          imageHeight: 1080,
          pageURL: 'https://pixabay.com/photos/curated-editors-choice-54321/',
          tags: 'curated, editors choice, featured',
          user: 'curateduser',
        },
        {
          id: 98765,
          webformatURL: 'https://pixabay.com/get/featured-content_640.jpg',
          previewURL: 'https://cdn.pixabay.com/photo/2021/01/01/01/01/featured-content_150.jpg',
          largeImageURL: 'https://pixabay.com/get/featured-content_1280.jpg',
          imageWidth: 1280,
          imageHeight: 1920,
          pageURL: 'https://pixabay.com/photos/featured-content-98765/',
          tags: 'featured, content, quality',
          user: 'featureduser',
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
        expect.stringContaining(
          'https://pixabay.com/api/?image_type=photo&min_width=1280&safesearch=true&per_page=150&key=12345-1234567890abcdef1234567890&lang=en&editors_choice=true',
        ),
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: '54321',
        description: 'curated, editors choice, featured',
        previewURL: expect.stringContaining('curated-image_180.jpg'),
        downloadURL: expect.stringContaining('curated-image_1280.jpg'),
        fileName: 'curated-image_1280.jpg',
        kind: 'image',
        credit: expect.stringContaining('curateduser'),
      });

      expect(results[1]).toMatchObject({
        id: '98765',
        description: 'featured, content, quality',
        previewURL: expect.stringContaining('featured-content_340.jpg'),
        fileName: 'featured-content_1280.jpg',
        kind: 'image',
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

    it('should use supported locale in list parameters', async () => {
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue('de-DE'); // German locale

      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockListResponse),
        }),
      );

      await list({ apiKey: mockApiKey });

      const fetchCall = fetchMock.mock.calls[0];
      const url = new URL(/** @type {string} */ (fetchCall?.[0]));

      expect(url.searchParams.get('lang')).toBe('de');
      expect(url.searchParams.get('editors_choice')).toBe('true');
    });

    it('should include required list parameters', async () => {
      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue({ hits: [] }),
        }),
      );

      await list({ apiKey: mockApiKey });

      const fetchCall = fetchMock.mock.calls[0];
      const url = new URL(/** @type {string} */ (fetchCall?.[0]));

      expect(url.searchParams.get('key')).toBe(mockApiKey);
      expect(url.searchParams.get('image_type')).toBe('photo');
      expect(url.searchParams.get('min_width')).toBe('1280');
      expect(url.searchParams.get('safesearch')).toBe('true');
      expect(url.searchParams.get('per_page')).toBe('150');
      expect(url.searchParams.get('editors_choice')).toBe('true');
    });
  });

  describe('search function', () => {
    const mockSearchResponse = {
      hits: [
        {
          id: 12345,
          webformatURL: 'https://pixabay.com/get/sunset-mountains_640.jpg',
          previewURL: 'https://cdn.pixabay.com/photo/2021/01/01/01/01/sunset-mountains_150.jpg',
          largeImageURL: 'https://pixabay.com/get/sunset-mountains_1280.jpg',
          imageWidth: 1920,
          imageHeight: 1080,
          pageURL: 'https://pixabay.com/photos/sunset-mountains-landscape-12345/',
          tags: 'sunset, mountains, landscape',
          user: 'johndoe',
        },
        {
          id: 67890,
          webformatURL: 'https://pixabay.com/get/ocean-waves_640.jpg',
          previewURL: 'https://cdn.pixabay.com/photo/2021/02/01/01/01/ocean-waves_150.jpg',
          largeImageURL: 'https://pixabay.com/get/ocean-waves_1280.jpg',
          imageWidth: 1280,
          imageHeight: 1920,
          pageURL: 'https://pixabay.com/photos/ocean-waves-water-67890/',
          tags: 'ocean, waves, water',
          user: 'janesmith',
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

      const results = await search('sunset', { apiKey: mockApiKey });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://pixabay.com/api/?image_type=photo&min_width=1280&safesearch=true&per_page=150&key=12345-1234567890abcdef1234567890&lang=en&q=sunset',
        ),
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: '12345',
        description: 'sunset, mountains, landscape',
        previewURL: expect.stringContaining('sunset-mountains_180.jpg'),
        downloadURL: expect.stringContaining('sunset-mountains_1280.jpg'),
        fileName: 'sunset-mountains_1280.jpg',
        kind: 'image',
        credit: expect.stringContaining('johndoe'),
      });

      expect(results[1]).toMatchObject({
        id: '67890',
        description: 'ocean, waves, water',
        previewURL: expect.stringContaining('ocean-waves_340.jpg'),
        fileName: 'ocean-waves_1280.jpg',
        kind: 'image',
      });
    });

    it('should search with empty query', async () => {
      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(mockSearchResponse),
        }),
      );

      const results = await search('', { apiKey: mockApiKey });

      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('q='));

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
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue('de-DE'); // German locale

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

      expect(url.searchParams.get('lang')).toBe('de');
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

      await search('test', { apiKey: mockApiKey });

      const fetchCall = fetchMock.mock.calls[0];
      const url = new URL(/** @type {string} */ (fetchCall?.[0]));

      expect(url.searchParams.get('lang')).toBe('en');
    });

    it('should adjust preview URL based on image orientation', async () => {
      const landscapeImage = {
        hits: [
          {
            id: 11111,
            webformatURL: 'https://pixabay.com/get/landscape_640.jpg',
            previewURL: 'https://cdn.pixabay.com/photo/2021/01/01/01/01/landscape_150.jpg',
            largeImageURL: 'https://pixabay.com/get/landscape_1280.jpg',
            imageWidth: 1920,
            imageHeight: 1080, // landscape
            pageURL: 'https://pixabay.com/photos/landscape-11111/',
            tags: 'landscape',
            user: 'photographer',
          },
        ],
      };

      const portraitImage = {
        hits: [
          {
            id: 22222,
            webformatURL: 'https://pixabay.com/get/portrait_640.jpg',
            previewURL: 'https://cdn.pixabay.com/photo/2021/01/01/01/01/portrait_150.jpg',
            largeImageURL: 'https://pixabay.com/get/portrait_1280.jpg',
            imageWidth: 1080,
            imageHeight: 1920, // portrait
            pageURL: 'https://pixabay.com/photos/portrait-22222/',
            tags: 'portrait',
            user: 'photographer',
          },
        ],
      };

      const fetchMock = vi.mocked(fetch);

      // Test landscape image
      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(landscapeImage),
        }),
      );

      let results = await search('landscape', { apiKey: mockApiKey });

      expect(results[0].previewURL).toContain('_180.'); // landscape gets 180px width

      // Reset and test portrait image
      vi.clearAllMocks();
      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(portraitImage),
        }),
      );

      results = await search('portrait', { apiKey: mockApiKey });

      expect(results[0].previewURL).toContain('_340.'); // portrait gets 340px width
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
        '<a href="https://pixabay.com/photos/sunset-mountains-landscape-12345/">Photo by johndoe on Pixabay',
      );
    });

    it('should extract filename from preview URL correctly', async () => {
      const responseWithComplexUrl = {
        hits: [
          {
            id: 33333,
            webformatURL: 'https://pixabay.com/get/complex-image-name_640.jpg',
            previewURL: 'https://cdn.pixabay.com/photo/2021/01/01/01/01/complex-image-name_150.jpg',
            largeImageURL: 'https://pixabay.com/get/complex-image-name_1280.jpg',
            imageWidth: 1920,
            imageHeight: 1080,
            pageURL: 'https://pixabay.com/photos/complex-name-33333/',
            tags: 'complex, image',
            user: 'photographer',
          },
        ],
      };

      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue(responseWithComplexUrl),
        }),
      );

      const results = await search('test', { apiKey: mockApiKey });

      expect(results[0].fileName).toBe('complex-image-name_1280.jpg');
    });

    it('should include required search parameters', async () => {
      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        /** @type {any} */ ({
          ok: true,
          json: vi.fn().mockResolvedValue({ hits: [] }),
        }),
      );

      await search('test', { apiKey: mockApiKey });

      const fetchCall = fetchMock.mock.calls[0];
      const url = new URL(/** @type {string} */ (fetchCall?.[0]));

      expect(url.searchParams.get('key')).toBe(mockApiKey);
      expect(url.searchParams.get('image_type')).toBe('photo');
      expect(url.searchParams.get('min_width')).toBe('1280');
      expect(url.searchParams.get('safesearch')).toBe('true');
      expect(url.searchParams.get('per_page')).toBe('150');
      expect(url.searchParams.get('q')).toBe('test');
    });
  });
});
