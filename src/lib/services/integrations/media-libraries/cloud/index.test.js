import { describe, expect, test } from 'vitest';

import { allCloudStorageServices } from './index.js';

describe('Cloud storage services', () => {
  test('should export allCloudStorageServices', () => {
    expect(allCloudStorageServices).toBeDefined();
    expect(typeof allCloudStorageServices).toBe('object');
  });

  test('should be an empty object', () => {
    expect(Object.keys(allCloudStorageServices)).toHaveLength(2);
  });

  test('should include cloudinary service', () => {
    expect(Object.keys(allCloudStorageServices)).toContain('cloudinary');
    expect(allCloudStorageServices.cloudinary).toBeDefined();
    expect(allCloudStorageServices.cloudinary.serviceType).toBe('cloud_storage');
    expect(allCloudStorageServices.cloudinary.serviceId).toBe('cloudinary');
  });

  test('should include uploadcare service', () => {
    expect(Object.keys(allCloudStorageServices)).toContain('uploadcare');
    expect(allCloudStorageServices.uploadcare).toBeDefined();
    expect(allCloudStorageServices.uploadcare.serviceType).toBe('cloud_storage');
    expect(allCloudStorageServices.uploadcare.serviceId).toBe('uploadcare');
  });
});
