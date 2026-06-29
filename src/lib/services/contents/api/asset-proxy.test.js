// @ts-nocheck

/**
 * @import { Asset } from '$lib/types/private';
 */

import * as fileUtils from '@sveltia/utils/file';
import { describe, expect, it, vi } from 'vitest';

import * as assetsInfo from '$lib/services/assets/info';

import { AssetProxy } from './asset-proxy';

// Mock dependencies first
vi.mock('@sveltia/utils/file', () => ({
  encodeBase64: vi.fn((_blob) => Promise.resolve('base64encodedstring')),
}));

vi.mock('$lib/services/assets/info', () => ({
  getAssetPublicURL: vi.fn((_asset, options) => {
    if (options?.pathOnly) {
      return '/assets/test-image.jpg';
    }

    return 'https://example.com/assets/test-image.jpg';
  }),
  getAssetBlobURL: vi.fn(() => Promise.resolve('blob:https://example.com/12345')),
  getAssetBlob: vi.fn((_asset) => Promise.resolve(new Blob(['test'], { type: 'image/jpeg' }))),
}));

describe('AssetProxy', () => {
  describe('constructor', () => {
    it('should initialize with asset data', () => {
      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);

      expect(proxy.path).toBe('/assets/test-image.jpg');
      expect(proxy.fileObj).toBe(mockAsset.file);
      expect(proxy.field).toBeUndefined();
    });

    it('should use blobURL from asset if available', () => {
      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        blobURL: 'blob:https://example.com/existing-blob',
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);

      expect(proxy.url).toBe('blob:https://example.com/existing-blob');
    });

    it('should use path if no blobURL is available', () => {
      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);

      expect(proxy.url).toBe('/assets/test-image.jpg');
    });

    it('should handle asset with no public URL', () => {
      vi.mocked(assetsInfo.getAssetPublicURL).mockReturnValueOnce(/** @type {any} */ (null));

      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);

      expect(proxy.path).toBe('');
      expect(proxy.url).toBe('');

      // Reset mock
      vi.mocked(assetsInfo.getAssetPublicURL).mockReturnValueOnce('/assets/test-image.jpg');
    });
  });

  describe('toString()', () => {
    it('should return the current URL', () => {
      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);
      const result = proxy.toString();

      expect(result).toBe('/assets/test-image.jpg');
    });

    it('should return updated URL after async blob URL resolution', async () => {
      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);

      // Wait for async update
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(proxy.url).toBe('blob:https://example.com/12345');
    });

    it('should keep existing URL when blob URL is not available', async () => {
      vi.mocked(assetsInfo.getAssetBlobURL).mockResolvedValueOnce(null);

      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);
      const initialUrl = proxy.url;

      // Wait for async update
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, 50));

      // URL should remain unchanged when getAssetBlobURL returns null
      expect(proxy.url).toBe(initialUrl);
      expect(proxy.url).toBe('/assets/test-image.jpg');

      // Reset mock
      vi.mocked(assetsInfo.getAssetBlobURL).mockResolvedValueOnce('blob:https://example.com/12345');
    });
  });

  describe('toBase64()', () => {
    it('should return a base64-encoded string of the asset', async () => {
      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);
      const result = await proxy.toBase64();

      expect(fileUtils.encodeBase64).toHaveBeenCalled();
      expect(result).toBe('base64encodedstring');
    });

    it('should throw error when asset blob cannot be retrieved', async () => {
      vi.mocked(assetsInfo.getAssetBlob).mockRejectedValueOnce(new Error('Blob fetch failed'));

      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);

      await expect(proxy.toBase64()).rejects.toThrow(
        'Failed to encode asset as base64: Blob fetch failed',
      );

      // Reset mock
      vi.mocked(assetsInfo.getAssetBlob).mockResolvedValueOnce(
        new Blob(['test'], { type: 'image/jpeg' }),
      );
    });

    it('should throw error when encoding fails', async () => {
      vi.mocked(fileUtils.encodeBase64).mockRejectedValueOnce(new Error('Encoding failed'));

      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);

      await expect(async () => {
        await proxy.toBase64();
      }).rejects.toThrow();

      // Verify mock was called
      expect(fileUtils.encodeBase64).toHaveBeenCalled();

      // Reset mock
      vi.mocked(fileUtils.encodeBase64).mockResolvedValueOnce('base64encodedstring');
    });
  });

  describe('field property', () => {
    it('should be undefined by default', () => {
      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);

      expect(proxy.field).toBeUndefined();
    });

    it('should be assignable', () => {
      /** @type {any} */
      const mockAsset = {
        name: 'test-image.jpg',
        sha: 'abc123',
        size: 1024,
        kind: 'image',
        folder: { collectionName: undefined, internalPath: 'assets', publicPath: '/assets' },
        file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' }),
      };

      const proxy = new AssetProxy(mockAsset);

      proxy.field = 'featured_image';

      expect(proxy.field).toBe('featured_image');
    });
  });
});
