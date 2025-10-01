import { describe, expect, test } from 'vitest';

import { allCloudStorageServices } from './index.js';

describe('Cloud storage services', () => {
  test('should export allCloudStorageServices', () => {
    expect(allCloudStorageServices).toBeDefined();
    expect(typeof allCloudStorageServices).toBe('object');
  });

  test('should be an empty object', () => {
    expect(Object.keys(allCloudStorageServices)).toHaveLength(0);
  });
});
