import { afterEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';

import bunnyStorageService from './bunny-storage';
import { S3CompatibleService } from './service';

vi.mock('$lib/services/config/state', () => ({
  cmsConfig: { current: undefined },
}));

describe('integrations/media-libraries/cloud/s3/bunny-storage', () => {
  const libOptions = {
    access_key_id: 'my-zone',
    bucket: 'my-zone',
    region: 'de',
  };

  it('should have correct service configuration', () => {
    expect(bunnyStorageService).toBeInstanceOf(S3CompatibleService);
    expect(bunnyStorageService).toMatchObject({
      serviceType: 'cloud_storage',
      serviceId: 'bunny_storage',
      serviceLabel: 'Bunny Storage',
      serviceURL: 'https://bunny.net/storage/',
      showServiceLink: true,
      hotlinking: true,
      authType: 'api_key',
      developerURL: 'https://bunny.net/docs/storage/s3',
      apiKeyURL: 'https://dash.bunny.net/storage',
      requiredOption: 'region',
    });
  });

  it('should validate storage zone password format', () => {
    const { apiKeyPattern } = bunnyStorageService;

    // Valid storage zone passwords (hyphen-separated hex groups)
    expect(apiKeyPattern.test('a2350e09-57ec-3f4e-d7a38d0858a6-a5c7-47aa')).toBe(true);
    expect(apiKeyPattern.test('A2350E09-57EC-3F4E-D7A38D0858A6-A5C7-47AA')).toBe(true); // upper
    expect(apiKeyPattern.test('a2350e09-57ec-3f4e-a5c7-d7a38d0858a6')).toBe(true); // UUID-like
    expect(apiKeyPattern.test('a2350e09-57ec-3f4e-d7a38d0858a6-a5c7-47aa-1234-5678')).toBe(true);

    // Invalid storage zone passwords
    expect(apiKeyPattern.test('a2350e0957ec3f4ed7a38d0858a6a5c747aa')).toBe(false); // no hyphens
    expect(apiKeyPattern.test('a2350e09-57ec-3f4e')).toBe(false); // too few groups
    expect(apiKeyPattern.test('a2350e09-57ec-3f4e-d7a38d0858a6-a5c7-47ag')).toBe(false); // non-hex
    expect(apiKeyPattern.test('a2350e09--57ec-3f4e-d7a38d0858a6-a5c7-47aa')).toBe(false); // empty
    expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(false);
    expect(apiKeyPattern.test('')).toBe(false);
  });

  describe('isEnabled', () => {
    afterEach(() => {
      cmsConfig.current = undefined;
    });

    it('should be enabled without access_key_id, as it defaults to bucket', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: { bunny_storage: { bucket: 'my-zone', region: 'de' } },
      });

      expect(bunnyStorageService.isEnabled()).toBe(true);
    });

    it('should be disabled without bucket or region', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: { bunny_storage: { region: 'de' } },
      });
      expect(bunnyStorageService.isEnabled()).toBe(false);

      cmsConfig.current = /** @type {any} */ ({
        media_libraries: { bunny_storage: { bucket: 'my-zone' } },
      });
      expect(bunnyStorageService.isEnabled()).toBe(false);
    });
  });

  describe('resolveConfig', () => {
    it('should use path-style region endpoint and disable ACLs', () => {
      expect(bunnyStorageService.resolveConfig(libOptions)).toEqual({
        ...libOptions,
        endpoint: 'https://de-s3.storage.bunnycdn.com',
        acl: false,
      });
    });

    it('should default access_key_id to the storage zone name (bucket)', () => {
      const { access_key_id: accessKeyId, ...options } = libOptions;

      expect(accessKeyId).toBe('my-zone');
      expect(bunnyStorageService.resolveConfig(options)).toEqual({
        ...options,
        access_key_id: 'my-zone',
        endpoint: 'https://de-s3.storage.bunnycdn.com',
        acl: false,
      });
    });

    it('should keep an explicit access_key_id', () => {
      const options = { ...libOptions, access_key_id: 'other-zone' };

      expect(bunnyStorageService.resolveConfig(options).access_key_id).toBe('other-zone');
    });

    it('should not derive public_url, as the storage endpoint requires authentication', () => {
      expect(bunnyStorageService.resolveConfig(libOptions).public_url).toBeUndefined();
    });

    it('should keep explicit public_url when set in config', () => {
      const options = { ...libOptions, region: 'syd', public_url: 'https://my-zone.b-cdn.net' };

      expect(bunnyStorageService.resolveConfig(options)).toMatchObject({
        endpoint: 'https://syd-s3.storage.bunnycdn.com',
        public_url: 'https://my-zone.b-cdn.net',
      });
    });
  });
});
