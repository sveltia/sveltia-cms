import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStockAssetMediaLibraryOptions } from './index';

// Mock all dependencies
vi.mock('$lib/services/integrations/media-libraries', () => ({
  getMediaLibraryOptions: vi.fn(),
}));

vi.mock('./pexels', () => ({ default: { name: 'Pexels' } }));
vi.mock('./pixabay', () => ({ default: { name: 'Pixabay' } }));
vi.mock('./unsplash', () => ({ default: { name: 'Unsplash' } }));

describe('integrations/media-libraries/stock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStockAssetMediaLibraryOptions', () => {
    it('should return all providers when no config is provided', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({});

      const result = getStockAssetMediaLibraryOptions();

      expect(result).toEqual({
        providers: ['pexels', 'pixabay', 'unsplash'],
      });
    });

    it('should return configured providers from field config', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        providers: ['unsplash'],
      });

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          stock_assets: {
            providers: ['unsplash'],
          },
        },
      });

      const result = getStockAssetMediaLibraryOptions({ fieldConfig });

      expect(getMock).toHaveBeenCalledWith({ libraryName: 'stock_assets', fieldConfig });
      expect(result).toEqual({
        providers: ['unsplash'],
      });
    });

    it('should return providers from site config', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        providers: ['unsplash', 'pixabay'],
      });

      const result = getStockAssetMediaLibraryOptions();

      expect(result).toEqual({
        providers: ['unsplash', 'pixabay'],
      });
    });

    it('should fallback to all providers when providers is not an array', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        providers: 'not-an-array',
      });

      const fieldConfig = /** @type {any} */ ({
        media_libraries: {
          stock_assets: {
            providers: 'not-an-array',
          },
        },
      });

      const result = getStockAssetMediaLibraryOptions({ fieldConfig });

      expect(result).toEqual({
        providers: ['pexels', 'pixabay', 'unsplash'],
      });
    });

    it('should fallback to all providers when no providers are configured', async () => {
      const { getMediaLibraryOptions } = await import('$lib/services/integrations/media-libraries');
      const getMock = vi.mocked(getMediaLibraryOptions);

      getMock.mockReturnValue({
        some_other_config: true,
      });

      const result = getStockAssetMediaLibraryOptions();

      expect(result).toEqual({
        providers: ['pexels', 'pixabay', 'unsplash'],
      });
    });
  });
});
