/* eslint-disable no-param-reassign */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

/**
 * Mock translation function.
 * @param {string} key Message key.
 * @param {object & { values?: Record<string, string> }} [options] Options.
 * @returns {string} Translated string.
 */
function mockTranslate(key, options) {
  /** @type {Record<string, string>} */
  const strings = {
    'config.error.test_error': 'Test error message',
    'config.warning.test_warning': 'Test warning message',
    'config.error.invalid_type': 'Expected {expected}, got {actual}',
    'config.error.unsupported_deprecated_option': 'Unsupported option: {prop} (use {newProp})',
    'config.error.custom_message': 'Custom unsupported option: {prop}',
    'config.error.duplicate_names': 'Duplicate name found: {name}',
    'config.error.my_custom_key': 'Custom duplicate message: {name}',
    'config.error_locator.collection': 'Collection: {collection}',
    'config.error_locator.file': 'File: {file}',
    'config.error_locator.field': 'Field: {field}',
  };

  let message = strings[key] || key;

  if (options?.values) {
    Object.entries(options.values).forEach(([k, v]) => {
      message = message.replace(`{${k}}`, v);
    });
  }

  return message;
}

const mockGet = vi.fn();
const mockGetListFormatter = vi.fn();

vi.mock('svelte/store', () => ({
  get: mockGet,
}));

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

vi.mock('$lib/services/contents/i18n', () => ({
  getListFormatter: mockGetListFormatter,
}));

// Must import after mocking
const { addMessage, checkUnsupportedOptions, checkDuplicateNames } = await import('./messages.js');

/**
 * Create a fresh collectors object for testing.
 * @returns {ConfigParserCollectors} A fresh collectors instance.
 */
function createCollectors() {
  return {
    errors: new Set(),
    warnings: new Set(),
    mediaFields: new Set(),
    relationFields: new Set(),
  };
}

describe('messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGet.mockImplementation((store) => {
      // If this is a store, call subscribe to get the current value
      if (store && typeof store.subscribe === 'function') {
        let value;

        store.subscribe(
          /**
           * Store subscriber callback.
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

    mockGetListFormatter.mockReturnValue({
      /**
       * Format array.
       * @param {string[]} arr Array to format.
       * @returns {string} Formatted string.
       */
      format: (arr) => arr.join(', '),
    });
  });

  describe('addMessage', () => {
    it('should add an error message with no context', () => {
      const collectors = createCollectors();

      addMessage({
        type: 'error',
        strKey: 'test_error',
        collectors,
      });

      expect(Array.from(collectors.errors)).toContain('Test error message');
      expect(collectors.warnings.size).toBe(0);
    });

    it('should add a warning message when type is warning', () => {
      const collectors = createCollectors();

      addMessage({
        type: 'warning',
        strKey: 'test_warning',
        collectors,
      });

      expect(Array.from(collectors.warnings)).toContain('Test warning message');
      expect(collectors.errors.size).toBe(0);
    });

    it('should default to error type when not specified', () => {
      const collectors = createCollectors();

      addMessage({
        strKey: 'test_error',
        collectors,
      });

      expect(Array.from(collectors.errors)).toContain('Test error message');
    });

    it('should include collection locator when context has collection', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collection: { name: 'posts', label: 'Posts' },
      };

      addMessage({
        strKey: 'test_error',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('Collection: Posts');
    });

    it('should include file locator when context has collectionFile', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collectionFile: { name: 'post-1', label: 'Post 1' },
      };

      addMessage({
        strKey: 'test_error',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('File: Post 1');
    });

    it('should include field locator when context has typedKeyPath', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        typedKeyPath: 'fields.0.name',
      };

      addMessage({
        strKey: 'test_error',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('Field: fields.0.name');
    });

    it('should include all locators when context has collection, file, and field', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collection: { name: 'posts', label: 'Posts' },
        collectionFile: { name: 'post-1', label: 'Post 1' },
        typedKeyPath: 'fields.0.name',
      };

      addMessage({
        strKey: 'test_error',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('Collection: Posts');
      expect(message).toContain('File: Post 1');
      expect(message).toContain('Field: fields.0.name');
    });

    it('should use collection.label when available', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collection: { name: 'posts', label: 'My Posts' },
      };

      addMessage({
        strKey: 'test_error',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('My Posts');
    });

    it('should use collection.name as fallback when label is not available', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collection: { name: 'posts' },
      };

      addMessage({
        strKey: 'test_error',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('posts');
    });

    it('should substitute i18n values in message', () => {
      const collectors = createCollectors();

      addMessage({
        strKey: 'invalid_type',
        values: { expected: 'string', actual: 'number' },
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toBe('Expected string, got number');
    });

    it('should call getListFormatter with the current locale', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collection: { name: 'posts', label: 'Posts' },
      };

      addMessage({
        strKey: 'test_error',
        context,
        collectors,
      });

      expect(mockGetListFormatter).toHaveBeenCalledWith('en-US');
    });

    it('should handle empty context gracefully', () => {
      const collectors = createCollectors();
      /** @type {any} */
      const context = {};

      addMessage({
        strKey: 'test_error',
        context,
        collectors,
      });

      expect(Array.from(collectors.errors)).toContain('Test error message');
    });

    it('should use file.label when available', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collectionFile: { name: 'post-1', label: 'Custom Label' },
      };

      addMessage({
        strKey: 'test_error',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('Custom Label');
    });

    it('should use file.name as fallback when label is not available', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collectionFile: { name: 'post-1' },
      };

      addMessage({
        strKey: 'test_error',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('post-1');
    });

    it('should handle multiple values in i18n message', () => {
      const collectors = createCollectors();

      addMessage({
        strKey: 'unsupported_deprecated_option',
        values: { prop: 'oldField', newProp: 'newField' },
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('oldField');
      expect(message).toContain('newField');
    });
  });

  describe('checkUnsupportedOptions', () => {
    it('should not add a message when unsupported option is not present', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [{ type: 'error', prop: 'oldProp', newProp: 'newProp' }],
        config: { someProp: 'value' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(0);
    });

    it('should add an error message when error type option is present', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [{ type: 'error', prop: 'oldProp', newProp: 'newProp' }],
        config: { oldProp: 'value' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(1);
    });

    it('should add a warning message when warning type option is present', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [{ type: 'warning', prop: 'oldProp', newProp: 'newProp' }],
        config: { oldProp: 'value' },
        context: {},
        collectors,
      });

      expect(collectors.warnings.size).toBe(1);
    });

    it('should use default strKey when not provided', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [{ type: 'error', prop: 'oldProp', newProp: 'newProp' }],
        config: { oldProp: 'value' },
        context: {},
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('Unsupported option:');
    });

    it('should use custom strKey when provided', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [
          { type: 'error', prop: 'oldProp', newProp: 'newProp', strKey: 'custom_message' },
        ],
        config: { oldProp: 'value' },
        context: {},
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('Custom unsupported option:');
    });

    it('should check multiple unsupported options', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [
          { type: 'error', prop: 'oldProp1', newProp: 'newProp1' },
          { type: 'error', prop: 'oldProp2', newProp: 'newProp2' },
        ],
        config: { oldProp1: 'value1', oldProp2: 'value2' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(2);
    });

    it('should only add message for present options among multiple unsupported options', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [
          { type: 'error', prop: 'oldProp1', newProp: 'newProp1' },
          { type: 'error', prop: 'oldProp2', newProp: 'newProp2' },
          { type: 'error', prop: 'oldProp3', newProp: 'newProp3' },
        ],
        config: { oldProp1: 'value1', oldProp3: 'value3' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(2);
    });

    it('should pass context and collectors to addMessage', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collection: { name: 'posts', label: 'Posts' },
      };

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [{ type: 'error', prop: 'oldProp', newProp: 'newProp' }],
        config: { oldProp: 'value' },
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('Posts');
    });

    it('should pass prop and newProp values to addMessage', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [{ type: 'error', prop: 'oldField', newProp: 'newField' }],
        config: { oldField: 'someValue' },
        context: {},
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('oldField');
      expect(message).toContain('newField');
    });

    it('should handle mixed error and warning types', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [
          { type: 'error', prop: 'errorProp', newProp: 'newErrorProp' },
          { type: 'warning', prop: 'warningProp', newProp: 'newWarningProp' },
        ],
        config: { errorProp: 'value1', warningProp: 'value2' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(1);
      expect(collectors.warnings.size).toBe(1);
    });

    it('should handle empty config', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [{ type: 'error', prop: 'oldProp', newProp: 'newProp' }],
        config: {},
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(0);
    });

    it('should handle empty UNSUPPORTED_OPTIONS array', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [],
        config: { someField: 'value' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(0);
      expect(collectors.warnings.size).toBe(0);
    });

    it('should check value when specified', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [
          { type: 'error', prop: 'oldProp', newProp: 'newProp', value: 'specific' },
        ],
        config: { oldProp: 'specific' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(1);
    });

    it('should not add message when value does not match', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [
          { type: 'error', prop: 'oldProp', newProp: 'newProp', value: 'specific' },
        ],
        config: { oldProp: 'different' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(0);
    });

    it('should add message when value is undefined (any value matches)', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [{ type: 'error', prop: 'oldProp', newProp: 'newProp' }],
        config: { oldProp: 'anyValue' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(1);
    });

    it('should handle value being false', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [{ type: 'error', prop: 'oldProp', newProp: 'newProp', value: false }],
        config: { oldProp: false },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(1);
    });

    it('should not add message when value is false but config has true', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [{ type: 'error', prop: 'oldProp', newProp: 'newProp', value: false }],
        config: { oldProp: true },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(0);
    });

    it('should handle multiple options with different values', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [
          { type: 'error', prop: 'prop1', newProp: 'newProp1', value: 'value1' },
          { type: 'error', prop: 'prop2', newProp: 'newProp2', value: 'value2' },
        ],
        config: { prop1: 'value1', prop2: 'value2' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(2);
    });

    it('should filter multiple options by value', () => {
      const collectors = createCollectors();

      checkUnsupportedOptions({
        UNSUPPORTED_OPTIONS: [
          { type: 'error', prop: 'prop1', newProp: 'newProp1', value: 'value1' },
          { type: 'error', prop: 'prop2', newProp: 'newProp2', value: 'value2' },
        ],
        config: { prop1: 'value1', prop2: 'different' },
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(1);
    });
  });

  describe('checkDuplicateNames', () => {
    it('should not add a message when no duplicates exist', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { name1: 1, name2: 1, name3: 1 },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(0);
    });

    it('should add messages for duplicate names', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { duplicate1: 2, duplicate2: 3, unique: 1 },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      // Each duplicate name gets its own message added via addMessage
      expect(collectors.errors.size).toBeGreaterThan(0);
    });

    it('should add a message for names with count > 1', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { duplicate: 5, unique: 1 },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(1);

      const message = Array.from(collectors.errors)[0];

      expect(message).toBeTruthy();
    });

    it('should handle empty nameCounts object', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: {},
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(0);
    });

    it('should call addMessage for each duplicate name', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { dup1: 2, dup2: 3, dup3: 4, unique: 1 },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      // Should have added 3 messages (for dup1, dup2, dup3)
      expect(collectors.errors.size).toBe(3);
    });

    it('should include context information in messages', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collection: { name: 'posts', label: 'Posts' },
        typedKeyPath: 'fields.name',
      };

      checkDuplicateNames({
        nameCounts: { duplicate: 2 },
        strKey: 'duplicate_names',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('Posts');
      expect(message).toContain('fields.name');
    });

    it('should handle high duplicate counts', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { duplicate: 100, another: 50 },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(2);
    });

    it('should only filter entries with count > 1', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: {
          name1: 1,
          name2: 1,
          name3: 2,
          name4: 3,
          name5: 1,
          name6: 2,
        },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      // Only entries with count > 1 should generate messages: name3, name4, name6
      expect(collectors.errors.size).toBe(3);
    });

    it('should work with special characters in duplicate names', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { 'field-name_123': 2, 'another.field': 3 },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      const messages = Array.from(collectors.errors);

      expect(messages.length).toBe(2);
    });

    it('should use custom i18n string key', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { duplicate: 2 },
        strKey: 'my_custom_key',
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(1);
    });

    it('should pass context with collection information', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collection: { name: 'items', label: 'Items' },
      };

      checkDuplicateNames({
        nameCounts: { duplicate: 2 },
        strKey: 'duplicate_names',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('Items');
    });

    it('should pass context with file information', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collectionFile: { name: 'file.md', label: 'My File' },
      };

      checkDuplicateNames({
        nameCounts: { duplicate: 2 },
        strKey: 'duplicate_names',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('My File');
    });

    it('should pass context with multiple locators', () => {
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        collection: { name: 'posts', label: 'Posts' },
        collectionFile: { name: 'post-1', label: 'Post 1' },
        typedKeyPath: 'fields.tags',
      };

      checkDuplicateNames({
        nameCounts: { duplicate: 2 },
        strKey: 'duplicate_names',
        context,
        collectors,
      });

      const message = Array.from(collectors.errors)[0];

      expect(message).toContain('Posts');
      expect(message).toContain('Post 1');
      expect(message).toContain('fields.tags');
    });

    it('should iterate through all entries in nameCounts', () => {
      const collectors = createCollectors();
      /** @type {Record<string, number>} */
      const nameCounts = {};

      // Create a sparse object with duplicate counts scattered
      for (let i = 0; i < 10; i += 1) {
        nameCounts[`name${i}`] = i % 2 === 0 ? 1 : 2; // Alternating 1 and 2
      }

      checkDuplicateNames({
        nameCounts,
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      // Should have 5 duplicates (count === 2): name1, name3, name5, name7, name9
      expect(collectors.errors.size).toBe(5);
    });

    it('should handle duplicate count of exactly 2', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { duplicate: 2 },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(1);
    });

    it('should not add message for count of exactly 1', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { unique: 1 },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(0);
    });

    it('should add error by default (not warning)', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { duplicate: 2 },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(1);
      expect(collectors.warnings.size).toBe(0);
    });

    it('should filter out names with count <= 1 from processing', () => {
      const collectors = createCollectors();

      checkDuplicateNames({
        nameCounts: { a: 1, b: 1, c: 1 },
        strKey: 'duplicate_names',
        context: {},
        collectors,
      });

      expect(collectors.errors.size).toBe(0);
      expect(collectors.warnings.size).toBe(0);
    });
  });
});
