import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _resetAssetMetadataCache,
  defaultAssetDetails,
  getAssetDetails,
  getAssetUsedEntries,
} from '$lib/services/assets/details';
import { getAssetBlobURL, getAssetPublicURL } from '$lib/services/assets/info';
import { getEntriesByAssets, getEntriesByAssetURL } from '$lib/services/assets/references';
import { getMediaMetadata } from '$lib/services/utils/media';

/**
 * @import { Asset } from '$lib/types/private';
 */

/** @type {{ current: any }} */
const mockBackend = vi.hoisted(() => ({ current: undefined }));

vi.mock('$lib/services/assets/info', () => ({
  getAssetBlobURL: vi.fn(),
  getAssetPublicURL: vi.fn(),
}));

vi.mock('$lib/services/assets/references', () => ({
  getEntriesByAssets: vi.fn(),
  getEntriesByAssetURL: vi.fn(),
}));

vi.mock('$lib/services/backends', () => ({
  backend: mockBackend,
}));

vi.mock('$lib/services/utils/media', () => ({
  getMediaMetadata: vi.fn(),
}));

/**
 * Create a test asset.
 * @param {Partial<Asset>} [props] Properties to override.
 * @returns {Asset} Asset.
 */
const createAsset = (props = {}) =>
  /** @type {Asset} */ ({
    name: 'photo.jpg',
    path: 'static/images/photo.jpg',
    sha: 'abc123',
    size: 1024,
    kind: 'image',
    folder: /** @type {any} */ ({ internalPath: 'static/images' }),
    ...props,
  });

describe('assets/details', () => {
  beforeEach(() => {
    _resetAssetMetadataCache();
    mockBackend.current = { repository: { blobBaseURL: 'https://github.com/a/b/blob/main' } };
    vi.mocked(getAssetBlobURL).mockResolvedValue('blob:test');
    vi.mocked(getAssetPublicURL).mockReturnValue('/images/photo.jpg');
    vi.mocked(getMediaMetadata).mockResolvedValue({
      dimensions: { width: 800, height: 600 },
      duration: undefined,
      createdDate: undefined,
      coordinates: undefined,
    });
  });

  describe('defaultAssetDetails', () => {
    it('should have empty values and no used entries', () => {
      expect(defaultAssetDetails).toEqual({
        publicURL: undefined,
        repoBlobURL: undefined,
        dimensions: undefined,
        duration: undefined,
        usedEntries: [],
      });
    });
  });

  describe('getAssetDetails()', () => {
    it('should combine the media metadata with the public and repository URLs', async () => {
      const asset = createAsset();

      await expect(getAssetDetails(asset)).resolves.toEqual({
        dimensions: { width: 800, height: 600 },
        duration: undefined,
        createdDate: undefined,
        coordinates: undefined,
        publicURL: '/images/photo.jpg',
        repoBlobURL: 'https://github.com/a/b/blob/main/static/images/photo.jpg',
      });
      expect(getMediaMetadata).toHaveBeenCalledWith(asset, 'blob:test', 'image');
    });

    it('should encode special characters in the repository URL', async () => {
      const details = await getAssetDetails(
        createAsset({ name: '50% off #1.jpg', path: 'static/images/50% off #1.jpg' }),
      );

      expect(details.repoBlobURL).toBe(
        'https://github.com/a/b/blob/main/static/images/50%25%20off%20%231.jpg',
      );
    });

    it('should not include a repository URL when the backend has no blob base URL', async () => {
      mockBackend.current = { repository: {} };

      expect((await getAssetDetails(createAsset())).repoBlobURL).toBeUndefined();
    });

    it('should not include a repository URL when no backend is selected', async () => {
      mockBackend.current = undefined;

      expect((await getAssetDetails(createAsset())).repoBlobURL).toBeUndefined();
    });

    it('should skip the metadata for a file that is not media', async () => {
      const details = await getAssetDetails(createAsset({ kind: 'document', name: 'a.pdf' }));

      expect(details).toEqual({
        publicURL: '/images/photo.jpg',
        repoBlobURL: 'https://github.com/a/b/blob/main/static/images/photo.jpg',
      });
      expect(getAssetBlobURL).not.toHaveBeenCalled();
      expect(getMediaMetadata).not.toHaveBeenCalled();
    });

    it('should skip the metadata when the file cannot be retrieved', async () => {
      vi.mocked(getAssetBlobURL).mockResolvedValue(undefined);

      const details = await getAssetDetails(createAsset({ kind: 'video' }));

      expect(details.dimensions).toBeUndefined();
      expect(getMediaMetadata).not.toHaveBeenCalled();
    });

    it('should collect the metadata once per file SHA', async () => {
      await Promise.all([
        getAssetDetails(createAsset()),
        getAssetDetails(createAsset({ path: 'static/images/copy.jpg' })),
      ]);
      await getAssetDetails(createAsset());

      expect(getMediaMetadata).toHaveBeenCalledTimes(1);
    });

    it('should collect the metadata separately for different SHAs', async () => {
      await getAssetDetails(createAsset({ sha: 'one' }));
      await getAssetDetails(createAsset({ sha: 'two' }));

      expect(getMediaMetadata).toHaveBeenCalledTimes(2);
    });

    it('should resolve the URLs on every call even when the metadata is cached', async () => {
      await getAssetDetails(createAsset());
      vi.mocked(getAssetPublicURL).mockReturnValue('/new/photo.jpg');

      const details = await getAssetDetails(createAsset({ path: 'static/new/photo.jpg' }));

      expect(details.publicURL).toBe('/new/photo.jpg');
      expect(details.repoBlobURL).toBe('https://github.com/a/b/blob/main/static/new/photo.jpg');
      expect(getMediaMetadata).toHaveBeenCalledTimes(1);
    });

    it('should not cache the metadata of an asset without a SHA', async () => {
      await getAssetDetails(createAsset({ sha: '' }));
      await getAssetDetails(createAsset({ sha: '' }));

      expect(getMediaMetadata).toHaveBeenCalledTimes(2);
    });

    it('should not remember a failed attempt', async () => {
      vi.mocked(getAssetBlobURL).mockRejectedValueOnce(new Error('Network error'));

      await expect(getAssetDetails(createAsset())).rejects.toThrow('Network error');
      await expect(getAssetDetails(createAsset())).resolves.toMatchObject({
        dimensions: { width: 800, height: 600 },
      });
      expect(getAssetBlobURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAssetUsedEntries()', () => {
    it('should look up the entries by the public path of the asset', async () => {
      const entries = /** @type {any[]} */ ([{ id: 'post-1' }]);
      const asset = createAsset();

      vi.mocked(getEntriesByAssetURL).mockResolvedValue(entries);

      await expect(getAssetUsedEntries(asset)).resolves.toBe(entries);
      expect(getAssetPublicURL).toHaveBeenCalledWith(asset, {
        allowSpecial: true,
        pathOnly: true,
      });
      expect(getEntriesByAssetURL).toHaveBeenCalledWith('/images/photo.jpg');
      expect(getAssetBlobURL).not.toHaveBeenCalled();
    });

    it('should look up the entries by the asset itself when it has no public path', async () => {
      const entries = /** @type {any[]} */ ([{ id: 'post-1' }]);
      const asset = createAsset();

      vi.mocked(getAssetPublicURL).mockReturnValue(undefined);
      vi.mocked(getEntriesByAssets).mockResolvedValue([entries]);

      await expect(getAssetUsedEntries(asset)).resolves.toBe(entries);
      expect(getEntriesByAssets).toHaveBeenCalledWith([{ asset }]);
      expect(getEntriesByAssetURL).not.toHaveBeenCalled();
      expect(getAssetBlobURL).not.toHaveBeenCalled();
    });

    it('should look up the entries by the asset itself in an entry-relative folder', async () => {
      // A path relative to the entry, like `images/photo.jpg`, would match the same path in any
      // entry, which refers to a different file in that entry’s own folder
      const entries = /** @type {any[]} */ ([{ id: 'post-1' }]);

      const asset = createAsset({
        path: 'content/posts/images/photo.jpg',
        folder: /** @type {any} */ ({ internalPath: 'content/posts', entryRelative: true }),
      });

      vi.mocked(getAssetPublicURL).mockReturnValue('images/photo.jpg');
      vi.mocked(getEntriesByAssets).mockResolvedValue([entries]);

      await expect(getAssetUsedEntries(asset)).resolves.toBe(entries);
      expect(getEntriesByAssets).toHaveBeenCalledWith([{ asset }]);
      expect(getEntriesByAssetURL).not.toHaveBeenCalled();
    });
  });
});
