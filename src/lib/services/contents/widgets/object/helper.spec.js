import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';
import { formatSummary, getDefaultValueMap } from '$lib/services/contents/widgets/object/helper';

vi.mock('$lib/services/config');

/**
 * @import { ObjectField } from '$lib/types/public';
 */

/** @type {Pick<ObjectField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'object',
  name: 'test_object',
};

describe('Test getDefaultValueMap()', () => {
  describe('required field behavior', () => {
    test('should return empty object for required field without default', () => {
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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({});
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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({
        'metadata.title': 'Default Title',
        'metadata.author.name': 'John Doe',
        'metadata.author.email': 'john@example.com',
        'metadata.published': true,
        'metadata.tags.0': 'tech',
        'metadata.tags.1': 'coding',
      });
    });

    test('should return empty object for empty object default', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: {},
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({});
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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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

    test('should return empty object for non-object default values', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        // @ts-expect-error - Testing invalid type
        default: 'not-an-object',
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({});
    });

    test('should return empty object for null default values', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        // @ts-expect-error - Testing invalid type
        default: null,
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({});
    });

    test('should return empty object for array default values', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        default: ['not', 'an', 'object'],
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({});
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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
        dynamicValue: '{"title":"Dynamic Title"}',
      });

      // dynamicValue should be ignored as per the JSDoc comment
      expect(result).toEqual({
        'metadata.title': 'Default Title',
      });
    });
  });

  describe('edge cases', () => {
    test('should return empty object for undefined default value', () => {
      /** @type {ObjectField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
        fields: [{ name: 'title', widget: 'string' }],
      };

      const keyPath = 'metadata';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({});
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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({
        'root.level1.level2.level3.deep': 'value',
        'root.level1.level2.level3.array.0.item': 'first',
        'root.level1.level2.level3.array.1.item': 'second',
      });
    });
  });
});

describe('Test formatSummary() — comprehensive tests', async () => {
  // @ts-ignore
  (await import('$lib/services/config')).siteConfig = writable({
    backend: { name: 'github' },
    media_folder: 'static/uploads',
    collections: [
      {
        name: 'posts',
        folder: 'content/posts',
        fields: [
          {
            name: 'metadata',
            widget: 'object',
            fields: [
              { name: 'title', widget: 'string' },
              { name: 'name', widget: 'string' },
              { name: 'description', widget: 'text' },
              { name: 'author', widget: 'string' },
              { name: 'featured', widget: 'boolean' },
              { name: 'date', widget: 'date', picker_utc: true, time_format: false },
              { name: 'hidden_field', widget: 'hidden' },
              { name: 'tags', widget: 'list', field: { name: 'tag', widget: 'string' } },
              { name: 'rating', widget: 'number' },
            ],
          },
        ],
      },
    ],
  });

  const baseArgs = {
    collectionName: 'posts',
    keyPath: 'metadata',
    locale: 'en',
  };

  const basicValueMap = {
    'metadata.description': 'A comprehensive test description',
    'metadata.author': 'Test Author',
    'metadata.featured': true,
    'metadata.date': '2024-01-01',
    'metadata.hidden_field': 'should_not_appear',
    'metadata.rating': 4.5,
  };

  describe('without template', () => {
    test('should prioritize title field', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: { 'metadata.title': 'Main Title', ...basicValueMap },
        }),
      ).toEqual('Main Title');
    });

    test('should fall back to name field when title is empty', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: { 'metadata.title': '', 'metadata.name': 'Object Name', ...basicValueMap },
        }),
      ).toEqual('Object Name');
    });

    test('should use first visible string field when title and name are empty', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: { 'metadata.title': '', 'metadata.name': '', ...basicValueMap },
        }),
      ).toEqual('A comprehensive test description');
    });

    test('should skip hidden fields', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: {
            'metadata.title': '',
            'metadata.name': '',
            'metadata.description': '',
            'metadata.author': '',
            'metadata.hidden_field': 'hidden_value',
          },
        }),
      ).toEqual('');
    });

    test('should handle empty object', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: {},
        }),
      ).toEqual('');
    });

    test('should handle whitespace-only values', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: {
            'metadata.title': '   ',
            'metadata.name': '\t\n',
            'metadata.description': '',
            'metadata.author': 'Valid Author',
          },
        }),
      ).toEqual('Valid Author');
    });

    test('should ignore non-string values for fallback', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: {
            'metadata.title': '',
            'metadata.name': '',
            'metadata.featured': true,
            'metadata.rating': 5,
            'metadata.author': 'String Value',
          },
        }),
      ).toEqual('String Value');
    });

    test('should handle nested key paths', () => {
      expect(
        formatSummary({
          ...baseArgs,
          keyPath: 'content.metadata',
          valueMap: {
            'content.metadata.title': 'Nested Title',
            'content.metadata.description': 'Nested Description',
          },
        }),
      ).toEqual('Nested Title');
    });
  });

  describe('with template', () => {
    test('should use single template field', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: { 'metadata.title': 'Title', ...basicValueMap },
          summaryTemplate: '{{fields.author}}',
        }),
      ).toEqual('Test Author');
    });

    test('should handle multiple placeholders', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '{{fields.author}} - {{fields.description}}',
        }),
      ).toEqual('Test Author - A comprehensive test description');
    });

    test('should return empty string for non-existent fields', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '{{fields.nonexistent}}',
        }),
      ).toEqual('');
    });

    test('should handle fields. prefix properly', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '{{author}}',
        }),
      ).toEqual('Test Author');
    });

    test('should handle complex template patterns', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: 'By {{fields.author}}: {{fields.description}}',
        }),
      ).toEqual('By Test Author: A comprehensive test description');
    });

    test('should handle boolean values in templates', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '{{fields.featured}}',
        }),
      ).toEqual('true');
    });

    test('should handle numeric values in templates', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '{{fields.rating}}',
        }),
      ).toEqual('4.5');
    });

    test('should handle empty template string', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '',
        }),
      ).toEqual('A comprehensive test description');
    });
  });

  describe('with template and transformations', () => {
    test('should apply single transformation', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '{{fields.author | upper}}',
        }),
      ).toEqual('TEST AUTHOR');
    });

    test('should apply multiple transformations', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '{{fields.author | upper | truncate(4)}}',
        }),
      ).toEqual('TEST…');
    });

    test('should handle ternary transformation with boolean', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: "{{fields.featured | ternary('Featured','Not Featured')}}",
        }),
      ).toEqual('Featured');
    });

    test('should handle date transformation', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: "{{fields.date | date('MMM YYYY')}}",
        }),
      ).toEqual('Jan 2024');
    });

    test('should handle transformation on non-existent field', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '{{fields.nonexistent | upper}}',
        }),
      ).toEqual('');
    });

    test('should handle complex transformation chains', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: { ...basicValueMap, 'metadata.description': 'hello world test description' },
          summaryTemplate: '{{fields.description | upper | truncate(15)}}',
        }),
      ).toEqual('HELLO WORLD TES…');
    });

    test('should handle number transformations', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '{{fields.rating}}',
        }),
      ).toEqual('4.5');
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle missing collection configuration', () => {
      expect(
        formatSummary({
          ...baseArgs,
          collectionName: 'nonexistent',
          valueMap: basicValueMap,
        }),
      ).toEqual('A comprehensive test description');
    });

    test('should handle file collections', () => {
      expect(
        formatSummary({
          ...baseArgs,
          fileName: 'config.yml',
          valueMap: basicValueMap,
        }),
      ).toEqual('A comprehensive test description');
    });

    test('should handle index files', () => {
      expect(
        formatSummary({
          ...baseArgs,
          isIndexFile: true,
          valueMap: basicValueMap,
        }),
      ).toEqual('A comprehensive test description');
    });

    test('should handle malformed template patterns', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: '{{fields.author',
        }),
      ).toEqual('{{fields.author');
    });

    test('should handle templates with no placeholders', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: basicValueMap,
          summaryTemplate: 'Static Text',
        }),
      ).toEqual('Static Text');
    });

    test('should handle deeply nested objects', () => {
      expect(
        formatSummary({
          ...baseArgs,
          keyPath: 'content.section.metadata',
          valueMap: {
            'content.section.metadata.title': 'Deep Title',
            'content.section.metadata.author': 'Deep Author',
          },
          summaryTemplate: '{{fields.title}} by {{fields.author}}',
        }),
      ).toEqual('Deep Title by Deep Author');
    });

    test('should handle special characters in field values', () => {
      expect(
        formatSummary({
          ...baseArgs,
          valueMap: {
            'metadata.title': 'Title with "quotes" & <tags>',
            'metadata.author': 'Author with €uro signs',
          },
          summaryTemplate: '{{fields.title}} - {{fields.author}}',
        }),
      ).toEqual('Title with "quotes" & <tags> - Author with €uro signs');
    });

    test('should handle very long field values', () => {
      const longValue = 'A'.repeat(1000);

      expect(
        formatSummary({
          ...baseArgs,
          valueMap: { 'metadata.title': longValue },
        }),
      ).toEqual(longValue);
    });

    test('should handle different locale contexts', () => {
      expect(
        formatSummary({
          ...baseArgs,
          locale: 'ja',
          valueMap: { 'metadata.title': 'Japanese Title', ...basicValueMap },
        }),
      ).toEqual('Japanese Title');
    });
  });
});
