import { describe, expect, it } from 'vitest';

import neonObjectStorageService, { getRegionFromEndpoint } from './neon-object-storage';
import { S3CompatibleService } from './service';

describe('integrations/media-libraries/cloud/s3/neon-object-storage', () => {
  const endpoint = 'https://br-cool-darkness-a1b2c3d4.storage.c-1.us-east-2.aws.neon.tech';

  const libOptions = {
    access_key_id: 'nak_live_0123456789abcdef0123456789abcdef',
    bucket: 'my-bucket',
    endpoint,
  };

  it('should have correct service configuration', () => {
    expect(neonObjectStorageService).toBeInstanceOf(S3CompatibleService);
    expect(neonObjectStorageService).toMatchObject({
      serviceType: 'cloud_storage',
      serviceId: 'neon_object_storage',
      serviceLabel: 'Neon Object Storage',
      serviceURL: 'https://neon.com/docs/storage/overview',
      showServiceLink: true,
      hotlinking: true,
      authType: 'api_key',
      developerURL: 'https://neon.com/docs/storage/get-started',
      apiKeyURL: 'https://neon.com/docs/storage/authentication',
      requiredOption: 'endpoint',
    });
  });

  it('should validate secret access key format', () => {
    const { apiKeyPattern } = neonObjectStorageService;

    // Valid secret access keys (`nsk_` + environment label + hex digits)
    expect(apiKeyPattern.test(`nsk_live_${'0123456789abcdef'.repeat(4)}`)).toBe(true);
    expect(apiKeyPattern.test(`nsk_test_${'0123456789ABCDEF'.repeat(2)}`)).toBe(true);

    // Invalid secret access keys
    expect(apiKeyPattern.test(`nak_live_${'0123456789abcdef'.repeat(4)}`)).toBe(false); // key ID
    expect(apiKeyPattern.test(`nt_live_${'0123456789abcdef'.repeat(4)}`)).toBe(false); // API token
    expect(apiKeyPattern.test('nsk_live_0123456789abcdef')).toBe(false); // too short
    expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(false); // AWS key
    expect(apiKeyPattern.test('')).toBe(false);
  });

  describe('getRegionFromEndpoint', () => {
    it('should read the region from a Neon storage endpoint', () => {
      expect(getRegionFromEndpoint(endpoint)).toBe('us-east-2');
      expect(getRegionFromEndpoint(`${endpoint}/`)).toBe('us-east-2');
      expect(
        getRegionFromEndpoint('https://br-a-b-12345678.storage.c-12.ap-southeast-1.aws.neon.tech'),
      ).toBe('ap-southeast-1');
    });

    it('should read the region from an endpoint without a cell', () => {
      expect(
        getRegionFromEndpoint('https://br-a-b-12345678.storage.eu-central-1.aws.neon.tech'),
      ).toBe('eu-central-1');
    });

    it('should return undefined for other URLs', () => {
      expect(getRegionFromEndpoint('')).toBeUndefined();
      expect(getRegionFromEndpoint('https://s3.us-east-2.amazonaws.com')).toBeUndefined();
      expect(
        getRegionFromEndpoint('http://br-a.storage.c-1.us-east-2.aws.neon.tech'),
      ).toBeUndefined();
      expect(
        getRegionFromEndpoint('https://example.com/br-a.storage.c-1.us-east-2.aws.neon.tech'),
      ).toBeUndefined();
      expect(
        getRegionFromEndpoint('https://br-a.storage.c-1.us-east-2.aws.neon.tech.example.com'),
      ).toBeUndefined();
    });
  });

  describe('resolveConfig', () => {
    it('should keep the endpoint and add the region read from it', () => {
      expect(neonObjectStorageService.resolveConfig(libOptions)).toEqual({
        ...libOptions,
        region: 'us-east-2',
        acl: undefined,
      });
    });

    it('should not derive public_url, as the core falls back to the endpoint URL', () => {
      expect(neonObjectStorageService.resolveConfig(libOptions).public_url).toBeUndefined();
    });

    it('should use explicit region and public_url when set in config', () => {
      const options = {
        ...libOptions,
        region: 'us-east-1',
        public_url: 'https://my-cdn.example.com',
      };

      expect(neonObjectStorageService.resolveConfig(options)).toMatchObject({
        endpoint,
        region: 'us-east-1',
        public_url: 'https://my-cdn.example.com',
      });
    });

    it('should leave the region unset when the endpoint is not a Neon storage endpoint', () => {
      const options = { ...libOptions, endpoint: 'https://storage.example.com' };

      expect(neonObjectStorageService.resolveConfig(options).region).toBeUndefined();
    });

    it('should leave the region unset when the endpoint is missing', () => {
      const { endpoint: _endpoint, ...options } = libOptions;

      expect(neonObjectStorageService.resolveConfig(options).region).toBeUndefined();
    });

    it('should never send an object ACL, which Neon does not implement', () => {
      expect(
        neonObjectStorageService.resolveConfig({ ...libOptions, acl: 'public-read' }).acl,
      ).toBeUndefined();
    });
  });

  describe('isConfigured', () => {
    it('should require the access key ID, the bucket and the endpoint', () => {
      const { endpoint: _endpoint, ...withoutEndpoint } = libOptions;
      const { bucket: _bucket, ...withoutBucket } = libOptions;
      const { access_key_id: _accessKeyId, ...withoutKey } = libOptions;

      /**
       * Check whether the service is enabled with the given library options.
       * @param {any} options Library options.
       * @returns {boolean} Result.
       */
      const isConfigured = (options) =>
        neonObjectStorageService.isConfigured(neonObjectStorageService.resolveConfig(options));

      expect(isConfigured(libOptions)).toBe(true);
      expect(isConfigured(withoutEndpoint)).toBe(false);
      expect(isConfigured(withoutBucket)).toBe(false);
      expect(isConfigured(withoutKey)).toBe(false);
      // `region` alone doesn’t enable the service, unlike Amazon S3
      expect(isConfigured({ ...withoutEndpoint, region: 'us-east-2' })).toBe(false);
    });
  });
});
