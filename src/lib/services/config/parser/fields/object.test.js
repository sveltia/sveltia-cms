/* eslint-disable camelcase */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

// Mock svelte-i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.invalid_object_field': 'Object field cannot have both fields and types',
  'config.error.object_field_missing_fields': 'Object field must have either fields or types',
  'config.error.duplicate_names': 'Duplicate name: {name}',
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

const mockParseFields = vi.fn();

vi.mock('$lib/services/config/parser/fields', () => ({
  parseFields: mockParseFields,
}));

const mockAddMessage = vi.fn();
const mockCheckName = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  addMessage: mockAddMessage,
  checkName: mockCheckName,
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

describe('Object Field Config Parser', () => {
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

    mockCheckName.mockReturnValue(true);
  });

  describe('parseObjectFieldConfig with fields', () => {
    it('should parse object field with subfields', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'metadata',
        widget: 'object',
        fields: [
          { name: 'author', widget: 'string' },
          { name: 'date', widget: 'datetime' },
        ],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'metadata',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockParseFields).toHaveBeenCalledWith(fieldConfig.fields, context, collectors);
    });

    it('should not add error when only fields are present', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'data',
        widget: 'object',
        fields: [{ name: 'title', widget: 'string' }],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'data',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_object_field',
        }),
      );
    });
  });

  describe('parseObjectFieldConfig with types', () => {
    it('should parse object field with variable types', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'block',
        widget: 'object',
        types: [
          {
            name: 'text_block',
            fields: [{ name: 'text', widget: 'text' }],
          },
          {
            name: 'image_block',
            fields: [{ name: 'image', widget: 'image' }],
          },
        ],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'block',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      // parseFields should be called for each type's fields
      expect(mockParseFields).toHaveBeenCalledTimes(2);
    });

    it('should validate type names', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      mockCheckName.mockReturnValueOnce(true).mockReturnValueOnce(false);

      /** @type {any} */
      const fieldConfig = {
        name: 'block',
        widget: 'object',
        types: [
          {
            name: 'text',
            fields: [{ name: 'content', widget: 'text' }],
          },
          {
            name: 'text',
            fields: [{ name: 'content', widget: 'text' }],
          },
        ],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'block',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockCheckName).toHaveBeenCalledTimes(2);
    });

    it('should pass correct context for types including typed key path', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'block',
        widget: 'object',
        types: [
          {
            name: 'text_block',
            fields: [{ name: 'text', widget: 'text' }],
          },
        ],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'block',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      // Check that parseFields was called with modified context
      expect(mockParseFields).toHaveBeenCalled();

      const passedContext = mockParseFields.mock.calls[0][1];

      expect(passedContext.typedKeyPath).toBe('block<text_block>');
    });
  });

  describe('parseObjectFieldConfig validation', () => {
    it('should error when both fields and types are present', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'data',
        widget: 'object',
        fields: [{ name: 'title', widget: 'string' }],
        types: [
          {
            name: 'text',
            fields: [{ name: 'text', widget: 'text' }],
          },
        ],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'data',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_object_field',
        }),
      );
    });

    it('should error when neither fields nor types are present', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'data',
        widget: 'object',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'data',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'object_field_missing_fields',
        }),
      );
    });

    it('should not parse fields when validation fails', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'data',
        widget: 'object',
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'data',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      expect(mockParseFields).not.toHaveBeenCalled();
    });

    it('should skip parsing types without fields', async () => {
      const { parseObjectFieldConfig } = await import('./object.js');
      const collectors = createCollectors();

      /** @type {any} */
      const fieldConfig = {
        name: 'block',
        widget: 'object',
        types: [
          {
            name: 'text_block',
            fields: [{ name: 'text', widget: 'text' }],
          },
          {
            name: 'empty_block',
            // No fields property
          },
        ],
      };

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: 'block',
      };

      parseObjectFieldConfig({
        config: fieldConfig,
        context,
        collectors,
      });

      // Only one call to parseFields (for the first type with fields)
      expect(mockParseFields).toHaveBeenCalledTimes(1);
    });
  });
});
