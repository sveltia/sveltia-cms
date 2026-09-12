import { describe, expect, it } from 'vitest';

import awsS3Service from './aws-s3';
import { S3CompatibleService } from './service';

describe('integrations/media-libraries/cloud/s3/aws-s3', () => {
  const libOptions = {
    access_key_id: 'AKIAIOSFODNN7EXAMPLE',
    bucket: 'my-bucket',
    region: 'us-east-1',
  };

  it('should have correct service configuration', () => {
    expect(awsS3Service).toBeInstanceOf(S3CompatibleService);
    expect(awsS3Service).toMatchObject({
      serviceType: 'cloud_storage',
      serviceId: 'aws_s3',
      serviceLabel: 'Amazon S3',
      serviceURL: 'https://aws.amazon.com/s3/',
      showServiceLink: true,
      hotlinking: true,
      authType: 'api_key',
      developerURL: 'https://docs.aws.amazon.com/s3/',
      apiKeyURL: 'https://console.aws.amazon.com/iam/home#/security_credentials',
      requiredOption: 'region',
    });
  });

  it('should validate secret access key format', () => {
    const { apiKeyPattern } = awsS3Service;

    // Valid secret access keys (40 base64-like chars)
    expect(apiKeyPattern.test('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(true);
    expect(apiKeyPattern.test('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL==')).toBe(true);

    // Invalid secret access keys
    expect(apiKeyPattern.test('AKIAIOSFODNN7EXAMPLE')).toBe(false); // Too short
    expect(apiKeyPattern.test('short')).toBe(false); // Too short
    expect(apiKeyPattern.test('AKIA-IOSFODNN7EXAMPLE')).toBe(false); // Invalid char
    expect(apiKeyPattern.test('ASIAXXXXXXXXXXX')).toBe(false); // Too short
  });

  it('should use the library options as the S3 config', () => {
    expect(awsS3Service.resolveConfig(libOptions)).toEqual(libOptions);
  });
});
