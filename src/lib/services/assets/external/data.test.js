import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assetUpdatesToast } from '$lib/services/assets/data';
import {
  externalAssetCounts,
  externalAssets,
  externalAssetsError,
  focusedExternalAsset,
  selectedCloudService,
  selectedExternalAssets,
} from '$lib/services/assets/external';
import { processFile } from '$lib/services/assets/process';
import { cmsConfig } from '$lib/services/config';

import {
  deleteExternalAssets,
  externalAssetsToast,
  fetchExternalAssetBlob,
  getSharedMediaLibraryOptions,
  loadExternalAssets,
  renameExternalAsset,
  uploadExternalAssets,
  uploadingExternalAssets,
} from './data';

vi.mock('$lib/services/assets/data', () => ({
  assetUpdatesToast: { current: {} },
}));

vi.mock('$lib/services/assets/external', () => ({
  externalAssetCounts: { current: {} },
  externalAssets: { current: undefined },
  externalAssetsError: { current: undefined },
  focusedExternalAsset: { current: undefined },
  selectedCloudService: { current: undefined },
  selectedExternalAssets: { current: [] },
  getFetchOptions: vi.fn(() => ({ apiKey: 'secret' })),
}));

vi.mock('$lib/services/assets/process', () => ({
  processFile: vi.fn(async (file) => ({ file, oversized: false, invalid: false })),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

/**
 * Create a test asset.
 * @param {string} id Asset ID.
 * @returns {import('$lib/types/private').ExternalAsset} Asset.
 */
const createAsset = (id) => ({
  id,
  description: id,
  previewURL: '',
  downloadURL: '',
  fileName: id,
  kind: 'image',
});

const [a, b, c] = ['a.png', 'b.png', 'c.png'].map(createAsset);
const fetchOptions = { apiKey: 'secret' };

describe('assets/external/data', () => {
  /** @type {any} */
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    service = {
      serviceId: 'test',
      list: vi.fn(async () => [a, b]),
      upload: vi.fn(),
      delete: vi.fn(),
      rename: vi.fn(),
      replace: vi.fn(),
    };

    cmsConfig.current = undefined;
    selectedCloudService.current = service;
    externalAssets.current = [a, b];
    externalAssetCounts.current = {};
    externalAssetsError.current = undefined;
    selectedExternalAssets.current = [a];
    focusedExternalAsset.current = a;
    externalAssetsToast.current = { show: false, status: 'info', message: '' };
    assetUpdatesToast.current = /** @type {any} */ ({});
    uploadingExternalAssets.current = { files: [] };
  });

  describe('getSharedMediaLibraryOptions', () => {
    it('should return the `all` options or an empty object', () => {
      expect(getSharedMediaLibraryOptions()).toEqual({});

      cmsConfig.current = /** @type {any} */ ({
        media_libraries: { all: { max_file_size: 1024 } },
      });

      expect(getSharedMediaLibraryOptions()).toEqual({ max_file_size: 1024 });
    });
  });

  describe('fetchExternalAssetBlob', () => {
    it('should return the file content', async () => {
      const blob = new Blob(['x']);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        /** @type {any} */ ({ ok: true, blob: vi.fn().mockResolvedValue(blob) }),
      );

      expect(await fetchExternalAssetBlob({ ...a, downloadURL: 'https://cdn/a.png' })).toBe(blob);
      expect(fetch).toHaveBeenCalledWith('https://cdn/a.png');
    });

    it('should throw when the request fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        /** @type {any} */ ({ ok: false, status: 403 }),
      );

      await expect(fetchExternalAssetBlob(a)).rejects.toThrow('HTTP status 403');
    });
  });

  describe('loadExternalAssets', () => {
    it('should populate the list', async () => {
      externalAssets.current = undefined;

      await loadExternalAssets(service);

      expect(service.list).toHaveBeenCalledWith(fetchOptions);
      expect(externalAssets.current).toEqual([a, b]);
      expect(externalAssetCounts.current).toEqual({ test: 2 });
      expect(externalAssetsError.current).toBeUndefined();
    });

    it('should fall back to an empty list when the service cannot list files', async () => {
      delete service.list;

      await loadExternalAssets(service);

      expect(externalAssets.current).toEqual([]);
    });

    it('should report an error', async () => {
      service.list.mockRejectedValue(new Error('fail'));

      await loadExternalAssets(service);

      expect(externalAssets.current).toEqual([]);
      expect(externalAssetsError.current).toBe('search_fetch_failed');
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalled();
    });

    it('should drop the selection and focus of assets that are no longer listed', async () => {
      service.list.mockResolvedValue([b]);

      await loadExternalAssets(service);

      expect(selectedExternalAssets.current).toEqual([]);
      expect(focusedExternalAsset.current).toBeUndefined();

      focusedExternalAsset.current = b;
      selectedExternalAssets.current = [b];
      service.list.mockRejectedValue(new Error('fail'));

      await loadExternalAssets(service);

      expect(selectedExternalAssets.current).toEqual([]);
      expect(focusedExternalAsset.current).toBeUndefined();
    });

    it('should ignore the result of an earlier load once a newer one has started', async () => {
      /**
       * Resolve the first request.
       * @type {(assets: any[]) => void}
       */
      let resolveFirst = () => {};
      /**
       * Reject the first request.
       * @type {(error: Error) => void}
       */
      let rejectFirst = () => {};

      service.list.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            resolveFirst = resolve;
            rejectFirst = reject;
          }),
      );

      const first = loadExternalAssets(service);

      service.list.mockResolvedValueOnce([b]);
      await loadExternalAssets(service);

      expect(externalAssets.current).toEqual([b]);

      // A stale failure must not replace the list that has just been loaded
      rejectFirst(new Error('stale'));
      await first;

      expect(externalAssets.current).toEqual([b]);
      expect(externalAssetsError.current).toBeUndefined();

      // Neither must a stale success
      service.list.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      );

      const stale = loadExternalAssets(service);

      service.list.mockResolvedValueOnce([a]);
      await loadExternalAssets(service);
      resolveFirst([b]);
      await stale;

      expect(externalAssets.current).toEqual([a]);
    });

    it('should ignore the result when another service has been selected', async () => {
      const promise = loadExternalAssets(service);

      selectedCloudService.current = /** @type {any} */ ({ serviceId: 'other' });
      await promise;

      expect(externalAssets.current).toBeUndefined();

      service.list.mockRejectedValue(new Error('fail'));
      await loadExternalAssets(service);

      expect(externalAssets.current).toBeUndefined();
      expect(externalAssetsError.current).toBeUndefined();
    });
  });

  describe('uploadExternalAssets', () => {
    const file = new File(['x'], 'c.png', { type: 'image/png' });

    it('should upload valid files and prepend them to the list', async () => {
      const replaced = createAsset('b.png');

      service.upload.mockResolvedValue([c, replaced]);

      const result = await uploadExternalAssets([file]);

      expect(processFile).toHaveBeenCalledWith(file, {});
      expect(service.upload).toHaveBeenCalledWith([file], fetchOptions);
      // An asset uploaded under an existing name replaces the old one
      expect(externalAssets.current).toEqual([c, replaced, a]);
      expect(externalAssetCounts.current).toEqual({ test: 3 });
      expect(externalAssetsToast.current.show).toBe(false);
      expect(assetUpdatesToast.current).toEqual(expect.objectContaining({ saved: true, count: 2 }));
      expect(result).toEqual({ oversizedFileNames: [], invalidFileNames: [] });
    });

    it('should handle an empty list', async () => {
      externalAssets.current = undefined;
      service.upload.mockResolvedValue([c]);

      await uploadExternalAssets([file]);

      expect(externalAssets.current).toEqual([c]);
    });

    it('should report rejected files without uploading them', async () => {
      const oversized = new File(['x'], 'big.png', { type: 'image/png' });
      const invalid = new File(['x'], 'bad.png', { type: 'image/png' });

      vi.mocked(processFile).mockImplementation(async (f) => ({
        file: f,
        originalFile: undefined,
        oversized: f === oversized,
        invalid: f === invalid,
      }));

      const result = await uploadExternalAssets([oversized, invalid]);

      expect(service.upload).not.toHaveBeenCalled();
      expect(result).toEqual({ oversizedFileNames: ['big.png'], invalidFileNames: ['bad.png'] });
    });

    it('should report an upload failure', async () => {
      service.upload.mockRejectedValue(new Error('fail'));

      await uploadExternalAssets([file]);

      expect(externalAssetsToast.current).toEqual({
        show: true,
        status: 'error',
        message: 'uploading_files_failed',
      });
      expect(externalAssets.current).toEqual([a, b]);
    });

    it('should replace an existing asset', async () => {
      const replaced = { ...createAsset('a.png'), size: 1 };

      service.replace.mockResolvedValue(replaced);

      await uploadExternalAssets([file], { originalAsset: a });

      expect(service.replace).toHaveBeenCalledWith(a, file, fetchOptions);
      expect(service.upload).not.toHaveBeenCalled();
      expect(externalAssets.current).toEqual([replaced, b]);
      expect(selectedExternalAssets.current).toEqual([replaced]);
      expect(focusedExternalAsset.current).toBe(replaced);
      expect(assetUpdatesToast.current).toEqual(expect.objectContaining({ saved: true, count: 1 }));
    });

    it('should do nothing when the service cannot upload or replace', async () => {
      delete service.upload;
      delete service.replace;

      await uploadExternalAssets([file]);
      await uploadExternalAssets([file], { originalAsset: a });

      expect(externalAssets.current).toEqual([a, b]);
      expect(assetUpdatesToast.current).toEqual({});
    });

    it('should do nothing when no service is selected', async () => {
      selectedCloudService.current = undefined;

      await uploadExternalAssets([file]);

      expect(service.upload).not.toHaveBeenCalled();
    });
  });

  describe('deleteExternalAssets', () => {
    it('should delete the assets and update the list, selection and focus', async () => {
      expect(await deleteExternalAssets([a])).toBe(true);

      expect(service.delete).toHaveBeenCalledWith([a], fetchOptions);
      expect(externalAssets.current).toEqual([b]);
      expect(externalAssetCounts.current).toEqual({ test: 1 });
      expect(selectedExternalAssets.current).toEqual([]);
      expect(focusedExternalAsset.current).toBeUndefined();
      expect(assetUpdatesToast.current).toEqual(
        expect.objectContaining({ deleted: true, count: 1 }),
      );
    });

    it('should keep the focus on an asset that is not deleted', async () => {
      await deleteExternalAssets([b]);

      expect(externalAssets.current).toEqual([a]);
      expect(focusedExternalAsset.current).toBe(a);
    });

    it('should do nothing without assets or a capable service', async () => {
      expect(await deleteExternalAssets([])).toBe(false);
      expect(service.delete).not.toHaveBeenCalled();

      delete service.delete;
      expect(await deleteExternalAssets([a])).toBe(false);
      expect(externalAssets.current).toEqual([a, b]);
    });

    it('should report a failure and reload the list, as some assets may be gone', async () => {
      service.delete.mockRejectedValue(new Error('fail'));
      service.list.mockResolvedValue([b]);

      expect(await deleteExternalAssets([a, b])).toBe(false);

      expect(externalAssetsToast.current).toEqual({
        show: true,
        status: 'error',
        message: 'deleting_assets_failed',
      });
      expect(service.list).toHaveBeenCalled();
      expect(externalAssets.current).toEqual([b]);
      expect(selectedExternalAssets.current).toEqual([]);
      expect(focusedExternalAsset.current).toBeUndefined();
      expect(assetUpdatesToast.current).toEqual({});
    });
  });

  describe('renameExternalAsset', () => {
    it('should rename the asset and update the list', async () => {
      const renamed = createAsset('z.png');

      focusedExternalAsset.current = b;
      service.rename.mockResolvedValue(renamed);

      expect(await renameExternalAsset(a, 'z.png')).toBe(renamed);

      expect(service.rename).toHaveBeenCalledWith(a, 'z.png', fetchOptions);
      expect(externalAssets.current).toEqual([renamed, b]);
      expect(selectedExternalAssets.current).toEqual([renamed]);
      expect(focusedExternalAsset.current).toBe(b);
      expect(assetUpdatesToast.current).toEqual(
        expect.objectContaining({ renamed: true, count: 1 }),
      );
    });

    it('should do nothing when the service cannot rename', async () => {
      delete service.rename;

      expect(await renameExternalAsset(a, 'z.png')).toBeUndefined();

      expect(externalAssets.current).toEqual([a, b]);
    });

    it('should report a failure', async () => {
      service.rename.mockRejectedValue(new Error('fail'));

      expect(await renameExternalAsset(a, 'z.png')).toBeUndefined();

      expect(externalAssets.current).toEqual([a, b]);
      expect(externalAssetsToast.current).toEqual({
        show: true,
        status: 'error',
        message: 'renaming_asset_failed',
      });
    });
  });
});
