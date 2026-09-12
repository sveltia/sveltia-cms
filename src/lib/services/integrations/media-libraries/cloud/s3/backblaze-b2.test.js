import { describe, expect, it } from 'vitest';

import backblazeB2Service from './backblaze-b2';
import { S3CompatibleService } from './service';

describe('integrations/media-libraries/cloud/s3/backblaze-b2', () => {
  const libOptions = {
    access_key_id: '0012345678901234567890123',
    bucket: 'my-bucket',
    region: 'us-west-004',
  };

  it('should have correct service configuration', () => {
    expect(backblazeB2Service).toBeInstanceOf(S3CompatibleService);
    expect(backblazeB2Service).toMatchObject({
      serviceType: 'cloud_storage',
      serviceId: 'backblaze_b2',
      serviceLabel: 'Backblaze B2',
      serviceURL: 'https://www.backblaze.com/cloud-storage',
      showServiceLink: true,
      hotlinking: true,
      authType: 'api_key',
      developerURL: 'https://www.backblaze.com/docs/cloud-storage-s3-compatible-api',
      apiKeyURL: 'https://secure.backblaze.com/app_keys.htm',
      requiredOption: 'region',
    });
  });

  it('should validate application key format', () => {
    const { apiKeyPattern } = backblazeB2Service;

    // Valid application keys (30+ alphanumeric/base64 chars)
    expect(apiKeyPattern.test('K001abcdefghijklmnopqrstuvwxyz01')).toBe(true);
    expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
    expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(true);

    // Invalid application keys
    expect(apiKeyPattern.test('tooshort')).toBe(false); // too short
    expect(apiKeyPattern.test('abcdef-1234567890abcdef1234567890')).toBe(false); // invalid char
    expect(apiKeyPattern.test('')).toBe(false);
  });

  describe('resolveConfig', () => {
    it('should use path-style region endpoint, disable ACLs and derive virtual-hosted public_url', () => {
      expect(backblazeB2Service.resolveConfig(libOptions)).toEqual({
        ...libOptions,
        endpoint: 'https://s3.us-west-004.backblazeb2.com',
        acl: false,
        public_url: 'https://my-bucket.s3.us-west-004.backblazeb2.com',
      });
    });

    it('should use explicit public_url when set in config', () => {
      const options = { ...libOptions, public_url: 'https://my-cdn.example.com' };

      expect(backblazeB2Service.resolveConfig(options)).toMatchObject({
        endpoint: 'https://s3.us-west-004.backblazeb2.com',
        public_url: 'https://my-cdn.example.com',
      });
    });
  });
});
