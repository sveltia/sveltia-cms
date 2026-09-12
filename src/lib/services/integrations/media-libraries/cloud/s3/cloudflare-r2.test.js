import { describe, expect, it } from 'vitest';

import cloudflareR2Service from './cloudflare-r2';
import { S3CompatibleService } from './service';

describe('integrations/media-libraries/cloud/s3/cloudflare-r2', () => {
  const mockAccountId = 'abcdef1234567890abcdef1234567890';

  const libOptions = {
    access_key_id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    bucket: 'my-bucket',
    account_id: mockAccountId,
  };

  it('should have correct service configuration', () => {
    expect(cloudflareR2Service).toBeInstanceOf(S3CompatibleService);
    expect(cloudflareR2Service).toMatchObject({
      serviceType: 'cloud_storage',
      serviceId: 'cloudflare_r2',
      serviceLabel: 'Cloudflare R2',
      serviceURL: 'https://www.cloudflare.com/developer-platform/r2/',
      showServiceLink: true,
      hotlinking: true,
      authType: 'api_key',
      developerURL: 'https://developers.cloudflare.com/r2/',
      apiKeyURL: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens',
      requiredOption: 'account_id',
    });
  });

  it('should validate secret access key format', () => {
    const { apiKeyPattern } = cloudflareR2Service;

    // Valid secret access keys (40+ base64-like chars)
    expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyz1234567890ABCD')).toBe(true);
    expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(true);
    expect(apiKeyPattern.test('a/b+c=1234567890123456789012345678901234')).toBe(true);

    // Invalid secret access keys
    expect(apiKeyPattern.test('abcdef123456')).toBe(false); // too short
    expect(apiKeyPattern.test('abcdef-1234567890abcdef12345')).toBe(false); // invalid char
    expect(apiKeyPattern.test('')).toBe(false);
  });

  describe('resolveConfig', () => {
    it('should use the R2 endpoint and auto region', () => {
      expect(cloudflareR2Service.resolveConfig(libOptions)).toEqual({
        ...libOptions,
        endpoint: `https://${mockAccountId}.r2.cloudflarestorage.com`,
        region: 'auto',
      });
    });

    it('should use the EU jurisdiction endpoint when jurisdiction is "eu"', () => {
      expect(
        cloudflareR2Service.resolveConfig({ ...libOptions, jurisdiction: 'eu' }),
      ).toMatchObject({
        endpoint: `https://${mockAccountId}.eu.r2.cloudflarestorage.com`,
        region: 'auto',
      });
    });

    it('should use the FedRAMP jurisdiction endpoint when jurisdiction is "fedramp"', () => {
      expect(
        cloudflareR2Service.resolveConfig({ ...libOptions, jurisdiction: 'fedramp' }),
      ).toMatchObject({
        endpoint: `https://${mockAccountId}.fedramp.r2.cloudflarestorage.com`,
      });
    });

    it('should use the global endpoint when jurisdiction is "default"', () => {
      expect(
        cloudflareR2Service.resolveConfig({ ...libOptions, jurisdiction: 'default' }),
      ).toMatchObject({
        endpoint: `https://${mockAccountId}.r2.cloudflarestorage.com`,
      });
    });

    it('should fall back to the global endpoint for an unknown jurisdiction value', () => {
      expect(
        cloudflareR2Service.resolveConfig({
          ...libOptions,
          jurisdiction: /** @type {any} */ ('unknown'),
        }),
      ).toMatchObject({
        endpoint: `https://${mockAccountId}.r2.cloudflarestorage.com`,
      });
    });

    it('should pass public_url through when set in config', () => {
      expect(
        cloudflareR2Service.resolveConfig({
          ...libOptions,
          public_url: 'https://pub-abc123.r2.dev',
        }),
      ).toMatchObject({ public_url: 'https://pub-abc123.r2.dev' });
    });
  });
});
