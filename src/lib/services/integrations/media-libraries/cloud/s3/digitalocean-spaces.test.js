import { describe, expect, it } from 'vitest';

import digitalOceanSpacesService from './digitalocean-spaces';
import { S3CompatibleService } from './service';

describe('integrations/media-libraries/cloud/s3/digitalocean-spaces', () => {
  const libOptions = {
    access_key_id: 'DO00ABCDEFGHIJKLMNOP',
    bucket: 'my-space',
    region: 'nyc3',
  };

  it('should have correct service configuration', () => {
    expect(digitalOceanSpacesService).toBeInstanceOf(S3CompatibleService);
    expect(digitalOceanSpacesService).toMatchObject({
      serviceType: 'cloud_storage',
      serviceId: 'digitalocean_spaces',
      serviceLabel: 'DigitalOcean Spaces',
      serviceURL: 'https://www.digitalocean.com/products/spaces',
      showServiceLink: true,
      hotlinking: true,
      authType: 'api_key',
      developerURL: 'https://docs.digitalocean.com/products/spaces/',
      apiKeyURL: 'https://cloud.digitalocean.com/account/api/spaces',
      requiredOption: 'region',
    });
  });

  it('should validate secret access key format', () => {
    const { apiKeyPattern } = digitalOceanSpacesService;

    // Valid secret access keys (43 base64-like chars)
    expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG')).toBe(true);
    expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY/AB')).toBe(true);

    // Invalid secret access keys
    expect(apiKeyPattern.test('abcd1234efgh5678ijkl')).toBe(false); // too short
    expect(apiKeyPattern.test('ABCD1234')).toBe(false); // too short
    expect(apiKeyPattern.test('ABCD-1234-EFGH-5678-IJKL')).toBe(false); // invalid char
    expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyz1234567890ABCD')).toBe(false); // 40 chars (wrong length)
  });

  describe('resolveConfig', () => {
    it('should use path-style region endpoint and derive virtual-hosted public_url', () => {
      expect(digitalOceanSpacesService.resolveConfig(libOptions)).toEqual({
        ...libOptions,
        endpoint: 'https://nyc3.digitaloceanspaces.com',
        public_url: 'https://my-space.nyc3.digitaloceanspaces.com',
      });
    });

    it('should use explicit public_url when set in config', () => {
      const options = { ...libOptions, public_url: 'https://my-cdn.example.com' };

      expect(digitalOceanSpacesService.resolveConfig(options)).toMatchObject({
        endpoint: 'https://nyc3.digitaloceanspaces.com',
        public_url: 'https://my-cdn.example.com',
      });
    });
  });
});
