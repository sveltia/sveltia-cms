/* eslint-disable camelcase */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 */

/**
 * Mock translation function.
 * @param {string} key Message key.
 * @param {{ values?: Record<string, string> }} [options] Options.
 * @returns {string} Translated string.
 */
function mockTranslate(key, options) {
  let message = key;

  if (key === 'config.error.invalid_list_variable_type') {
    message = 'List variable type must be object, got {widget}';
  } else if (key === 'config.error.invalid_list_field') {
    message = 'List field cannot have multiple options';
  }

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

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  addMessage: mockAddMessage,
  checkName: vi.fn(() => true),
}));

const mockParseFieldConfig = vi.fn();
const mockParseFields = vi.fn();

vi.mock('$lib/services/config/parser/fields', () => ({
  parseFieldConfig: mockParseFieldConfig,
  parseFields: mockParseFields,
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

/**
 * Create a fresh context object for testing.
 * @returns {ConfigParserContext} Context instance.
 */
function createContext() {
  return {
    cmsConfig: { backend: { name: 'github', repo: 'test/repo' } },
    collection: { name: 'test', files: [], label: 'Test' },
    typedKeyPath: 'config.collections.0.fields.0',
  };
}

describe('List Field Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetStore.mockImplementation((store) => {
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

  describe('checkFieldType', () => {
    it('should allow object field type', async () => {
      const { checkFieldType } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();
      const result = checkFieldType('object', context, collectors);

      expect(result).toBe(true);
    });

    it('should reject string field type', async () => {
      const { checkFieldType } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();
      const result = checkFieldType('string', context, collectors);

      expect(result).toBe(false);
      expect(mockAddMessage).toHaveBeenCalled();
    });

    it('should reject number field type', async () => {
      const { checkFieldType } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();
      const result = checkFieldType('number', context, collectors);

      expect(result).toBe(false);
    });

    it('should reject boolean field type', async () => {
      const { checkFieldType } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();
      const result = checkFieldType('boolean', context, collectors);

      expect(result).toBe(false);
    });

    it('should reject select field type', async () => {
      const { checkFieldType } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();
      const result = checkFieldType('select', context, collectors);

      expect(result).toBe(false);
    });
  });

  describe('parseListFieldConfig', () => {
    it('should parse list field with object subfield', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          field: {
            name: 'item',
            widget: 'string',
          },
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      expect(mockParseFieldConfig).toHaveBeenCalled();
    });

    it('should parse list field with types', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          types: [
            {
              name: 'type1',
              widget: 'object',
              fields: [{ name: 'f1', widget: 'string' }],
            },
          ],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      expect(mockParseFields).toHaveBeenCalled();
    });

    it('should error when field and subfields are both present', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          field: { name: 'f1', widget: 'string' },
          fields: [{ name: 'f2', widget: 'string' }],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_list_field',
        }),
      );
    });

    it('should error when field and types are both present', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          field: { name: 'f1', widget: 'string' },
          types: [{ name: 't1', widget: 'object', fields: [] }],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_list_field',
        }),
      );
    });

    it('should error when fields and types are both present', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          fields: [{ name: 'f1', widget: 'string' }],
          types: [{ name: 't1', widget: 'object', fields: [] }],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_list_field',
        }),
      );
    });

    it('should handle types with invalid field type', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          types: [
            {
              name: 'type1',
              widget: 'string', // Invalid: not object
              fields: [{ name: 'f1', widget: 'string' }],
            },
          ],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      // Should not parse fields when type is invalid
      expect(mockParseFields).not.toHaveBeenCalled();
    });

    it('should handle types without fields', async () => {
      const { parseListFieldConfig } = await import('./list.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'items',
          widget: 'list',
          types: [
            {
              name: 'type1',
              widget: 'object',
              // no fields
            },
          ],
        },
        context,
        collectors,
      };

      parseListFieldConfig(args);

      // Should not parse fields when none exist
      expect(mockParseFields).not.toHaveBeenCalled();
    });
  });
});
