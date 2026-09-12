import { describe, expect, it } from 'vitest';

import { S3CompatibleService } from './service';
import supabaseStorageService from './supabase';

describe('integrations/media-libraries/cloud/s3/supabase-storage', () => {
  const mockProjectId = 'abcdefghijklmnopqrst';

  const libOptions = {
    access_key_id: 'abcdef1234567890abcdef1234567890',
    bucket: 'my-bucket',
    project_id: mockProjectId,
  };

  it('should have correct service configuration', () => {
    expect(supabaseStorageService).toBeInstanceOf(S3CompatibleService);
    expect(supabaseStorageService).toMatchObject({
      serviceType: 'cloud_storage',
      serviceId: 'supabase_storage',
      serviceLabel: 'Supabase Storage',
      serviceURL: 'https://supabase.com/storage',
      showServiceLink: true,
      hotlinking: true,
      authType: 'api_key',
      developerURL: 'https://supabase.com/docs/guides/storage',
      apiKeyURL: 'https://supabase.com/dashboard/project/_/storage/settings',
      requiredOption: 'project_id',
    });
  });

  it('should validate secret access key format', () => {
    const { apiKeyPattern } = supabaseStorageService;

    // Valid secret access keys (40+ base64-like chars)
    expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyz1234567890ABCD')).toBe(true);
    expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(true);
    expect(apiKeyPattern.test('a/b+c=1234567890123456789012345678901234')).toBe(true);

    // Invalid secret access keys
    expect(apiKeyPattern.test('short')).toBe(false); // too short
    expect(apiKeyPattern.test('abcdef-1234567890abcdef12345')).toBe(false); // invalid char
    expect(apiKeyPattern.test('')).toBe(false);
  });

  describe('resolveConfig', () => {
    it('should use the Supabase S3 endpoint and derive public_url with bucket path', () => {
      expect(supabaseStorageService.resolveConfig(libOptions)).toEqual({
        ...libOptions,
        endpoint: `https://${mockProjectId}.storage.supabase.co/storage/v1/s3`,
        public_url: `https://${mockProjectId}.supabase.co/storage/v1/object/public/my-bucket`,
      });
    });

    it('should use explicit public_url when set in config', () => {
      const options = { ...libOptions, public_url: 'https://my-cdn.example.com' };

      expect(supabaseStorageService.resolveConfig(options)).toMatchObject({
        endpoint: `https://${mockProjectId}.storage.supabase.co/storage/v1/s3`,
        public_url: 'https://my-cdn.example.com',
      });
    });
  });
});
