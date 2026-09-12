import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';

import {
  deleteS3Objects,
  isS3ObjectUrl,
  listS3Objects,
  renameS3Object,
  replaceS3Object,
  searchS3Objects,
  uploadToS3,
} from './core';
import { S3CompatibleService } from './service';

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { S3MediaLibrary } from '$lib/types/public';
 */

vi.mock('$lib/services/config/state', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('./core', () => ({
  listS3Objects: vi.fn(),
  searchS3Objects: vi.fn(),
  uploadToS3: vi.fn(),
  deleteS3Objects: vi.fn(),
  renameS3Object: vi.fn(),
  replaceS3Object: vi.fn(),
  isS3ObjectUrl: vi.fn(() => true),
}));

describe('integrations/media-libraries/cloud/s3/service', () => {
  const mockAccessKeyId = 'AKIAIOSFODNN7EXAMPLE';
  const mockBucket = 'my-bucket';
  const mockRegion = 'us-east-1';
  const libOptions = { access_key_id: mockAccessKeyId, bucket: mockBucket, region: mockRegion };

  const definition = /** @type {const} */ ({
    serviceId: 'aws_s3',
    serviceLabel: 'Test Service',
    serviceURL: 'https://example.com/',
    developerURL: 'https://example.com/docs',
    apiKeyURL: 'https://example.com/keys',
    apiKeyPattern: /^[A-Za-z0-9]{40}$/,
  });

  const service = new S3CompatibleService(definition);
  const fetchOptions = { kind: undefined, apiKey: 'secret', fieldConfig: undefined };

  beforeEach(() => {
    cmsConfig.current = /** @type {any} */ ({ media_libraries: { aws_s3: libOptions } });
  });

  describe('constructor', () => {
    it('should expose the fixed properties shared by S3-compatible services', () => {
      expect(service).toMatchObject({
        serviceType: 'cloud_storage',
        showServiceLink: true,
        hotlinking: true,
        authType: 'api_key',
        ...definition,
      });
    });

    it('should require region by default and use library options as the config', () => {
      expect(service.requiredOption).toBe('region');
      expect(service.resolveConfig(libOptions)).toBe(libOptions);
    });

    it('should accept a custom required option and config resolver', () => {
      const resolveConfig = vi.fn((options) => ({ ...options, endpoint: 'https://s3.test' }));

      const custom = new S3CompatibleService({
        ...definition,
        requiredOption: 'account_id',
        resolveConfig,
      });

      expect(custom.requiredOption).toBe('account_id');
      expect(custom.resolveConfig).toBe(resolveConfig);
    });
  });

  describe('getLibraryOptions', () => {
    it('should return options from media_libraries', () => {
      expect(service.getLibraryOptions()).toEqual(libOptions);
    });

    it('should return options from the given field config', () => {
      const fieldOptions = { ...libOptions, bucket: 'field-bucket' };

      expect(
        service.getLibraryOptions(
          /** @type {any} */ ({ widget: 'image', media_libraries: { aws_s3: fieldOptions } }),
        ),
      ).toEqual(fieldOptions);
    });

    it('should return options from the legacy media_library format', () => {
      cmsConfig.current = /** @type {any} */ ({ media_library: { name: 'aws_s3', ...libOptions } });

      expect(service.getLibraryOptions()).toEqual({ name: 'aws_s3', ...libOptions });
    });

    it('should return false when the library is explicitly disabled', () => {
      cmsConfig.current = /** @type {any} */ ({ media_libraries: { aws_s3: false } });

      expect(service.getLibraryOptions()).toBe(false);
    });

    it('should return undefined when neither media_libraries nor matching media_library exists', () => {
      cmsConfig.current = /** @type {any} */ ({ media_library: { name: 'other_service' } });

      expect(service.getLibraryOptions()).toBeUndefined();
    });

    it('should return undefined when the config is not loaded', () => {
      cmsConfig.current = undefined;

      expect(service.getLibraryOptions()).toBeUndefined();
    });
  });

  describe('isEnabled', () => {
    it('should return true when valid config is present', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when config is missing', () => {
      cmsConfig.current = /** @type {any} */ ({});

      expect(service.isEnabled()).toBe(false);
    });

    it('should return false when access_key_id, bucket or the required option is missing', () => {
      const { access_key_id: accessKeyId, bucket, region } = libOptions;

      cmsConfig.current = /** @type {any} */ ({ media_libraries: { aws_s3: { bucket, region } } });
      expect(service.isEnabled()).toBe(false);

      cmsConfig.current = /** @type {any} */ ({
        media_libraries: { aws_s3: { access_key_id: accessKeyId, region } },
      });
      expect(service.isEnabled()).toBe(false);

      cmsConfig.current = /** @type {any} */ ({
        media_libraries: { aws_s3: { access_key_id: accessKeyId, bucket } },
      });
      expect(service.isEnabled()).toBe(false);
    });

    it('should check the custom required option', () => {
      const custom = new S3CompatibleService({ ...definition, requiredOption: 'account_id' });

      expect(custom.isEnabled()).toBe(false);

      cmsConfig.current = /** @type {any} */ ({
        media_libraries: { aws_s3: { ...libOptions, account_id: 'account' } },
      });
      expect(custom.isEnabled()).toBe(true);
    });

    it('should prefer field-level config over global config', () => {
      cmsConfig.current = /** @type {any} */ ({});

      const fieldConfig = /** @type {any} */ ({
        widget: 'file',
        media_libraries: { aws_s3: libOptions },
      });

      expect(service.isEnabled(fieldConfig)).toBe(true);

      cmsConfig.current = /** @type {any} */ ({ media_libraries: { aws_s3: libOptions } });
      expect(service.isEnabled(/** @type {any} */ ({ widget: 'file' }))).toBe(true);
      expect(service.isEnabled(fieldConfig)).toBe(true);
    });

    it('should return false when field-level config has missing credentials', () => {
      cmsConfig.current = /** @type {any} */ ({});

      expect(
        service.isEnabled(/** @type {any} */ ({ widget: 'file', media_libraries: { aws_s3: {} } })),
      ).toBe(false);
    });

    it('should work when destructured from the service', () => {
      const { isEnabled } = service;

      expect(isEnabled()).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should resolve the global config', () => {
      expect(service.getConfig(fetchOptions)).toEqual(libOptions);
    });

    it('should resolve the field-level config when provided', () => {
      const fieldOptions = { ...libOptions, bucket: 'field-bucket' };

      expect(
        service.getConfig({
          ...fetchOptions,
          fieldConfig: /** @type {any} */ ({
            widget: 'image',
            media_libraries: { aws_s3: fieldOptions },
          }),
        }),
      ).toEqual(fieldOptions);
    });

    it('should pass the library options through the config resolver', () => {
      const custom = new S3CompatibleService({
        ...definition,
        /**
         * Add an endpoint and disable ACLs.
         * @param {S3MediaLibrary} options Library options.
         * @returns {S3Config} Resolved configuration.
         */
        resolveConfig: (options) => ({ ...options, endpoint: 'https://s3.test', acl: false }),
      });

      expect(custom.getConfig(fetchOptions)).toEqual({
        ...libOptions,
        endpoint: 'https://s3.test',
        acl: false,
      });
    });

    it('should throw with the service label when config is not available', () => {
      cmsConfig.current = /** @type {any} */ ({});

      expect(() => service.getConfig(fetchOptions)).toThrow(
        'Test Service configuration is not available',
      );
    });
  });

  describe('operations', () => {
    /** @type {any} */
    const asset = { id: 'photo.jpg', fileName: 'photo.jpg' };
    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    it('should call listS3Objects with the resolved config', async () => {
      vi.mocked(listS3Objects).mockResolvedValue([asset]);

      await expect(service.list(fetchOptions)).resolves.toEqual([asset]);
      expect(listS3Objects).toHaveBeenCalledWith(libOptions, fetchOptions);
    });

    it('should call searchS3Objects with the resolved config', async () => {
      vi.mocked(searchS3Objects).mockResolvedValue([asset]);

      await expect(service.search('photo', fetchOptions)).resolves.toEqual([asset]);
      expect(searchS3Objects).toHaveBeenCalledWith('photo', libOptions, fetchOptions);
    });

    it('should call uploadToS3 with the resolved config', async () => {
      vi.mocked(uploadToS3).mockResolvedValue([asset]);

      await expect(service.upload([file], fetchOptions)).resolves.toEqual([asset]);
      expect(uploadToS3).toHaveBeenCalledWith([file], libOptions, fetchOptions);
    });

    it('should call deleteS3Objects with the resolved config', async () => {
      await service.delete([asset], fetchOptions);

      expect(deleteS3Objects).toHaveBeenCalledWith([asset], libOptions, fetchOptions);
    });

    it('should call renameS3Object with the resolved config', async () => {
      vi.mocked(renameS3Object).mockResolvedValue(asset);

      await expect(service.rename(asset, 'renamed.jpg', fetchOptions)).resolves.toBe(asset);
      expect(renameS3Object).toHaveBeenCalledWith(asset, 'renamed.jpg', libOptions, fetchOptions);
    });

    it('should call replaceS3Object with the resolved config', async () => {
      vi.mocked(replaceS3Object).mockResolvedValue(asset);

      await expect(service.replace(asset, file, fetchOptions)).resolves.toBe(asset);
      expect(replaceS3Object).toHaveBeenCalledWith(asset, file, libOptions, fetchOptions);
    });

    it('should reject when config is not available', async () => {
      cmsConfig.current = /** @type {any} */ ({});

      const message = 'Test Service configuration is not available';

      await expect(service.list(fetchOptions)).rejects.toThrow(message);
      await expect(service.search('photo', fetchOptions)).rejects.toThrow(message);
      await expect(service.upload([file], fetchOptions)).rejects.toThrow(message);
      await expect(service.delete([asset], fetchOptions)).rejects.toThrow(message);
      await expect(service.rename(asset, 'renamed.jpg', fetchOptions)).rejects.toThrow(message);
      await expect(service.replace(asset, file, fetchOptions)).rejects.toThrow(message);
      expect(listS3Objects).not.toHaveBeenCalled();
    });

    it('should work when destructured from the service', async () => {
      const { list, delete: deleteFiles } = service;

      await list(fetchOptions);
      await deleteFiles([asset], fetchOptions);

      expect(listS3Objects).toHaveBeenCalledWith(libOptions, fetchOptions);
      expect(deleteS3Objects).toHaveBeenCalledWith([asset], libOptions, fetchOptions);
    });
  });

  describe('isAssetURL', () => {
    it('should check the URL against the resolved config', () => {
      const { isAssetURL } = service;

      expect(isAssetURL('https://example.com/a.jpg')).toBe(true);
      expect(isS3ObjectUrl).toHaveBeenCalledWith(libOptions, 'https://example.com/a.jpg');
    });

    it('should be false when the service is not configured', () => {
      cmsConfig.current = /** @type {any} */ ({});

      expect(service.isAssetURL('https://example.com/a.jpg')).toBe(false);
      expect(isS3ObjectUrl).not.toHaveBeenCalled();
    });
  });
});
