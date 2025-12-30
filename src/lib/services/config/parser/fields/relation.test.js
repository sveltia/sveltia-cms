/* eslint-disable camelcase */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

// Mock svelte-i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.unsupported_deprecated_option': '{prop} is deprecated, use {newProp}',
  'config.error.unsupported_ignored_option': '{prop} is ignored',
  'config.error.relation_field_invalid_collection': 'Collection not found: {collection}',
  'config.error.relation_field_missing_file_name':
    'File name is required for collection: {collection}',
  'config.error.relation_field_invalid_collection_file': 'File not found: {file}',
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

const mockAddMessage = vi.fn();
const mockCheckUnsupportedOptions = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  addMessage: mockAddMessage,
  checkUnsupportedOptions: mockCheckUnsupportedOptions,
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

describe('Relation Field Config Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetStore.mockImplementation((store) => {
      // Handle the i18n store
      if (store && typeof store.subscribe === 'function') {
        let result;

        store.subscribe((/** @type {any} */ value) => {
          result = value;
        })();

        return result;
      }

      return store;
    });
  });

  describe('relation field collection validation', () => {
    it('should error when collection does not exist', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'author',
        widget: 'relation',
        collection: 'authors',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [{ name: 'posts', folder: 'content/posts' }],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'author',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'relation_field_invalid_collection',
          values: { collection: 'authors' },
        }),
      );
    });

    it('should accept relation field when collection exists', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'author',
        widget: 'relation',
        collection: 'authors',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [{ name: 'authors', folder: 'content/authors' }],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'author',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      // Should not error for missing collection
      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'relation_field_invalid_collection',
        }),
      );
    });
  });

  describe('relation field file validation', () => {
    it('should error when file is specified but collection has no files', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'config',
        widget: 'relation',
        collection: 'settings',
        file: 'general',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [{ name: 'settings', folder: 'content/settings' }],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'config',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'relation_field_invalid_collection_file',
        }),
      );
    });

    it('should error when specified file does not exist in collection', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'config',
        widget: 'relation',
        collection: 'settings',
        file: 'missing-file',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [
            {
              name: 'settings',
              files: [{ name: 'general', file: 'content/settings/general.yaml' }],
            },
          ],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'config',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'relation_field_invalid_collection_file',
          values: { file: 'missing-file' },
        }),
      );
    });

    it('should accept valid file in file collection', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'config',
        widget: 'relation',
        collection: 'settings',
        file: 'general',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [
            {
              name: 'settings',
              files: [{ name: 'general', file: 'content/settings/general.yaml' }],
            },
          ],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'config',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'relation_field_invalid_collection_file',
        }),
      );
    });

    it('should error when file collection requires file but none is specified', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'config',
        widget: 'relation',
        collection: 'settings',
        // No file specified for a file collection
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [
            {
              name: 'settings',
              files: [{ name: 'general', file: 'content/settings/general.yaml' }],
            },
          ],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'config',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'relation_field_missing_file_name',
        }),
      );
    });
  });

  describe('singleton collection support', () => {
    it('should support _singletons collection', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'setting',
        widget: 'relation',
        collection: '_singletons',
        file: 'general',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          singletons: [{ name: 'general', file: 'content/settings/general.yaml' }],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'setting',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      // Should not error
      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'relation_field_invalid_collection_file',
        }),
      );
    });
  });

  describe('unsupported options', () => {
    it('should check for unsupported relation field options', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'author',
        widget: 'relation',
        collection: 'authors',
        displayFields: ['name'],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [{ name: 'authors', folder: 'content/authors' }],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'author',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();
    });

    it('should handle searchFields deprecation', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'author',
        widget: 'relation',
        collection: 'authors',
        searchFields: ['name', 'email'],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [{ name: 'authors', folder: 'content/authors' }],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'author',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();
    });

    it('should handle valueField deprecation', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'author',
        widget: 'relation',
        collection: 'authors',
        valueField: 'id',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [{ name: 'authors', folder: 'content/authors' }],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'author',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();
    });
  });

  describe('relation field collection registration', () => {
    it('should collect relation field information for later processing', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'author',
        widget: 'relation',
        collection: 'authors',
        value_field: 'slug',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [{ name: 'authors', folder: 'content/authors' }],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'author',
      };

      parseRelationFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(collectors.relationFields.size).toBe(1);

      const [relationField] = [...collectors.relationFields];

      expect(relationField.fieldConfig).toBe(fieldConfig);
      expect(relationField.context).toBe(context);
    });
  });
});
