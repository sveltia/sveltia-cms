import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

// Mock @sveltia/i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.invalid_collection_no_options': 'Collection must have files, folder, or divider',
  'config.error.invalid_collection_multiple_options':
    'Collection cannot have multiple conflicting options',
  'config.error.file_format_mismatch': 'File format mismatch',
  'config.error.invalid_slug_slash': 'Slug cannot contain slashes',
  'config.error.duplicate_collection_names': 'Duplicate collection name: {name}',
  'config.error_locator.collection': 'Collection: {collection}',
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
const mockCheckName = vi.fn();
const mockCheckUnsupportedOptions = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  addMessage: mockAddMessage,
  checkName: mockCheckName,
  checkUnsupportedOptions: mockCheckUnsupportedOptions,
}));

const mockParseFields = vi.fn();

vi.mock('$lib/services/config/parser/fields', () => ({
  parseFields: mockParseFields,
}));

const mockIsFormatMismatch = vi.fn();

vi.mock('$lib/services/config/parser/collections/format', () => ({
  isFormatMismatch: mockIsFormatMismatch,
}));

const mockParseCollectionFiles = vi.fn();

vi.mock('$lib/services/config/parser/collection-files', () => ({
  parseCollectionFiles: mockParseCollectionFiles,
}));

const mockWarnDeprecation = vi.fn();

vi.mock('$lib/services/config/deprecations', () => ({
  warnDeprecation: mockWarnDeprecation,
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

describe('Collections Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetStore.mockImplementation((store) => store);

    mockCheckName.mockReturnValue(true);
  });

  describe('parseEntryCollection', () => {
    it('should parse fields in entry collection', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          format: 'yaml',
          fields: [{ name: 'title', widget: 'string' }],
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockParseFields).toHaveBeenCalled();
    });

    it('should warn when preview_path needs a date but no DateTime field is defined', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          preview_path: '/blog/{{year}}/{{month}}/{{slug}}',
          fields: [{ name: 'title', widget: 'string' }],
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning', strKey: 'preview_path_no_date_field' }),
      );
    });

    it('should accept a date field defined only on the index file', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          preview_path: '/blog/{{year}}/{{slug}}',
          fields: [{ name: 'title', widget: 'string' }],
          index_file: { fields: [{ name: 'pubDate', widget: 'datetime' }] },
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ strKey: 'preview_path_no_date_field' }),
      );
    });

    it('should detect format mismatch in entry collection', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      mockIsFormatMismatch.mockReturnValue(true);

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          extension: 'md',
          format: 'yaml',
          fields: [],
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'file_format_mismatch',
        }),
      );
    });

    it('should add error when entry collection has no fields', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          format: 'yaml',
          fields: [],
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'collection_no_fields',
        }),
      );
    });

    it('should add error when entry collection has undefined fields', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          format: 'yaml',
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'collection_no_fields',
        }),
      );
    });

    it('should not add error when entry collection has fields defined', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          format: 'yaml',
          fields: [{ name: 'title', widget: 'string' }],
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'collection_no_fields',
        }),
      );
    });

    it('should handle deprecated slug_length option', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          fields: [],
          slug_length: 200,
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockWarnDeprecation).toHaveBeenCalledWith('slug_length');
    });

    it('should validate slug without slashes', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          fields: [],
          slug: '{{year}}/{{slug}}',
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_slug_slash',
        }),
      );
    });

    it('should accept valid slug without slashes', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          fields: [],
          slug: '{{year}}-{{slug}}',
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_slug_slash',
        }),
      );
    });

    it('should accept a reorder group defined in the object format view_groups', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'articles',
          folder: 'content/articles',
          fields: [],
          view_groups: { groups: [{ name: 'categories', label: 'Categories', field: 'category' }] },
          reorder: { group: 'categories' },
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ strKey: 'invalid_reorder_group' }),
      );
    });

    it('should accept a reorder group defined in the array format view_groups', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'articles',
          folder: 'content/articles',
          fields: [],
          view_groups: [{ name: 'categories', label: 'Categories', field: 'category' }],
          reorder: { group: 'categories' },
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ strKey: 'invalid_reorder_group' }),
      );
    });

    it('should add error when the reorder group is not defined in view_groups', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'articles',
          folder: 'content/articles',
          fields: [],
          view_groups: { groups: [{ name: 'years', label: 'Years', field: 'date' }] },
          reorder: { group: 'categories' },
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_reorder_group',
          values: { name: 'categories' },
        }),
      );
    });

    it('should add error when the reorder group is set without view_groups', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'articles',
          folder: 'content/articles',
          fields: [],
          reorder: { group: 'categories' },
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_reorder_group',
          values: { name: 'categories' },
        }),
      );
    });

    it('should skip reorder group validation when no group is configured', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'articles',
          folder: 'content/articles',
          fields: [],
          reorder: true,
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ strKey: 'invalid_reorder_group' }),
      );
    });

    it('should skip reorder group validation for a non-string or empty group', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const baseCollection = {
        name: 'articles',
        folder: 'content/articles',
        fields: [],
        view_groups: { groups: [{ name: 'categories', label: 'Categories', field: 'category' }] },
      };

      parseEntryCollection(
        /** @type {any} */ ({ cmsConfig: {}, collection: { ...baseCollection, reorder: {} } }),
        collectors,
      );
      parseEntryCollection(
        /** @type {any} */ ({
          cmsConfig: {},
          collection: { ...baseCollection, reorder: { group: '' } },
        }),
        collectors,
      );
      parseEntryCollection(
        /** @type {any} */ ({
          cmsConfig: {},
          collection: { ...baseCollection, reorder: { group: 123 } },
        }),
        collectors,
      );

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ strKey: 'invalid_reorder_group' }),
      );
    });

    it('should validate the fields referenced from the view options', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
          sortable_fields: ['title', 'category'],
          view_groups: [{ label: 'Year', field: 'date' }],
          view_filters: { filters: [{ name: 'titled', field: 'title', pattern: '.' }] },
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_sortable_field',
          values: { name: 'category' },
        }),
      );
      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_view_group_field',
          values: { name: 'date' },
        }),
      );
      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ strKey: 'invalid_view_filter_field' }),
      );
    });

    it('should handle index_file when true', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
          index_file: true,
        },
      };

      parseEntryCollection(context, collectors);

      // parseFields should be called twice: once for main fields, once for index_file
      expect(mockParseFields).toHaveBeenCalledTimes(2);
    });

    it('should handle index_file with custom fields', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
          index_file: {
            fields: [{ name: 'index_title', widget: 'string' }],
          },
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockParseFields).toHaveBeenCalledTimes(2);

      // Check second call has the index_file fields
      const secondCall = mockParseFields.mock.calls[1];

      expect(secondCall[0]).toEqual([{ name: 'index_title', widget: 'string' }]);
      expect(secondCall[1].isIndexFile).toBe(true);
    });

    it('should use parent fields when index_file has no fields', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
          index_file: {/* no fields */},
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockParseFields).toHaveBeenCalledTimes(2);

      // Second call should use parent fields
      const secondCall = mockParseFields.mock.calls[1];

      expect(secondCall[0]).toEqual([{ name: 'title', widget: 'string' }]);
      expect(secondCall[1].isIndexFile).toBe(true);
    });

    it('should check for unsupported options', async () => {
      const { parseEntryCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          folder: 'content/posts',
          fields: [],
          nested: true,
        },
      };

      parseEntryCollection(context, collectors);

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();
    });
  });

  describe('parseCollection', () => {
    it('should error when collection has no options', async () => {
      const { parseCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          label: 'Posts',
        },
      };

      parseCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_collection_no_options',
        }),
      );
    });

    it('should error when collection has conflicting options (files and folder)', async () => {
      const { parseCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          label: 'Posts',
          files: [],
          folder: 'content/posts',
        },
      };

      parseCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_collection_multiple_options',
        }),
      );
    });

    it('should error when collection has divider and files', async () => {
      const { parseCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          divider: true,
          files: [],
        },
      };

      parseCollection(context, collectors);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_collection_multiple_options',
        }),
      );
    });

    it('should parse file collection', async () => {
      const { parseCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'settings',
          label: 'Settings',
          files: [],
        },
      };

      parseCollection(context, collectors);

      expect(mockParseCollectionFiles).toHaveBeenCalled();
    });

    it('should parse entry collection', async () => {
      const { parseCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [],
        },
      };

      parseCollection(context, collectors);

      expect(mockParseFields).toHaveBeenCalled();
    });

    it('should skip divider collections', async () => {
      const { parseCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          divider: true,
        },
      };

      parseCollection(context, collectors);

      expect(mockParseFields).not.toHaveBeenCalled();
      expect(mockParseCollectionFiles).not.toHaveBeenCalled();
    });

    it('should return early on validation error', async () => {
      const { parseCollection } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
        },
      };

      parseCollection(context, collectors);

      expect(mockParseFields).not.toHaveBeenCalled();
      expect(mockParseCollectionFiles).not.toHaveBeenCalled();
    });
  });

  describe('parseCollections', () => {
    it('should error when no collections or singletons', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();
      /** @type {any} */
      const config = {};

      parseCollections(config, collectors);

      expect(collectors.errors.size).toBeGreaterThan(0);
    });

    it('should parse collections array', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        collections: [
          {
            name: 'posts',
            label: 'Posts',
            folder: 'content/posts',
            fields: [],
          },
        ],
      };

      parseCollections(config, collectors);

      expect(mockCheckName).toHaveBeenCalled();
    });

    it('should skip collection dividers', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        collections: [
          {
            divider: true,
          },
          {
            name: 'posts',
            label: 'Posts',
            folder: 'content/posts',
            fields: [],
          },
        ],
      };

      parseCollections(config, collectors);

      // Only one collection should be checked (divider is skipped)
      expect(mockCheckName).toHaveBeenCalledTimes(1);
    });

    it('should parse singletons collection', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        singletons: [
          {
            name: 'general',
            file: 'content/settings/general.yaml',
            fields: [],
          },
        ],
      };

      parseCollections(config, collectors);

      expect(mockParseCollectionFiles).toHaveBeenCalled();
    });

    it('should validate collection names', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();

      mockCheckName.mockReturnValueOnce(false);

      /** @type {any} */
      const config = {
        collections: [
          {
            name: 'posts',
            label: 'Posts',
            folder: 'content/posts',
            fields: [],
          },
        ],
      };

      parseCollections(config, collectors);

      // Collection should not be parsed due to checkName returning false
      expect(mockParseFields).not.toHaveBeenCalled();
    });

    it('should handle both collections and singletons', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        collections: [
          {
            name: 'posts',
            label: 'Posts',
            folder: 'content/posts',
            fields: [],
          },
        ],
        singletons: [
          {
            name: 'general',
            file: 'content/settings/general.yaml',
            fields: [],
          },
        ],
      };

      parseCollections(config, collectors);

      expect(mockCheckName).toHaveBeenCalled();
      expect(mockParseCollectionFiles).toHaveBeenCalled();
    });

    it('should not error when at least one collection is visible', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        collections: [
          { name: 'pages', label: 'Pages', folder: 'content/pages', fields: [], hide: true },
          { name: 'posts', label: 'Posts', folder: 'content/posts', fields: [] },
        ],
      };

      parseCollections(config, collectors);

      expect(collectors.errors).not.toContain('config.error.no_visible_collection');
    });

    it('should error when the only collection is hidden', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        collections: [
          { name: 'posts', label: 'Posts', folder: 'content/posts', fields: [], hide: true },
        ],
      };

      parseCollections(config, collectors);

      expect(collectors.errors).toContain('config.error.no_visible_collection');
    });

    it('should error when all the collections are hidden', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        collections: [
          { name: 'pages', label: 'Pages', folder: 'content/pages', fields: [], hide: true },
          { name: 'posts', label: 'Posts', folder: 'content/posts', fields: [], hide: true },
        ],
      };

      parseCollections(config, collectors);

      expect(collectors.errors).toContain('config.error.no_visible_collection');
    });

    it('should error when the collections list contains dividers only', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();
      /** @type {any} */
      const config = { collections: [{ divider: true }] };

      parseCollections(config, collectors);

      expect(collectors.errors).toContain('config.error.no_visible_collection');
    });

    it('should error when the collections list is empty', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();
      /** @type {any} */
      const config = { collections: [], singletons: [] };

      parseCollections(config, collectors);

      expect(collectors.errors).toContain('config.error.no_visible_collection');
    });

    it('should not error when hidden collections are accompanied by singletons', async () => {
      const { parseCollections } = await import('.');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        collections: [
          { name: 'posts', label: 'Posts', folder: 'content/posts', fields: [], hide: true },
        ],
        singletons: [{ name: 'general', file: 'content/settings/general.yaml', fields: [] }],
      };

      parseCollections(config, collectors);

      expect(collectors.errors).not.toContain('config.error.no_visible_collection');
    });
  });
});
