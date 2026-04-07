import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import picsumService, { list, parseResults } from './picsum';

// Setup global fetch mock
global.fetch = vi.fn();

describe('integrations/media-libraries/stock/picsum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('service configuration', () => {
    it('should have correct service configuration', () => {
      expect(picsumService.serviceType).toBe('stock_assets');
      expect(picsumService.serviceId).toBe('picsum');
      expect(picsumService.serviceLabel).toBe('Lorem Picsum');
      expect(picsumService.serviceURL).toBe('https://picsum.photos/');
      expect(picsumService.showServiceLink).toBe(true);
      expect(picsumService.hotlinking).toBe(true);
      expect(picsumService.authType).toBe('none');
      expect(picsumService.developerURL).toBeUndefined();
      expect(picsumService.apiKeyURL).toBeUndefined();
      expect(picsumService.apiKeyPattern).toBeUndefined();
      // eslint-disable-next-line import-x/no-named-as-default-member
      expect(picsumService.list).toBeDefined();
      expect(picsumService.search).toBeUndefined();
    });

    it('should have named exports available', () => {
      expect(typeof parseResults).toBe('function');
      expect(typeof list).toBe('function');
    });
  });

  describe('parseResults', () => {
    it('should parse API results correctly', () => {
      /** @type {any[]} */
      const mockApiResults = [
        {
          id: '0',
          author: 'Alejandro Escamilla',
          width: 5616,
          height: 3744,
          url: 'https://unsplash.com/photos/yC-Yzbqy7PY',
          download_url: 'https://picsum.photos/id/0/5616/3744',
        },
        {
          id: '10',
          author: 'Paul Jarvis',
          width: 2500,
          height: 1667,
          url: 'https://unsplash.com/photos/6J--NXulQCs',
          download_url: 'https://picsum.photos/id/10/2500/1667',
        },
      ];

      const result = parseResults(mockApiResults);

      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        id: '0',
        description: '',
        previewURL: 'https://picsum.photos/id/0/480/320.webp',
        downloadURL: 'https://picsum.photos/id/0/1920/1280.webp',
        fileName: 'picsum-0.webp',
        kind: 'image',
      });

      expect(result[1]).toEqual({
        id: '10',
        description: '',
        previewURL: 'https://picsum.photos/id/10/480/320.webp',
        downloadURL: 'https://picsum.photos/id/10/1920/1280.webp',
        fileName: 'picsum-10.webp',
        kind: 'image',
      });
    });

    it('should handle empty results', () => {
      expect(parseResults([])).toEqual([]);
    });

    it('should use 1280x1920 download and 300x400 preview for portrait images', () => {
      /** @type {any[]} */
      const results = [
        { id: '20', author: 'Author', width: 1000, height: 1500, url: '', download_url: '' },
      ];

      const parsed = parseResults(results)[0];

      expect(parsed.downloadURL).toBe('https://picsum.photos/id/20/1280/1920.webp');
      expect(parsed.previewURL).toBe('https://picsum.photos/id/20/320/480.webp');
    });

    it('should use numeric id as string', () => {
      /** @type {any[]} */
      const results = [
        {
          id: '237',
          author: 'André Spieker',
          width: 3500,
          height: 2095,
          url: 'https://unsplash.com/photos/abc',
          download_url: 'https://picsum.photos/id/237/3500/2095',
        },
      ];

      const parsed = parseResults(results);

      expect(parsed[0].id).toBe('237');
      expect(typeof parsed[0].id).toBe('string');
    });
  });

  describe('list', () => {
    /** @type {object[]} */
    const mockPage = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      author: `Author ${i}`,
      width: 1000,
      height: 800,
      url: `https://unsplash.com/photos/${i}`,
      download_url: `https://picsum.photos/id/${i}/1000/800`,
    }));

    it('should fetch exactly 3 random pages', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        /** @type {any} */ ({ ok: true, json: vi.fn().mockResolvedValue(mockPage) }),
      );

      const result = await list();

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(300);
    });

    it('should use correct URL and query params', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        /** @type {any} */ ({ ok: true, json: vi.fn().mockResolvedValue(mockPage) }),
      );

      await list();

      const url = new URL(/** @type {string} */ (vi.mocked(global.fetch).mock.calls[0][0]));

      expect(url.origin + url.pathname).toBe('https://picsum.photos/v2/list');
      expect(url.searchParams.get('limit')).toBe('100');
      expect(Number(url.searchParams.get('page'))).toBeGreaterThanOrEqual(1);
      expect(Number(url.searchParams.get('page'))).toBeLessThanOrEqual(10);
    });

    it('should reject when the API response is not ok', async () => {
      vi.mocked(global.fetch).mockResolvedValue(/** @type {any} */ ({ ok: false }));

      await expect(list()).rejects.toBeUndefined();
    });
  });
});
