import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

// Mock @sveltia/i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.unsupported_deprecated_option': '{prop} is deprecated, use {newProp}',
  'config.error.unsupported_ignored_option': '{prop} is ignored',
  'config.error.relation_field_invalid_collection': 'Collection not found: {collection}',
  'config.error.relation_field_missing_file_name':
    'File name is required for collection: {collection}',
  'config.error.relation_field_invalid_collection_file': 'File not found: {file}',
  'config.error.relation_field_invalid_value_field': 'Value field not found: {field}',
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

vi.mock('@sveltia/i18n', () => ({
  _: mockTranslate,
  locale: { current: 'en-US', set: vi.fn() },
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

    mockGetStore.mockImplementation((store) => store);
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

  describe('relation field value field validation', () => {
    /** @type {any} */
    const authorFields = [
      { name: 'userId', widget: 'string' },
      { name: 'name', widget: 'object', fields: [{ name: 'first', widget: 'string' }] },
      { name: 'cities', widget: 'list', fields: [{ name: 'id', widget: 'string' }] },
    ];

    /**
     * Parse a relation field with the given `value_field` against an `authors` folder collection.
     * @param {any} valueField The `value_field` option.
     * @param {any} [options] Extra options for the referenced collection, e.g. its `fields`.
     */
    const checkValueField = async (valueField, options = { fields: authorFields }) => {
      const { parseRelationFieldConfig } = await import('./relation.js');

      parseRelationFieldConfig({
        config: /** @type {any} */ ({
          name: 'author',
          widget: 'relation',
          collection: 'authors',
          value_field: valueField,
        }),
        context: /** @type {any} */ ({
          cmsConfig: {
            collections: [{ name: 'authors', folder: 'content/authors', ...options }],
          },
          collection: { name: 'posts' },
          typedKeyPath: 'author',
        }),
        collectors: createCollectors(),
      });
    };

    /**
     * Assert whether an invalid value field message was added.
     * @param {string} [field] Expected field name in the message, if any.
     */
    const expectMessage = (field) => {
      const matcher = expect.objectContaining({
        strKey: 'relation_field_invalid_value_field',
        ...(field ? { values: { field } } : {}),
      });

      if (field) {
        expect(mockAddMessage).toHaveBeenCalledWith(matcher);
      } else {
        expect(mockAddMessage).not.toHaveBeenCalledWith(matcher);
      }
    };

    it('should error when the value field is not defined in the collection', async () => {
      await checkValueField('email');
      expectMessage('email');
    });

    it('should accept a value field defined in the collection', async () => {
      await checkValueField('userId');
      expectMessage();
    });

    it('should accept a nested or wildcard key path', async () => {
      await checkValueField('name.first');
      await checkValueField('cities.*.id');
      expectMessage();
    });

    it('should accept the `fields.` prefix', async () => {
      await checkValueField('{{fields.userId}}');
      expectMessage();
    });

    it('should error on an unknown key path with the `fields.` prefix', async () => {
      await checkValueField('{{fields.email}}');
      expectMessage('fields.email');
    });

    it('should ignore the `{{slug}}` and `{{locale}}` template tags', async () => {
      await checkValueField('{{locale}}/{{slug}}');
      expectMessage();
    });

    it('should validate other tags in a template', async () => {
      await checkValueField('{{locale}}/{{email}}');
      expectMessage('email');
    });

    it('should treat a bare `slug` as a field name', async () => {
      await checkValueField('slug');
      expectMessage('slug');

      vi.clearAllMocks();

      await checkValueField('slug', {
        fields: [...authorFields, { name: 'slug', widget: 'string' }],
      });

      expectMessage();
    });

    it('should skip the check when the value field is empty or not a string', async () => {
      await checkValueField('');
      await checkValueField(123);
      expectMessage();
    });

    it('should skip the check when the collection has no fields', async () => {
      await checkValueField('email', {});
      await checkValueField('email', { fields: [] });
      expectMessage();
    });

    it('should validate against the fields of the referenced file', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');

      /** @type {any} */
      const context = {
        cmsConfig: {
          collections: [
            {
              name: 'settings',
              files: [
                {
                  name: 'general',
                  file: 'content/settings/general.yaml',
                  fields: [{ name: 'siteId', widget: 'string' }],
                },
              ],
            },
          ],
        },
        collection: { name: 'posts' },
        typedKeyPath: 'config',
      };

      parseRelationFieldConfig({
        config: /** @type {any} */ ({
          name: 'config',
          widget: 'relation',
          collection: 'settings',
          file: 'general',
          value_field: 'siteId',
        }),
        context,
        collectors: createCollectors(),
      });

      expectMessage();

      parseRelationFieldConfig({
        config: /** @type {any} */ ({
          name: 'config',
          widget: 'relation',
          collection: 'settings',
          file: 'general',
          value_field: 'siteName',
        }),
        context,
        collectors: createCollectors(),
      });

      expectMessage('siteName');
    });

    it('should skip the check when the collection is not found', async () => {
      const { parseRelationFieldConfig } = await import('./relation.js');

      parseRelationFieldConfig({
        config: /** @type {any} */ ({
          name: 'author',
          widget: 'relation',
          collection: 'authors',
          value_field: 'email',
        }),
        context: /** @type {any} */ ({
          cmsConfig: { collections: [] },
          collection: { name: 'posts' },
          typedKeyPath: 'author',
        }),
        collectors: createCollectors(),
      });

      expectMessage();
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
