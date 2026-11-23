import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCollectors } from '$lib/test/config-parser';

// Mock @sveltia/i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.missing_media_folder': 'Missing media_folder',
  'config.error.public_folder_relative_path': 'Public folder cannot use relative paths',
  'config.error.public_folder_absolute_url': 'Public folder cannot be an absolute URL',
  'config.warning.empty_public_folder': 'Empty public_folder',
  'config.error.missing_asset_collection_name': 'Missing asset collection name at index {count}',
  'config.error.invalid_asset_collection_name': 'Invalid asset collection name: {name}',
  'config.error.duplicate_asset_collection_name': 'Duplicate asset collection name: {name}',
  'config.error.unsupported_folder_template_tag': 'Unsupported tag {tag} in {option}',
  'config.error.global_folder_template_tag': 'Global tag {tag} in {option}',
};

vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ strings: mockI18nStrings, locale: 'en-US' }),
);

vi.mock('$lib/services/integrations/media-libraries/cloud', () => ({
  CLOUD_MEDIA_LIBRARY_NAMES: ['cloudinary', 'uploadcare'],
}));

describe('parseMediaConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  describe('problems the schema reports', () => {
    it('should leave option types to the schema', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: 123,
        public_folder: 123,
        asset_collections: {},
      };

      parseMediaConfig(config, collectors);

      expect([...collectors.errors]).toEqual([]);
    });

    it('should still report the rules the schema can’t express', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        public_folder: './relative',
        asset_collections: [{ name: 'invalid name', media_folder: '/assets' }],
      };

      parseMediaConfig(config, collectors);

      const errors = [...collectors.errors];

      expect(errors.some((e) => e.includes('Public folder cannot use relative paths'))).toBe(true);
      expect(errors.some((e) => e.includes('Invalid asset collection name'))).toBe(true);
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

  describe('empty public_folder', () => {
    it('should warn when public_folder is an empty string', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();
      /** @type {any} */
      const config = { media_folder: 'static/images', public_folder: '' };

      parseMediaConfig(config, collectors);

      expect([...collectors.errors]).toEqual([]);
      expect([...collectors.warnings]).toEqual(['Empty public_folder']);
    });

    it('should not warn when media_folder is undefined', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();
      /** @type {any} */
      const config = { media_library: { name: 'cloudinary' }, public_folder: '' };

      parseMediaConfig(config, collectors);

      expect([...collectors.warnings]).toEqual([]);
    });

    it('should not warn when public_folder is undefined or non-empty', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      parseMediaConfig(/** @type {any} */ ({ media_folder: 'static/images' }), collectors);
      parseMediaConfig(
        /** @type {any} */ ({ media_folder: 'static/images', public_folder: '/images' }),
        collectors,
      );

      expect([...collectors.warnings]).toEqual([]);
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

    it('should report a problem with each asset collection name', async () => {
      const { parseMediaConfig } = await import('./media.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        media_folder: '/media',
        asset_collections: [
          { name: 'invalid name', media_folder: '/a' },
          { name: 'images', media_folder: '/b' },
          { name: 'images', media_folder: '/c' },
        ],
      };

      parseMediaConfig(config, collectors);

      const errors = [...collectors.errors];

      expect(errors.some((e) => e.includes('Invalid asset collection name'))).toBe(true);
      expect(errors.some((e) => e.includes('Duplicate asset collection name'))).toBe(true);
    });
  });
});

describe('checkFolderTemplateTags', () => {
  /**
   * Check the given folder options and get the errors.
   * @param {Record<string, any>} config Configuration holding the options.
   * @param {boolean} [isGlobal] Whether the configuration is the site configuration.
   * @returns {Promise<string[]>} Errors.
   */
  const check = async (config, isGlobal) => {
    const { checkFolderTemplateTags } = await import('./media.js');
    const collectors = createCollectors();

    checkFolderTemplateTags({ config, isGlobal, context: {}, collectors });

    return [...collectors.errors];
  };

  it('should accept the tags a collection, a collection file or a field supports', async () => {
    expect(
      await check({
        media_folder: '{{media_folder}}/{{year}}/{{month}}/{{day}}/{{slug}}',
        public_folder:
          '{{public_folder}}/{{ slug | upper }}/{{dirname}}/{{filename}}.{{extension}}',
      }),
    ).toEqual([]);
    expect(
      await check({ media_folder: '/static/{{uuid}}/{{uuid_short}}/{{uuid_shorter}}' }),
    ).toEqual([]);
    expect(await check({ media_folder: 'static', public_folder: '' })).toEqual([]);
    // A value of another type is reported against the JSON schema
    expect(await check({ media_folder: 1 })).toEqual([]);
  });

  it('should report a tag that a collection, a collection file or a field doesn’t support', async () => {
    // These resolved to a random ID that changed with every entry draft
    expect(
      await check({
        media_folder: '/static/{{title}}/{{fields.title}}/{{locale}}',
        public_folder: '/{{nope | default("x")}}',
      }),
    ).toEqual([
      'Unsupported tag {{title}} in media_folder',
      'Unsupported tag {{fields.title}} in media_folder',
      'Unsupported tag {{locale}} in media_folder',
      'Unsupported tag {{nope | default("x")}} in public_folder',
    ]);
    // The global folder tags are replaced as they are, without spaces or transformations
    expect(await check({ media_folder: '{{ media_folder }}/a' })).toEqual([
      'Unsupported tag {{ media_folder }} in media_folder',
    ]);
  });

  it('should report any tag in the global options', async () => {
    // The tags were used literally
    expect(
      await check({ media_folder: 'static/{{year}}', public_folder: '/{{slug}}' }, true),
    ).toEqual(['Global tag {{year}} in media_folder', 'Global tag {{slug}} in public_folder']);
    expect(await check({ media_folder: 'static/images' }, true)).toEqual([]);
  });

  it('should be called for the global options and each asset collection', async () => {
    const { parseMediaConfig } = await import('./media.js');
    const collectors = createCollectors();

    parseMediaConfig(
      /** @type {any} */ ({
        media_folder: 'static/{{year}}',
        asset_collections: [{ name: 'images', media_folder: 'assets/{{slug}}' }],
      }),
      collectors,
    );

    expect([...collectors.errors]).toEqual([
      'Global tag {{year}} in media_folder',
      'Global tag {{slug}} in media_folder',
    ]);
  });
});
