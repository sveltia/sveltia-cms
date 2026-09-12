import { describe, expect, it } from 'vitest';

import scalewayObjectStorageService from './scaleway';
import { S3CompatibleService } from './service';

describe('integrations/media-libraries/cloud/s3/scaleway-object-storage', () => {
  const libOptions = {
    access_key_id: 'SCWXXXXXXXXXXXXXXXXX',
    bucket: 'my-bucket',
    region: 'fr-par',
  };

  it('should have correct service configuration', () => {
    expect(scalewayObjectStorageService).toBeInstanceOf(S3CompatibleService);
    expect(scalewayObjectStorageService).toMatchObject({
      serviceType: 'cloud_storage',
      serviceId: 'scaleway_object_storage',
      serviceLabel: 'Scaleway Object Storage',
      serviceURL: 'https://www.scaleway.com/en/object-storage/',
      showServiceLink: true,
      hotlinking: true,
      authType: 'api_key',
      developerURL: 'https://www.scaleway.com/en/docs/object-storage/',
      apiKeyURL: 'https://console.scaleway.com/iam/api-keys',
      requiredOption: 'region',
    });
  });

  it('should validate secret access key format', () => {
    const { apiKeyPattern } = scalewayObjectStorageService;

    // Valid secret access keys (UUID v4 format)
    expect(apiKeyPattern.test('12345678-1234-4234-a234-123456789abc')).toBe(true);
    expect(apiKeyPattern.test('00000000-0000-4000-8000-000000000000')).toBe(true);
    expect(apiKeyPattern.test('ffffffff-ffff-4fff-bfff-ffffffffffff')).toBe(true);

    // Invalid secret access keys
    expect(apiKeyPattern.test('abcdef1234')).toBe(false); // too short
    expect(apiKeyPattern.test('12345678-1234-3234-a234-123456789abc')).toBe(false); // wrong version
    expect(apiKeyPattern.test('12345678-1234-4234-c234-123456789abc')).toBe(false); // wrong variant
    expect(apiKeyPattern.test('12345678-1234-4234-a234-123456789abcZZ')).toBe(false); // too long
    expect(apiKeyPattern.test('')).toBe(false);
  });

  describe('resolveConfig', () => {
    it('should use path-style region endpoint and derive virtual-hosted public_url', () => {
      expect(scalewayObjectStorageService.resolveConfig(libOptions)).toEqual({
        ...libOptions,
        endpoint: 'https://s3.fr-par.scw.cloud',
        public_url: 'https://my-bucket.s3.fr-par.scw.cloud',
      });
    });

    it('should use explicit public_url when set in config', () => {
      const options = { ...libOptions, public_url: 'https://my-cdn.example.com' };

      expect(scalewayObjectStorageService.resolveConfig(options)).toMatchObject({
        endpoint: 'https://s3.fr-par.scw.cloud',
        public_url: 'https://my-cdn.example.com',
      });
    });
  });
});
