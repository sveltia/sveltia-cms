import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { prefs } from '$lib/services/user/prefs.svelte';

import {
  browseExternalFolder,
  canPreviewExternalAsset,
  deletingExternalSubfolder,
  enabledCloudServices,
  EXTERNAL_LOCATION_PATH_PREFIX,
  externalAssetCounts,
  externalAssets,
  externalAssetSearchTerms,
  externalAssetsError,
  externalFolders,
  focusedExternalAsset,
  focusedExternalSubfolder,
  getCloudService,
  getCloudServicePath,
  getExternalAssetPath,
  getFetchOptions,
  hasAuthInfo,
  hasFolderSupport,
  overlaidExternalAssetId,
  renamingExternalAsset,
  renamingExternalSubfolder,
  resetExternalAssets,
  selectedCloudService,
  selectedExternalAssets,
  selectedExternalDirPath,
} from '.';

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('$lib/services/integrations/media-libraries/cloud', () => ({
  allCloudStorageServices: {
    aws_s3: { serviceId: 'aws_s3', authType: 'api_key', isEnabled: vi.fn(() => false) },
    cloudinary: { serviceId: 'cloudinary', authType: 'widget', isEnabled: vi.fn(() => true) },
    uploadcare: { serviceId: 'uploadcare', authType: 'api_key', isEnabled: vi.fn(() => true) },
    custom: { serviceId: 'custom', authType: 'none' },
  },
}));

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: {},
}));

vi.mock('$lib/services/assets/external/linked', () => ({
  LINKED_FILES_SERVICE_ID: 'linked',
  linkedFilesService: { serviceId: 'linked', authType: 'none' },
}));

describe('assets/external', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cmsConfig.current = /** @type {any} */ ({});
    delete prefs.apiKeys;
    delete prefs.logins;
  });

  describe('enabledCloudServices', () => {
    it('should list the services enabled in the config, treating a missing check as enabled', () => {
      expect(enabledCloudServices.current.map(({ serviceId }) => serviceId)).toEqual([
        'cloudinary',
        'uploadcare',
        'custom',
      ]);
      expect(allCloudStorageServices.aws_s3.isEnabled).toHaveBeenCalledWith();
    });
  });

  describe('getCloudService', () => {
    it('should return an enabled service by ID', () => {
      expect(getCloudService('uploadcare')).toBe(allCloudStorageServices.uploadcare);
    });

    it('should return `undefined` for a disabled or unknown service', () => {
      expect(getCloudService('aws_s3')).toBeUndefined();
      expect(getCloudService('all')).toBeUndefined();
    });

    it('should return the virtual service for the linked files', () => {
      expect(getCloudService('linked')).toEqual({ serviceId: 'linked', authType: 'none' });
      // It’s not a configured service, so it’s not listed as one
      expect(enabledCloudServices.current.map(({ serviceId }) => serviceId)).not.toContain(
        'linked',
      );
    });
  });

  describe('getCloudServicePath', () => {
    it('should build the Asset Library path', () => {
      expect(EXTERNAL_LOCATION_PATH_PREFIX).toBe('-/');
      expect(getCloudServicePath(allCloudStorageServices.uploadcare)).toBe('/assets/-/uploadcare');
    });
  });

  describe('getExternalAssetPath', () => {
    it('should encode each segment of the asset ID', () => {
      /** @type {any} */
      const asset = { id: 'images/my photo#1.jpg' };

      expect(getExternalAssetPath(allCloudStorageServices.uploadcare, asset)).toBe(
        '/assets/-/uploadcare/images/my%20photo%231.jpg',
      );
    });
  });

  describe('canPreviewExternalAsset', () => {
    it('should allow media, PDF and plaintext files', () => {
      /**
       * Create a test asset.
       * @param {string} kind Asset kind.
       * @param {string} fileName File name.
       * @returns {any} Asset.
       */
      const create = (kind, fileName) => ({ kind, fileName });

      expect(canPreviewExternalAsset(create('image', 'a.png'))).toBe(true);
      expect(canPreviewExternalAsset(create('video', 'a.mp4'))).toBe(true);
      expect(canPreviewExternalAsset(create('document', 'a.pdf'))).toBe(true);
      expect(canPreviewExternalAsset(create('other', 'a.md'))).toBe(true);
      expect(canPreviewExternalAsset(create('document', 'a.docx'))).toBe(false);
      expect(canPreviewExternalAsset(create('other', 'a'))).toBe(false);
    });
  });

  describe('getFetchOptions', () => {
    it('should return empty credentials by default', () => {
      expect(getFetchOptions(allCloudStorageServices.uploadcare)).toEqual({
        apiKey: '',
        userName: '',
        password: '',
      });
    });

    it('should return the stored API key and login', () => {
      prefs.apiKeys = { uploadcare: 'secret' };
      prefs.logins = { uploadcare: 'user pass' };

      expect(getFetchOptions(allCloudStorageServices.uploadcare)).toEqual({
        apiKey: 'secret',
        userName: 'user',
        password: 'pass',
      });
    });
  });

  describe('hasAuthInfo', () => {
    it('should be true when no authentication is needed', () => {
      expect(hasAuthInfo(allCloudStorageServices.custom)).toBe(true);
    });

    it('should depend on the stored credentials otherwise', () => {
      expect(hasAuthInfo(allCloudStorageServices.uploadcare)).toBe(false);

      prefs.apiKeys = { uploadcare: 'secret' };
      expect(hasAuthInfo(allCloudStorageServices.uploadcare)).toBe(true);

      prefs.apiKeys = {};
      prefs.logins = { uploadcare: 'user pass' };
      expect(hasAuthInfo(allCloudStorageServices.uploadcare)).toBe(true);
    });
  });

  describe('resetExternalAssets', () => {
    it('should clear the list state but keep the selected service', () => {
      /** @type {any} */
      const asset = { id: 'a' };

      selectedCloudService.current = allCloudStorageServices.uploadcare;
      externalAssets.current = [asset];
      externalAssetCounts.current = { uploadcare: 1 };
      externalAssetsError.current = 'search_fetch_failed';
      selectedExternalAssets.current = [asset];
      focusedExternalAsset.current = asset;
      overlaidExternalAssetId.current = 'a';
      renamingExternalAsset.current = asset;
      externalAssetSearchTerms.current = 'photo';

      resetExternalAssets();

      expect(selectedCloudService.current).toBe(allCloudStorageServices.uploadcare);
      // The counts are kept for the sidebar
      expect(externalAssetCounts.current).toEqual({ uploadcare: 1 });
      expect(externalAssets.current).toBeUndefined();
      expect(externalAssetsError.current).toBeUndefined();
      expect(selectedExternalAssets.current).toEqual([]);
      expect(focusedExternalAsset.current).toBeUndefined();
      expect(overlaidExternalAssetId.current).toBeUndefined();
      expect(renamingExternalAsset.current).toBeUndefined();
      expect(externalAssetSearchTerms.current).toBe('');
    });

    it('should clear the folder state', () => {
      /** @type {any} */
      const subfolder = { name: '2024', path: '2024' };

      externalFolders.current = ['2024'];
      selectedExternalDirPath.current = '2024';
      focusedExternalSubfolder.current = subfolder;
      renamingExternalSubfolder.current = subfolder;
      deletingExternalSubfolder.current = subfolder;

      resetExternalAssets();

      expect(externalFolders.current).toEqual([]);
      expect(selectedExternalDirPath.current).toBe('');
      expect(focusedExternalSubfolder.current).toBeUndefined();
      expect(renamingExternalSubfolder.current).toBeUndefined();
      expect(deletingExternalSubfolder.current).toBeUndefined();
    });
  });

  describe('hasFolderSupport', () => {
    it('should take a service that lists its folders', () => {
      expect(hasFolderSupport(undefined)).toBe(false);
      expect(hasFolderSupport(allCloudStorageServices.uploadcare)).toBe(false);
      expect(hasFolderSupport(/** @type {any} */ ({ serviceId: 'aws_s3', browse: vi.fn() }))).toBe(
        true,
      );
    });
  });

  describe('browseExternalFolder', () => {
    it('should move to the folder, dropping the focus and selection', () => {
      /** @type {any} */
      const asset = { id: 'a' };

      selectedExternalAssets.current = [asset];
      focusedExternalAsset.current = asset;
      focusedExternalSubfolder.current = { name: '2024', path: '2024' };

      browseExternalFolder('2024/summer');

      expect(selectedExternalDirPath.current).toBe('2024/summer');
      expect(selectedExternalAssets.current).toEqual([]);
      expect(focusedExternalAsset.current).toBeUndefined();
      expect(focusedExternalSubfolder.current).toBeUndefined();

      browseExternalFolder('');
      expect(selectedExternalDirPath.current).toBe('');
    });
  });
});
