import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

// Mock @sveltia/i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.missing_media_folder': 'Missing media_folder',
  'config.error.invalid_media_folder': 'Invalid media_folder',
  'config.error.invalid_public_folder': 'Invalid public_folder',
  'config.error.public_folder_relative_path': 'Public folder cannot use relative paths',
  'config.error.public_folder_absolute_url': 'Public folder cannot be an absolute URL',
  'config.error.invalid_asset_collections': 'Invalid asset_collections',
  'config.error.missing_asset_collection_name': 'Missing asset collection name at index {count}',
  'config.error.invalid_asset_collection_name': 'Invalid asset collection name: {name}',
  'config.error.duplicate_asset_collection_name': 'Duplicate asset collection name: {name}',
  'config.error.asset_collection_invalid_media_folder':
    'Invalid media_folder for asset collection {name}',
};

/**
 * Mock translation function.
 * @param {string} key Message key.
 * @param {object & { values?: Record<string, string> }} [options] Options.
 * @returns {string} Translated string.
 */
function mockTranslate(key, options) {
  let message = mockI18nStrings[key] || key;

  if (options?.values) {
    Object.entries(options.values).forEach(([k, v]) => {
      message = message.replace(`{${k}}`, v);
    });
  }

  return message;
}

vi.mock('@sveltia/i18n', () => ({
  _: mockTranslate,
  locale: { current: 'en-US', set: vi.fn() },
}));

const mockGetStore = vi.fn();

vi.mock('svelte/store', () => ({
  get: mockGetStore,
}));

vi.mock('$lib/services/integrations/media-libraries/cloud', () => ({
  CLOUD_MEDIA_LIBRARY_NAMES: ['cloudinary', 'uploadcare'],
}));

/**
 * Create a fresh collectors object for testing.
 * @returns {ConfigParserCollectors} Collectors instance.
 */
function createCollectors() {
  return {
    errors: new Set(),
    warnings: new Set(),
    mediaFields: new Set(),
    relationFields: new Set(),
  };
}

describe('parseMediaConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetStore.mockImplementation((store) => store);
  });

  describe('media_folder validation', () => {
    it('should error when media_folder is missing and no cloud library configured', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();
      /** @type {any} */
      const config = {};

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Missing media_folder');
    });

    it('should not error when media_folder is defined', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should error when media_folder is not a string', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: 123,
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Invalid media_folder');
    });
  });

  describe('cloud media library integration', () => {
    it('should not require media_folder when media_library is cloudinary', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_library: {
          name: 'cloudinary',
          config: {},
        },
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should not require media_folder when media_library is uploadcare', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_library: {
          name: 'uploadcare',
          config: {},
        },
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should require media_folder when media_library is not a cloud provider', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_library: {
          name: 'default',
        },
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Missing media_folder');
    });

    it('should not require media_folder when any media_libraries key is cloudinary', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_libraries: {
          cloudinary: {
            config: {},
          },
          default: {},
        },
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should not require media_folder when any media_libraries key is uploadcare', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_libraries: {
          uploadcare: {
            config: {},
          },
        },
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should require media_folder when media_libraries only has non-cloud providers', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_libraries: {
          default: {},
        },
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Missing media_folder');
    });
  });

  describe('public_folder validation', () => {
    it('should accept undefined public_folder', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should accept valid public_folder', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        public_folder: '/static',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should error when public_folder is not a string', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        public_folder: 123,
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Invalid public_folder');
    });

    it('should error when public_folder starts with ./', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        public_folder: './static',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Public folder cannot use relative paths');
    });

    it('should error when public_folder starts with ../', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        public_folder: '../static',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Public folder cannot use relative paths');
    });

    it('should error when public_folder is an http URL', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        public_folder: 'http://example.com/static',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Public folder cannot be an absolute URL');
    });

    it('should error when public_folder is an https URL', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        public_folder: 'https://example.com/static',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Public folder cannot be an absolute URL');
    });
  });

  describe('combined validation', () => {
    it('should error for both missing media_folder and invalid public_folder', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        public_folder: './static',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(2);

      const errors = [...collectors.errors];

      expect(errors.some((e) => e === 'Missing media_folder')).toBe(true);
      expect(errors.some((e) => e === 'Public folder cannot use relative paths')).toBe(true);
    });

    it('should accept valid config with both media_folder and public_folder', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        public_folder: '/static',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });
  });

  describe('asset_collections validation', () => {
    it('should not error when asset_collections is undefined', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should error when asset_collections is not an array', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: 'not-an-array',
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Invalid asset_collections');
    });

    it('should error when asset collection name is missing', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: [
          {
            media_folder: '/assets',
          },
        ],
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toContain('Missing asset collection name at index 1');
    });

    it('should error when asset collection name is not a string', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: [
          {
            name: 123,
            media_folder: '/assets',
          },
        ],
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toContain('Missing asset collection name');
    });

    it('should error when asset collection name contains invalid characters', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: [
          {
            name: 'invalid name',
            media_folder: '/assets',
          },
        ],
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toContain('Invalid asset collection name');
    });

    it('should error when asset collection names are duplicated', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: [
          {
            name: 'images',
            media_folder: '/assets/images',
          },
          {
            name: 'images',
            media_folder: '/assets/other',
          },
        ],
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toContain('Duplicate asset collection name');
    });

    it('should error when media_folder is missing in asset collection', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: [
          {
            name: 'images',
          },
        ],
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Invalid media_folder for asset collection images');
    });

    it('should error when asset collection media_folder is not a string', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: [
          {
            name: 'images',
            media_folder: 123,
          },
        ],
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Invalid media_folder for asset collection images');
    });

    it('should accept valid asset collection', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: [
          {
            name: 'images',
            media_folder: '/assets/images',
          },
        ],
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should accept multiple valid asset collections', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: [
          {
            name: 'images',
            media_folder: '/assets/images',
          },
          {
            name: 'videos',
            media_folder: '/assets/videos',
            label: 'Videos',
          },
        ],
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should report multiple errors in asset collections', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: [
          {
            name: 'invalid name',
            media_folder: 123,
          },
          {
            name: 'images',
          },
        ],
      };

      parseMediaConfig(config, collectors);

      expect(collectors.errors.size).toBe(2);

      const errors = [...collectors.errors];

      expect(errors.some((e) => e.includes('Invalid asset collection name'))).toBe(true);
      expect(
        errors.some((e) => e.includes('Invalid media_folder for asset collection images')),
      ).toBe(true);
    });
  });
});
