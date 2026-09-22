import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';

import { ObjectStorageService } from './service';

/**
 * @import { ExternalAsset } from '$lib/types/private';
 * @import { AzureMediaLibrary } from '$lib/types/public';
 */

vi.mock('$lib/services/config/state', () => ({
  cmsConfig: { current: undefined },
}));

describe('integrations/media-libraries/cloud/shared/service', () => {
  const libOptions = { account_name: 'account', container: 'media' };
  const fetchOptions = { apiKey: 'secret' };
  const asset = /** @type {ExternalAsset} */ ({ id: 'photo.jpg' });
  const file = new File(['content'], 'photo.jpg');

  const operations = {
    list: vi.fn(async () => []),
    browse: vi.fn(async () => ({ assets: [], folders: [] })),
    search: vi.fn(async () => []),
    upload: vi.fn(async () => []),
    delete: vi.fn(async () => undefined),
    rename: vi.fn(async () => asset),
    replace: vi.fn(async () => asset),
    move: vi.fn(async () => asset),
    createFolder: vi.fn(async () => undefined),
    deleteFolder: vi.fn(async () => undefined),
  };

  const definition = /** @type {const} */ ({
    serviceId: 'azure_blob_storage',
    serviceLabel: 'Test Service',
    serviceURL: 'https://example.com/',
    developerURL: 'https://example.com/docs',
    apiKeyURL: 'https://example.com/keys',
    apiKeyPattern: /^\w+$/,
  });

  /** @type {ObjectStorageService<AzureMediaLibrary>} */
  const service = new ObjectStorageService({
    ...definition,
    /**
     * Check if the container is set.
     * @param {AzureMediaLibrary} config Configuration.
     * @returns {boolean} Result.
     */
    isConfigured: ({ container }) => !!container,
    /**
     * Check if the URL points to the configured account.
     * @param {AzureMediaLibrary} config Configuration.
     * @param {string} url URL.
     * @returns {boolean} Result.
     */
    isConfigURL: (config, url) => url.startsWith(`https://${config.account_name}/`),
    operations,
  });

  beforeEach(() => {
    cmsConfig.current = /** @type {any} */ ({
      media_libraries: { azure_blob_storage: libOptions },
    });
  });

  it('should expose the service definition and the fixed properties', () => {
    expect(service).toMatchObject({
      serviceType: 'cloud_storage',
      showServiceLink: true,
      hotlinking: true,
      authType: 'api_key',
      ...definition,
    });
    expect(service.resolveConfig(libOptions)).toBe(libOptions);
  });

  it('should get the library options from the site or given config', () => {
    expect(service.getLibraryOptions()).toBe(libOptions);
    expect(service.getLibraryOptions(/** @type {any} */ ({}))).toBeUndefined();
  });

  it('should check whether the service is enabled with the resolved config', () => {
    const { isEnabled } = service;

    expect(isEnabled()).toBe(true);
    expect(
      isEnabled(
        /** @type {any} */ ({ media_libraries: { azure_blob_storage: { container: '' } } }),
      ),
    ).toBe(false);

    cmsConfig.current = /** @type {any} */ ({});
    expect(isEnabled()).toBe(false);
  });

  it('should pass the library options through the config resolver', () => {
    const resolveConfig = vi.fn((options) => ({ ...options, endpoint: 'https://test' }));
    const custom = new ObjectStorageService({ ...service, resolveConfig });

    expect(custom.getConfig(fetchOptions)).toEqual({ ...libOptions, endpoint: 'https://test' });
    expect(resolveConfig).toHaveBeenCalledWith(libOptions);
  });

  it('should check whether a URL points to a file on the service', () => {
    const { isAssetURL } = service;

    expect(isAssetURL('https://account/photo.jpg')).toBe(true);
    expect(isAssetURL('https://example.com/photo.jpg')).toBe(false);

    cmsConfig.current = /** @type {any} */ ({});
    expect(isAssetURL('https://account/photo.jpg')).toBe(false);
  });

  it('should call the operations with the resolved config', async () => {
    const { list, browse, search, upload, rename, replace, move, createFolder, deleteFolder } =
      service;

    await list(fetchOptions);
    expect(operations.list).toHaveBeenCalledWith(libOptions, fetchOptions);
    await browse(fetchOptions);
    expect(operations.browse).toHaveBeenCalledWith(libOptions, fetchOptions);
    await search('photo', fetchOptions);
    expect(operations.search).toHaveBeenCalledWith('photo', libOptions, fetchOptions);
    await upload([file], fetchOptions);
    expect(operations.upload).toHaveBeenCalledWith([file], libOptions, fetchOptions);
    await service.delete([asset], fetchOptions);
    expect(operations.delete).toHaveBeenCalledWith([asset], libOptions, fetchOptions);
    await rename(asset, 'new.jpg', fetchOptions);
    expect(operations.rename).toHaveBeenCalledWith(asset, 'new.jpg', libOptions, fetchOptions);
    await replace(asset, file, fetchOptions);
    expect(operations.replace).toHaveBeenCalledWith(asset, file, libOptions, fetchOptions);
    await move(asset, '2024/photo.jpg', fetchOptions);
    expect(operations.move).toHaveBeenCalledWith(asset, '2024/photo.jpg', libOptions, fetchOptions);
    await createFolder('2024', fetchOptions);
    expect(operations.createFolder).toHaveBeenCalledWith('2024', libOptions, fetchOptions);
    await deleteFolder('2024', fetchOptions);
    expect(operations.deleteFolder).toHaveBeenCalledWith('2024', libOptions, fetchOptions);
  });

  it('should reject when the service is not configured', async () => {
    cmsConfig.current = /** @type {any} */ ({});

    await expect(service.list(fetchOptions)).rejects.toThrow(
      'Test Service configuration is not available',
    );
    expect(operations.list).not.toHaveBeenCalled();
  });
});
