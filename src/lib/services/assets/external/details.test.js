import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEntriesByAssetURL, getEntriesUsingTargets } from '$lib/services/assets/references';
import { getSourceInfo } from '$lib/services/utils/media';

import {
  _resetExternalAssetDetailsCache,
  getExternalAssetDetails,
  getExternalAssetsUsedEntries,
  getExternalAssetUsedEntries,
} from './details';

vi.mock('$lib/services/assets/references', () => ({
  getEntriesUsingTargets: vi.fn(),
  getEntriesByAssetURL: vi.fn(),
}));

vi.mock('$lib/services/utils/media', () => ({
  getSourceInfo: vi.fn(),
}));

/**
 * Create a test asset.
 * @param {import('$lib/types/private').AssetKind} kind Asset kind.
 * @returns {import('$lib/types/private').ExternalAsset} Asset.
 */
const createAsset = (kind) => ({
  id: 'a',
  description: 'a',
  previewURL: '',
  downloadURL: `https://cdn.example.com/a-${kind}`,
  fileName: 'a',
  kind,
});

describe('assets/external/details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetExternalAssetDetailsCache();
  });

  describe('getExternalAssetDetails', () => {
    it('should return an empty object for a file without media info', async () => {
      expect(await getExternalAssetDetails(createAsset('document'))).toEqual({});
      expect(getSourceInfo).not.toHaveBeenCalled();
    });

    it('should load the media info once per file', async () => {
      const info = { dimensions: { width: 10, height: 20 }, duration: undefined };
      const asset = createAsset('image');

      vi.mocked(getSourceInfo).mockResolvedValue(info);

      expect(await getExternalAssetDetails(asset)).toBe(info);
      expect(await getExternalAssetDetails(asset)).toBe(info);
      expect(getSourceInfo).toHaveBeenCalledTimes(1);
      expect(getSourceInfo).toHaveBeenCalledWith(asset.downloadURL, 'image');
    });

    it('should not remember a failed attempt', async () => {
      const asset = createAsset('video');

      vi.mocked(getSourceInfo).mockRejectedValueOnce(new Error('fail'));
      await expect(getExternalAssetDetails(asset)).rejects.toThrow('fail');

      vi.mocked(getSourceInfo).mockResolvedValueOnce({ duration: 3 });
      expect(await getExternalAssetDetails(asset)).toEqual({ duration: 3 });
      expect(getSourceInfo).toHaveBeenCalledTimes(2);
    });
  });

  describe('getExternalAssetUsedEntries', () => {
    it('should search entries by the download URL', async () => {
      /** @type {any[]} */
      const entries = [{ id: 'e1' }];
      const asset = createAsset('image');

      vi.mocked(getEntriesByAssetURL).mockResolvedValue(entries);

      expect(await getExternalAssetUsedEntries(asset)).toBe(entries);
      expect(getEntriesByAssetURL).toHaveBeenCalledWith(asset.downloadURL);
    });
  });

  describe('getExternalAssetsUsedEntries', () => {
    it('should find the entries by the assets’ download URLs', async () => {
      /** @type {any[]} */
      const entries = [{ id: 'e1' }, { id: 'e2' }];
      const assets = [createAsset('image'), createAsset('video')];

      vi.mocked(getEntriesUsingTargets).mockResolvedValue(entries);

      expect(await getExternalAssetsUsedEntries(assets)).toBe(entries);
      expect(getEntriesUsingTargets).toHaveBeenCalledWith([
        { url: assets[0].downloadURL },
        { url: assets[1].downloadURL },
      ]);
    });
  });
});
