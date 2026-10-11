/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, test, vi } from 'vitest';

import { populateDefaultValue } from '$lib/services/contents/draft/defaults';

import { getDefaultValueMap } from './defaults';

vi.mock('$lib/services/config');

// Mock user store with default empty values
vi.mock('$lib/services/user/account.svelte', () => ({
  user: { account: { backendName: 'github', login: '', name: '', email: '' } },
}));

/**
 * @import { ObjectField } from '$lib/types/public';
 */

/** @type {Pick<ObjectField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'object',
  name: 'test_object',
};

// Simplified populateDefault for testing - mimics populateDefaultValue for simple field types.
const testPopulateDefault = (/** @type {any} */ { content, keyPath, fieldConfig }) => {
  const { default: defaultValue } = fieldConfig;

  content[keyPath] = defaultValue !== undefined ? defaultValue : '';
};

describe('Test getDefaultValueMap()', () => {
  describe('required field behavior', () => {
    test('should return defaults for required field subfields without default', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'content', widget: 'text' },
        ],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'metadata.title': '',
        'metadata.content': '',
      });
    });

    test('should return keyPath with null for optional field without default', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: false,
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'content', widget: 'text' },
        ],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({ metadata: null });
    });

    test('should return keyPath with null for field with variable types', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [], // ObjectField requires fields property
        types: [
          {
            name: 'article',
            label: 'Article',
            widget: 'object',
            fields: [{ name: 'title', widget: 'string' }],
          },
          {
            name: 'gallery',
            label: 'Gallery',
            widget: 'object',
            fields: [{ name: 'images', widget: 'list' }],
          },
        ],
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({ content: null });
    });
  });

  describe('default value handling', () => {
    test('should flatten and prefix object default values without keyPath null', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: {
          title: 'Default Title',
          author: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          published: true,
          tags: ['tech', 'coding'],
        },
        fields: [
          { name: 'title', widget: 'string' },
          {
            name: 'author',
            widget: 'object',
            fields: [
              { name: 'name', widget: 'string' },
              { name: 'email', widget: 'string' },
            ],
          },
          { name: 'published', widget: 'boolean' },
          { name: 'tags', widget: 'list' },
        ],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'metadata.title': 'Default Title',
        'metadata.author.name': 'John Doe',
        'metadata.author.email': 'john@example.com',
        'metadata.published': true,
        'metadata.tags.0': 'tech',
        'metadata.tags.1': 'coding',
      });
    });

    test('should escape the dots in the keys of the default value', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: { redirects: { 'example.com': 'a' } },
        fields: [{ name: 'redirects', widget: 'keyvalue' }],
      };

      expect(
        getDefaultValueMap({
          fieldConfig,
          keyPath: 'metadata',
          locale: '_default',
          defaultLocale: '_default',
          populateDefault: testPopulateDefault,
        }),
      ).toEqual({ 'metadata.redirects.example\uE000com': 'a' });
    });

    test('should populate subfield defaults for empty object default', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: {},
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({ 'metadata.title': '' });
    });

    test('should handle nested object with mixed data types', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: {
          config: {
            enabled: true,
            count: 42,
            ratio: 3.14,
            labels: {
              primary: 'Main',
              secondary: 'Alt',
            },
          },
          list: ['item1', 'item2'],
        },
        fields: [
          { name: 'config', widget: 'object' },
          { name: 'list', widget: 'list' },
        ],
      };

      const keyPath = 'settings';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'settings.config.enabled': true,
        'settings.config.count': 42,
        'settings.config.ratio': 3.14,
        'settings.config.labels.primary': 'Main',
        'settings.config.labels.secondary': 'Alt',
        'settings.list.0': 'item1',
        'settings.list.1': 'item2',
      });
    });

    test('should return subfield defaults for non-object default values', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        // @ts-expect-error - Testing invalid type
        default: 'not-an-object',
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'metadata.title': '',
      });
    });

    test('should return subfield defaults for null default values', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        // @ts-expect-error - Testing invalid type
        default: null,
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'metadata.title': '',
      });
    });

    test('should return subfield defaults for array default values', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: ['not', 'an', 'object'],
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'metadata.title': '',
      });
    });
  });

  describe('different key paths', () => {
    test('should handle simple key path', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: { title: 'Test' },
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'simple';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'simple.title': 'Test',
      });
    });

    test('should handle nested key path', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: { title: 'Test' },
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'parent.child.metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'parent.child.metadata.title': 'Test',
      });
    });
  });

  describe('dynamicValue parameter', () => {
    test('should ignore dynamicValue parameter as documented', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: { title: 'Default Title' },
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '{"title":"Dynamic Title"}',
      });

      // dynamicValue should be ignored as per the JSDoc comment
      expect(result).toEqual({
        'metadata.title': 'Default Title',
      });
    });
  });

  describe('subfield default values', () => {
    test('should populate subfield defaults when object has no default', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [
          { name: 'title', widget: 'string', default: 'Default Title' },
          { name: 'description', widget: 'text', default: 'Default Description' },
          { name: 'enabled', widget: 'boolean', default: true },
        ],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'metadata.title': 'Default Title',
        'metadata.description': 'Default Description',
        'metadata.enabled': true,
      });
    });

    test('should populate subfield defaults including empty strings', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [
          { name: 'title', widget: 'string', default: 'Default Title' },
          { name: 'content', widget: 'text', default: '' }, // Empty string should be included
          { name: 'published', widget: 'boolean', default: false },
          { name: 'category', widget: 'string' }, // No default
        ],
      };

      const keyPath = 'post';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'post.title': 'Default Title',
        'post.content': '',
        'post.published': false,
        'post.category': '',
      });
    });

    test('should include subfields with empty string defaults', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [
          { name: 'title', widget: 'string', default: '' },
          { name: 'content', widget: 'text', default: '' },
          { name: 'category', widget: 'string' }, // No default
        ],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'metadata.title': '',
        'metadata.content': '',
        'metadata.category': '',
      });
    });

    test('should handle subfields with different field types and defaults', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [
          { name: 'title', widget: 'string', default: 'Main Title' },
          { name: 'count', widget: 'number', default: 42 },
          { name: 'enabled', widget: 'boolean', default: true },
          { name: 'hidden_value', widget: 'hidden', default: 'secret' },
        ],
      };

      const keyPath = 'post';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'post.title': 'Main Title',
        'post.count': 42,
        'post.enabled': true,
        'post.hidden_value': 'secret',
      });
    });

    test('should handle simple list subfields with defaults', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [
          { name: 'title', widget: 'string', default: 'Post Title' },
          { name: 'description', widget: 'text', default: 'Default description' },
        ],
      };

      const keyPath = 'article';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'article.title': 'Post Title',
        'article.description': 'Default description',
      });
    });

    test('should handle mixed subfields with some having defaults and others not', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [
          { name: 'title', widget: 'string', default: 'Default Title' },
          { name: 'content', widget: 'text' }, // No default
          { name: 'published', widget: 'boolean', default: false },
          { name: 'author', widget: 'string' }, // No default
          { name: 'priority', widget: 'number', default: 1 },
        ],
      };

      const keyPath = 'entry';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'entry.title': 'Default Title',
        'entry.content': '',
        'entry.published': false,
        'entry.author': '',
        'entry.priority': 1,
      });
    });

    test('should prefer object default over subfield defaults', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: {
          title: 'Object Default Title',
          content: 'Object Default Content',
        },
        fields: [
          { name: 'title', widget: 'string', default: 'Subfield Default Title' },
          { name: 'content', widget: 'text', default: 'Subfield Default Content' },
          { name: 'published', widget: 'boolean', default: true },
        ],
      };

      const keyPath = 'post';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      // Object default should take precedence, while a subfield it leaves out gets its own default
      expect(result).toEqual({
        'post.title': 'Object Default Title',
        'post.content': 'Object Default Content',
        'post.published': true,
      });
    });

    test('should populate the defaults of subfields the object default leaves out', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: { title: 'x' },
        fields: [
          { name: 'title', widget: 'string', default: 'Subfield Default Title' },
          { name: 'featured', widget: 'boolean', default: true },
          { name: 'summary', widget: 'string' },
        ],
      };

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath: 'post',
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({ 'post.title': 'x', 'post.featured': true, 'post.summary': '' });
    });

    test('should not populate a nested subfield the object default gives in part', () => {
      const populateDefault = vi.fn(testPopulateDefault);

      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: { author: { name: 'Jane' }, links: [] },
        fields: [
          {
            name: 'author',
            widget: 'object',
            fields: [
              { name: 'name', widget: 'string' },
              { name: 'email', widget: 'string', default: 'a@example.com' },
            ],
          },
          { name: 'links', widget: 'list', default: ['https://example.com'] },
          { name: 'body', widget: 'object', fields: [{ name: 'text', widget: 'string' }] },
        ],
      };

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath: 'post',
        locale: 'en',
        defaultLocale: 'en',
        populateDefault,
      });

      // `author` and `links` are given by the object default and kept as they are; `body` is left
      // out, so it gets its own default value through the field’s function
      expect(populateDefault).toHaveBeenCalledTimes(1);
      expect(populateDefault).toHaveBeenCalledWith({
        content: result,
        keyPath: 'post.body',
        fieldConfig: fieldConfig.fields[2],
        locale: 'en',
        defaultLocale: 'en',
        dynamicValues: {},
      });
      expect(result).toEqual({
        'post.author.name': 'Jane',
        'post.links': [],
        'post.body': '',
      });
    });

    test('should give left-out nested subfields their own defaults with the real functions', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: { title: 'x' },
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'featured', widget: 'boolean', default: true },
          {
            name: 'meta',
            widget: 'object',
            fields: [{ name: 'lang', widget: 'string', default: 'en' }],
          },
          {
            name: 'seo',
            widget: 'object',
            default: { noindex: false },
            fields: [
              { name: 'noindex', widget: 'boolean', default: true },
              { name: 'description', widget: 'string', default: 'Hello' },
            ],
          },
          { name: 'tags', widget: 'list', default: ['news'] },
        ],
      };

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath: 'post',
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: populateDefaultValue,
      });

      expect(result).toEqual({
        'post.title': 'x',
        'post.featured': true,
        'post.meta.lang': 'en',
        'post.seo.noindex': false,
        'post.seo.description': 'Hello',
        'post.tags': [],
        'post.tags.0': 'news',
      });
    });

    test('should populate the subfield defaults of the type chosen in the object default', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: { kind: 'article', title: 'x' },
        typeKey: 'kind',
        types: [
          {
            name: 'article',
            widget: 'object',
            fields: [
              { name: 'title', widget: 'string' },
              { name: 'featured', widget: 'boolean', default: true },
            ],
          },
          {
            name: 'gallery',
            widget: 'object',
            fields: [{ name: 'caption', widget: 'string', default: 'Gallery' }],
          },
        ],
      };

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath: 'block',
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'block.kind': 'article',
        'block.title': 'x',
        'block.featured': true,
      });
    });

    test('should populate no subfield defaults when the object default has no known type', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: { title: 'x' },
        types: [
          {
            name: 'article',
            widget: 'object',
            fields: [{ name: 'featured', widget: 'boolean', default: true }],
          },
        ],
      };

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath: 'block',
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({ 'block.title': 'x' });
    });
  });

  describe('edge cases', () => {
    test('should return subfield defaults for undefined default value', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'metadata.title': '',
      });
    });

    test('should handle object field without subfields', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: { title: 'Test' },
        fields: [],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'metadata.title': 'Test',
      });
    });

    test('should handle complex nested structures', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: {
          level1: {
            level2: {
              level3: {
                deep: 'value',
                array: [{ item: 'first' }, { item: 'second' }],
              },
            },
          },
        },
        fields: [{ name: 'level1', widget: 'object' }],
      };

      const keyPath = 'root';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({
        'root.level1.level2.level3.deep': 'value',
        'root.level1.level2.level3.array.0.item': 'first',
        'root.level1.level2.level3.array.1.item': 'second',
      });
    });
  });

  describe('edge cases', () => {
    test('should return empty object for required field with no subfields and no default', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [],
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        populateDefault: testPopulateDefault,
      });

      expect(result).toEqual({});
    });
  });
});
