import { afterEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';

import neonService from './neon-object-storage';
import { S3CompatibleService } from './service';

vi.mock('$lib/services/config/state', () => ({
  cmsConfig: { current: undefined },
}));

describe('integrations/media-libraries/cloud/s3/neon-object-storage', () => {
  const endpoint = 'https://br-cool-darkness-a1b2c3d4.storage.c-1.us-east-2.aws.neon.tech';

  const libOptions = {
    access_key_id: 'nak_live_0123456789abcdef0123456789abcdef',
    bucket: 'media',
    endpoint,
  };

  it('should have correct service configuration', () => {
    expect(neonService).toBeInstanceOf(S3CompatibleService);
    expect(neonService).toMatchObject({
      serviceType: 'cloud_storage',
      serviceId: 'neon_object_storage',
      serviceLabel: 'Neon Object Storage',
      serviceURL: 'https://neon.com/docs/storage/overview',
      showServiceLink: true,
      hotlinking: true,
      authType: 'api_key',
      developerURL: 'https://neon.com/docs/storage/s3-compatibility',
      apiKeyURL: 'https://neon.com/docs/storage/authentication',
      requiredOption: 'endpoint',
    });
  });

  it('should validate secret access key format', () => {
    const { apiKeyPattern } = neonService;
    const hex = '0123456789abcdef'.repeat(4);

    // Valid secret access keys
    expect(apiKeyPattern.test(`nsk_live_${hex}`)).toBe(true);

    // Invalid secret access keys
    expect(apiKeyPattern.test(`nsk_live_${hex.slice(1)}`)).toBe(false); // too short
    expect(apiKeyPattern.test(`nsk_live_${hex}0`)).toBe(false); // too long
    expect(apiKeyPattern.test(`nsk_live_${hex.toUpperCase()}`)).toBe(false); // upper case
    expect(apiKeyPattern.test(`nak_live_${hex}`)).toBe(false); // access key ID prefix
    expect(apiKeyPattern.test(hex)).toBe(false); // no prefix
    expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(false);
    expect(apiKeyPattern.test('')).toBe(false);
  });

  describe('isEnabled', () => {
    afterEach(() => {
      cmsConfig.current = undefined;
    });

    it('should be enabled with access_key_id, bucket and a Neon endpoint', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: { neon_object_storage: libOptions },
      });

      expect(neonService.isEnabled()).toBe(true);
    });

    it('should be disabled without endpoint', () => {
      const { endpoint: _endpoint, ...options } = libOptions;

      cmsConfig.current = /** @type {any} */ ({
        media_libraries: { neon_object_storage: options },
      });

      expect(neonService.isEnabled()).toBe(false);
    });

    it('should be disabled with an endpoint on another host', () => {
      cmsConfig.current = /** @type {any} */ ({
        media_libraries: {
          neon_object_storage: { ...libOptions, endpoint: 'https://s3.example.com' },
        },
      });

      expect(neonService.isEnabled()).toBe(false);
    });
  });

  describe('resolveConfig', () => {
    it('should take the region from the endpoint hostname', () => {
      expect(neonService.resolveConfig(libOptions)).toEqual({
        ...libOptions,
        region: 'us-east-2',
        acl: undefined,
      });
    });

    it('should take the region from an endpoint hostname without a cell', () => {
      const options = {
        ...libOptions,
        endpoint: 'https://br-cool-darkness-a1b2c3d4.storage.eu-central-1.aws.neon.tech',
      };

      expect(neonService.resolveConfig(options)).toMatchObject({
        endpoint: options.endpoint,
        region: 'eu-central-1',
      });
    });

    it('should keep an explicit region', () => {
      const options = { ...libOptions, region: 'us-east-1' };

      expect(neonService.resolveConfig(options).region).toBe('us-east-1');
    });

    it('should normalize the endpoint to its origin', () => {
      const options = { ...libOptions, endpoint: `${endpoint.toUpperCase()}/path/?query#hash` };

      expect(neonService.resolveConfig(options).endpoint).toBe(endpoint);
    });

    it('should never send an object ACL, which Neon does not implement', () => {
      expect(neonService.resolveConfig({ ...libOptions, acl: 'public-read' }).acl).toBeUndefined();
    });

    it('should keep public_url when set in config', () => {
      const options = { ...libOptions, public_url: 'https://cdn.example.com' };

      expect(neonService.resolveConfig(options).public_url).toBe('https://cdn.example.com');
    });

    it.each([
      ['a missing endpoint', undefined],
      ['an invalid URL', 'not a url'],
      ['an HTTP URL', endpoint.replace('https:', 'http:')],
      ['a URL with a port', `${endpoint}:8443`],
      ['a URL with credentials on another host', `https://user@evil.example.com/${endpoint}`],
      ['a non-Neon host', 'https://s3.us-east-2.amazonaws.com'],
      ['a lookalike host', `${endpoint}.example.com`],
      ['a host without a region', 'https://br-cool-darkness-a1b2c3d4.storage.aws.neon.tech'],
      [
        'a host with a cell but no region',
        'https://br-cool-darkness-a1b2c3d4.storage.c-1.aws.neon.tech',
      ],
      ['a host outside storage', 'https://ep-cool-darkness-a1b2c3d4.c-1.us-east-2.aws.neon.tech'],
    ])('should drop %s, so the service is disabled', (_label, value) => {
      const config = neonService.resolveConfig({ ...libOptions, endpoint: value });

      expect(config.endpoint).toBeUndefined();
      expect(config.region).toBeUndefined();
    });
  });
});
