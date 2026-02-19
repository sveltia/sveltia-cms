import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

// Mock svelte-i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.missing_backend': 'Missing backend configuration',
  'config.error.missing_backend_name': 'Backend name is required',
  'config.error.unsupported_backend': 'Unsupported backend: {name}',
  'config.error.unsupported_known_backend': 'Unsupported backend: {name}',
  'config.error.unsupported_custom_backend': 'Unsupported backend: {name}',
  'config.error.unsupported_backend_suggestion': 'Please check the supported backends.',
  'config.error.missing_repository': 'Missing repository',
  'config.error.invalid_repository': 'Invalid repository format',
  'config.error.no_collection': 'No collection found',
  'config.error.missing_media_folder': 'Missing media_folder',
  'config.warning.editorial_workflow_unsupported': 'Editorial workflow is not supported',
  'config.warning.nested_collections_unsupported': 'Nested collections are not supported',
  'config.error_locator.collection': 'Collection: {collection}',
  'config.error_locator.file': 'File: {file}',
  'config.error_locator.field': 'Field: {field}',
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

vi.mock('svelte-i18n', () => ({
  _: {
    subscribe: vi.fn((fn) => {
      fn(mockTranslate);

      return () => {};
    }),
  },
  locale: {
    subscribe: vi.fn((fn) => {
      fn('en-US');

      return () => {};
    }),
  },
}));

const mockGetStore = vi.fn();

vi.mock('svelte/store', () => ({
  get: mockGetStore,
}));

const mockIsObject = vi.fn();

vi.mock('@sveltia/utils/object', () => ({
  isObject: mockIsObject,
}));

vi.mock('$lib/services/contents/i18n', () => ({
  getListFormatter: vi.fn(() => ({
    /**
     * Format array.
     * @param {string[]} arr Array to format.
     * @returns {string} Formatted string.
     */
    format: (arr) => arr.join(', '),
  })),
}));

vi.mock('$lib/services/backends', () => ({
  gitBackendServices: {
    github: { name: 'github' },
    gitlab: { name: 'gitlab' },
    gitea: { name: 'gitea' },
  },
  validBackendNames: ['github', 'gitlab', 'gitea', 'local'],
  unsupportedBackends: {
    azure: { label: 'Azure DevOps' },
    bitbucket: { label: 'Bitbucket' },
    'git-gateway': { label: 'Git Gateway' },
  },
}));

vi.mock('$lib/services/config/deprecations', () => ({
  warnDeprecation: vi.fn(),
}));

vi.mock('$lib/services/integrations/media-libraries/cloud', () => ({
  CLOUD_MEDIA_LIBRARY_NAMES: [],
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

describe('Config Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetStore.mockImplementation((store) => {
      // If this is the i18n store, return the translate function
      if (store && typeof store.subscribe === 'function') {
        // This is a Svelte store - call subscribe to get current value
        let value;

        store.subscribe(
          /**
           * Store subscriber.
           * @param {any} v Value.
           */
          (v) => {
            value = v;
          },
        )();

        return value;
      }

      return store;
    });

    mockIsObject.mockImplementation(
      /**
       * Is object check.
       * @param {any} val Value.
       * @returns {boolean} Result.
       */
      (val) => val !== null && typeof val === 'object',
    );
  });

  describe('parseCmsConfig', () => {
    it('should parse a minimal valid config', async () => {
      const { parseCmsConfig } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: '/media',
        collections: [
          {
            name: 'posts',
            label: 'Posts',
            folder: 'content/posts',
            fields: [{ name: 'title', widget: 'string' }],
          },
        ],
      };

      parseCmsConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should collect errors for missing backend', async () => {
      const { parseCmsConfig } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        collections: [
          {
            name: 'posts',
            label: 'Posts',
            folder: 'content/posts',
            fields: [{ name: 'title', widget: 'string' }],
          },
        ],
      };

      parseCmsConfig(config, collectors);

      expect(collectors.errors.size).toBeGreaterThan(0);
    });

    it('should collect warnings for editorial_workflow', async () => {
      const { parseCmsConfig } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: '/media',
        publish_mode: 'editorial_workflow',
        collections: [
          {
            name: 'posts',
            label: 'Posts',
            folder: 'content/posts',
            fields: [{ name: 'title', widget: 'string' }],
          },
        ],
      };

      parseCmsConfig(config, collectors);

      const warningArray = Array.from(collectors.warnings);

      expect(warningArray.some((w) => w.includes('Editorial workflow'))).toBe(true);
    });

    it('should collect warnings for nested collections', async () => {
      const { parseCmsConfig } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: '/media',
        collections: [
          {
            name: 'posts',
            label: 'Posts',
            folder: 'content/posts',
            nested: true,
            fields: [{ name: 'title', widget: 'string' }],
          },
        ],
      };

      parseCmsConfig(config, collectors);

      const warningArray = Array.from(collectors.warnings);

      expect(warningArray.some((w) => w.includes('Nested collections'))).toBe(true);
    });

    it('should collect errors for no collections', async () => {
      const { parseCmsConfig } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: { name: 'github', repo: 'owner/repo' },
        media_folder: '/media',
      };

      parseCmsConfig(config, collectors);

      const errorArray = Array.from(collectors.errors);

      expect(errorArray.some((e) => e.includes('No collection'))).toBe(true);
    });
  });
});
