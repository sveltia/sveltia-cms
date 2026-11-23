import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  findInvalidApiKey,
  getApiKeyServiceGroups,
  getCloudStorageServiceEntries,
  getStockPhotoServiceEntries,
} from '$lib/services/integrations/api-key-services';
import { getStockAssetMediaLibraryOptions } from '$lib/services/integrations/media-libraries/stock';

const { s3 } = vi.hoisted(() => ({
  s3: { serviceLabel: 'S3', authType: 'api_key', isEnabled: vi.fn(() => true) },
}));

vi.mock('$lib/services/integrations/media-libraries/cloud', () => ({
  allCloudStorageServices: {
    'aws-s3': s3,
    cloudinary: { serviceLabel: 'Cloudinary', authType: 'widget' },
    uploadcare: { serviceLabel: 'Uploadcare', authType: 'api_key' },
  },
}));
vi.mock('$lib/services/integrations/media-libraries/stock', () => ({
  allStockAssetProviders: {
    pexels: { serviceLabel: 'Pexels', authType: 'api_key' },
    picsum: { serviceLabel: 'Lorem Picsum', authType: 'none' },
    unsplash: { serviceLabel: 'Unsplash', authType: 'api_key' },
  },
  getStockAssetMediaLibraryOptions: vi.fn(() => ({ providers: ['pexels', 'picsum'] })),
}));
vi.mock('$lib/services/integrations/ai', () => ({
  allAiServices: {
    openai: { serviceLabel: 'OpenAI GPT', apiKeyPattern: /^sk-/ },
  },
}));
vi.mock('$lib/services/integrations/translators', () => ({
  machineTranslationServices: {
    deepl: { serviceLabel: 'DeepL', apiKeyPattern: /:fx$/ },
  },
}));

beforeEach(() => {
  s3.isEnabled.mockReturnValue(true);
});

describe('getCloudStorageServiceEntries()', () => {
  test('lists the services turned on that take an API key', () => {
    expect(getCloudStorageServiceEntries().map(([id]) => id)).toEqual(['aws-s3', 'uploadcare']);

    s3.isEnabled.mockReturnValue(false);
    expect(getCloudStorageServiceEntries().map(([id]) => id)).toEqual(['uploadcare']);
  });
});

describe('getStockPhotoServiceEntries()', () => {
  test('lists the providers turned on that take an API key', () => {
    expect(getStockPhotoServiceEntries().map(([id]) => id)).toEqual(['pexels']);

    vi.mocked(getStockAssetMediaLibraryOptions).mockReturnValueOnce({});
    expect(getStockPhotoServiceEntries()).toEqual([]);
  });
});

describe('getApiKeyServiceGroups()', () => {
  test('groups the services, leaving out an empty group', () => {
    expect(getApiKeyServiceGroups().map(({ key, entries }) => [key, entries.length])).toEqual([
      ['translators', 1],
      ['ai', 1],
      ['cloud_storage', 2],
      ['stock_photos', 1],
    ]);

    vi.mocked(getStockAssetMediaLibraryOptions).mockReturnValueOnce({ providers: [] });
    expect(getApiKeyServiceGroups().map(({ key }) => key)).toEqual([
      'translators',
      'ai',
      'cloud_storage',
    ]);
  });
});

describe('findInvalidApiKey()', () => {
  test('names the first service whose key doesn’t match its pattern', () => {
    const groups = getApiKeyServiceGroups();

    expect(findInvalidApiKey({ deepl: ' abc:fx ', pexels: 'anything' }, groups)).toBeUndefined();
    // An empty key is a removed one
    expect(findInvalidApiKey({ deepl: '  ' }, groups)).toBeUndefined();
    expect(findInvalidApiKey({ deepl: 'abc' }, groups)).toBe('DeepL');
    expect(findInvalidApiKey({ openai: 'abc' }, groups)).toBe('OpenAI GPT');
  });
});
