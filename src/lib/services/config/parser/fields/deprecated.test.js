import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

// Mock svelte-i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.unsupported_deprecated_option': '{prop} is deprecated, use {newProp} instead',
  'config.error.invalid_object_field': 'Object field must have either fields or types, not both',
  'config.error.object_field_missing_fields': 'Object field must have either fields or types',
  'config.error.duplicate_names': 'Duplicate name: {name}',
  'config.error.relation_field_invalid_collection': 'Collection not found: {collection}',
  'config.error.relation_field_missing_file_name': 'File name required for file collection',
  'config.error.relation_field_invalid_collection_file': 'File not found in collection',
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

const mockCheckUnsupportedOptions = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
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

describe('Field Config Parsers', () => {
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

  describe('parseDateTimeFieldConfig', () => {
    it('should check for deprecated datetime field options', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'published_at',
        widget: 'datetime',
        dateFormat: 'YYYY-MM-DD',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'published_at',
      };

      parseDateTimeFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();
    });

    it('should handle timeFormat deprecation', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'timestamp',
        widget: 'datetime',
        timeFormat: 'HH:mm:ss',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'timestamp',
      };

      parseDateTimeFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();
    });

    it('should handle pickerUtc deprecation', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'utc_time',
        widget: 'datetime',
        pickerUtc: true,
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'utc_time',
      };

      parseDateTimeFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();
    });
  });

  describe('parseNumberFieldConfig', () => {
    it('should check for deprecated number field options', async () => {
      const { parseNumberFieldConfig } = await import('./number.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'count',
        widget: 'number',
        valueType: 'int',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'count',
      };

      parseNumberFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();
    });

    it('should handle valueType field properly', async () => {
      const { parseNumberFieldConfig } = await import('./number.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'rating',
        widget: 'number',
        valueType: 'float',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'rating',
      };

      parseNumberFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      const args = mockCheckUnsupportedOptions.mock.calls[0][0];

      expect(args.UNSUPPORTED_OPTIONS).toBeDefined();
      expect(args.UNSUPPORTED_OPTIONS[0].prop).toBe('valueType');
      expect(args.UNSUPPORTED_OPTIONS[0].newProp).toBe('value_type');
    });
  });

  describe('parseRichTextFieldConfig', () => {
    it('should check for deprecated richtext field options', async () => {
      const { parseRichTextFieldConfig } = await import('./rich-text.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'content',
        widget: 'richtext',
        editorComponents: ['custom-component'],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'content',
      };

      parseRichTextFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();
    });

    it('should handle editorComponents deprecation', async () => {
      const { parseRichTextFieldConfig } = await import('./rich-text.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'description',
        widget: 'richtext',
        editorComponents: ['bold', 'italic'],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'description',
      };

      parseRichTextFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      const args = mockCheckUnsupportedOptions.mock.calls[0][0];

      expect(args.UNSUPPORTED_OPTIONS).toBeDefined();
      expect(args.UNSUPPORTED_OPTIONS[0].prop).toBe('editorComponents');
      expect(args.UNSUPPORTED_OPTIONS[0].newProp).toBe('editor_components');
    });
  });
});
