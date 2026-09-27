import { beforeAll, describe, expect, test, vi } from 'vitest';

import {
  formatSummary,
  getListFieldInfo,
  getListItemKey,
  isSingleItemList,
  tagListItems,
} from './helpers';

vi.mock('$lib/services/config');

describe('Test formatSummary() — comprehensive tests', () => {
  describe('Multiple fields configuration', () => {
    let cmsConfig;

    beforeAll(async () => {
      const configModule = await import('$lib/services/config');

      cmsConfig = {
        current: {
          backend: { name: 'github' },
          media_folder: 'static/uploads',
          collections: [
            {
              name: 'posts',
              folder: 'content/posts',
              fields: [
                {
                  name: 'images',
                  widget: 'list',
                  fields: [
                    { name: 'title', widget: 'string' },
                    { name: 'name', widget: 'string' },
                    { name: 'src', widget: 'image' },
                    { name: 'alt', widget: 'string' },
                    { name: 'featured', widget: 'boolean' },
                    { name: 'date', widget: 'date', picker_utc: true, time_format: false },
                    { name: 'hidden_field', widget: 'hidden' },
                    { name: 'number_value', widget: 'number' },
                  ],
                },
              ],
            },
          ],
        },
      };
      // @ts-ignore
      configModule.cmsConfig = cmsConfig;
    });

    const baseArgs = {
      collectionName: 'posts',
      keyPath: 'images',
      locale: 'en',
      hasSingleSubField: false,
      index: 0,
    };

    const basicValueMap = {
      'images.0.src': 'hello.jpg',
      'images.0.alt': 'hello',
      'images.0.featured': true,
      'images.0.date': '2024-01-01',
      'images.0.hidden_field': 'should_not_appear',
      'images.0.number_value': 42,
    };

    describe('without template', () => {
      test('should prioritize title field', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0.title': 'Title Value', ...basicValueMap },
          }),
        ).toEqual('Title Value');
      });

      test('should fall back to name field when title is empty', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0.title': '', 'images.0.name': 'Name Value', ...basicValueMap },
          }),
        ).toEqual('Name Value');
      });

      test('should use first visible string field when title and name are empty', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0.title': '', 'images.0.name': '', ...basicValueMap },
          }),
        ).toEqual('hello.jpg');
      });

      test('should skip hidden fields', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: {
              'images.0.title': '',
              'images.0.name': '',
              'images.0.src': '',
              'images.0.alt': '',
              'images.0.hidden_field': 'hidden_value',
            },
          }),
        ).toEqual('');
      });

      test('should handle empty values gracefully', () => {
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
              'images.0.title': '   ',
              'images.0.name': '\t\n',
              'images.0.alt': 'valid_value',
            },
          }),
        ).toEqual('valid_value');
      });

      test('should handle different data types', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: {
              'images.0.title': '',
              'images.0.name': '',
              'images.0.number_value': 1234,
            },
          }),
        ).toEqual('1,234');
      });

      test('should reuse cached regex when called twice with the same keyPath and index', () => {
        // Exercises the listSummaryRegexCache hit path added by the perf optimisation.
        const result1 = formatSummary({ ...baseArgs, valueMap: basicValueMap });
        const result2 = formatSummary({ ...baseArgs, valueMap: basicValueMap });

        expect(result1).toEqual(result2);
      });
    });

    describe('with template', () => {
      test('should use template field values', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0.title': 'Title', ...basicValueMap },
            summaryTemplate: '{{fields.alt}}',
          }),
        ).toEqual('hello');
      });

      test('should handle multiple placeholders', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: basicValueMap,
            summaryTemplate: '{{fields.alt}} - {{fields.src}}',
          }),
        ).toEqual('hello - hello.jpg');
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

      test('should handle complex template patterns', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: basicValueMap,
            summaryTemplate: 'Image: {{fields.alt}} ({{fields.src}})',
          }),
        ).toEqual('Image: hello (hello.jpg)');
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
            summaryTemplate: '{{fields.number_value}}',
          }),
        ).toEqual('42');
      });
    });

    describe('with template and transformations', () => {
      test('should apply single transformation', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: basicValueMap,
            summaryTemplate: '{{fields.alt | upper}}',
          }),
        ).toEqual('HELLO');
      });

      test('should apply multiple transformations', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: basicValueMap,
            summaryTemplate: '{{fields.alt | upper | truncate(2)}}',
          }),
        ).toEqual('HE…');
      });

      test('should handle ternary transformation with boolean', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: basicValueMap,
            summaryTemplate: "{{fields.featured | ternary('featured','not featured')}}",
          }),
        ).toEqual('featured');
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
            valueMap: { ...basicValueMap, 'images.0.alt': 'hello world test' },
            summaryTemplate: '{{fields.alt | upper | truncate(10)}}',
          }),
        ).toEqual('HELLO WORL…');
      });

      test('should handle nested templates in default transformation', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: {
              'images.0.alt': '', // Empty value to trigger default
              'images.0.title': 'Main Title',
              'images.0.name': 'Image Name',
            },
            summaryTemplate: "{{fields.alt | default('{{fields.title}}')}}",
          }),
        ).toEqual('Main Title');
      });

      test('should handle nested templates in ternary transformation', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: {
              'images.0.title': 'Main Title',
              'images.0.name': 'Fallback Name',
              'images.0.featured': true,
            },
            summaryTemplate: "{{fields.featured | ternary('{{fields.title}}', '{{fields.name}}')}}",
          }),
        ).toEqual('Main Title');
      });

      test('should handle nested templates with missing inner field', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0.name': 'Name Value' },
            summaryTemplate: "{{fields.alt | default('{{fields.title}}')}}",
          }),
        ).toEqual('');
      });
    });

    describe('edge cases and error handling', () => {
      test('should handle different index values', () => {
        const valueMapWithIndex1 = {
          'images.1.title': 'Second Item',
          'images.1.alt': 'second',
        };

        expect(
          formatSummary({
            ...baseArgs,
            index: 1,
            valueMap: valueMapWithIndex1,
          }),
        ).toEqual('Second Item');
      });

      test('should return empty string when collection configuration is missing', () => {
        expect(
          formatSummary({
            ...baseArgs,
            collectionName: 'nonexistent',
            valueMap: basicValueMap,
          }),
        ).toEqual('');
      });

      test('should handle file collections', () => {
        expect(
          formatSummary({
            ...baseArgs,
            fileName: 'config.yml',
            valueMap: basicValueMap,
          }),
        ).toEqual('hello.jpg');
      });

      test('should handle index files', () => {
        expect(
          formatSummary({
            ...baseArgs,
            isIndexFile: true,
            valueMap: basicValueMap,
          }),
        ).toEqual('hello.jpg');
      });

      test('should handle malformed template patterns', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: basicValueMap,
            summaryTemplate: '{{fields.alt',
          }),
        ).toEqual('{{fields.alt');
      });

      test('should handle empty template', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: basicValueMap,
            summaryTemplate: '',
          }),
        ).toEqual('hello.jpg');
      });
    });
  });

  describe('Single field configuration', () => {
    beforeAll(async () => {
      // Clear the field config cache to prevent interference from previous tests
      const { fieldConfigCacheMap } = await import('$lib/services/contents/entry/fields');
      const { collectionCacheMap } = await import('$lib/services/contents/collection');

      fieldConfigCacheMap.clear();
      collectionCacheMap.clear();

      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = {
        current: {
          backend: { name: 'github' },
          media_folder: 'static/uploads',
          collections: [
            {
              name: 'posts',
              folder: 'content/posts',
              fields: [
                {
                  name: 'images',
                  widget: 'list',
                  field: { name: 'src', widget: 'image' },
                },
                {
                  name: 'tags',
                  widget: 'list',
                  field: { name: 'tag', widget: 'string' },
                },
              ],
            },
          ],
        },
      };
    });

    const baseArgs = {
      collectionName: 'posts',
      keyPath: 'images',
      locale: 'en',
      hasSingleSubField: true,
      index: 0,
    };

    describe('without template', () => {
      test('should return field value directly', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0': 'hello.jpg' },
          }),
        ).toEqual('hello.jpg');
      });

      test('should handle empty values', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0': '' },
          }),
        ).toEqual('');
      });

      test('should handle undefined values', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: {},
          }),
        ).toEqual(undefined);
      });

      test('should handle different data types', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0': 123 },
          }),
        ).toEqual(123);

        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0': true },
          }),
        ).toEqual(true);
      });
    });

    describe('with template', () => {
      test('should use template with valid field', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0': 'hello.jpg' },
            summaryTemplate: '{{fields.src}}',
          }),
        ).toEqual('hello.jpg');
      });

      test('should return empty for invalid field paths', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0': 'hello.jpg' },
            summaryTemplate: '{{fields.alt}}',
          }),
        ).toEqual('');
      });

      test('should handle multiple templates', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0': 'hello.jpg' },
            summaryTemplate: 'File: {{fields.src}} ({{fields.src}})',
          }),
        ).toEqual('File: hello.jpg (hello.jpg)');
      });
    });

    describe('with template and transformations', () => {
      test('should apply transformations', () => {
        expect(
          formatSummary({
            ...baseArgs,
            valueMap: { 'images.0': 'hello.jpg' },
            summaryTemplate: '{{fields.src | upper | truncate(5)}}',
          }),
        ).toEqual('HELLO…');
      });

      test('should handle string transformations', () => {
        expect(
          formatSummary({
            ...baseArgs,
            keyPath: 'tags',
            valueMap: { 'tags.0': 'javascript' },
            summaryTemplate: '{{fields.tag | upper}}',
          }),
        ).toEqual('JAVASCRIPT');
      });

      test('should handle nested templates in default transformation for single-field lists', () => {
        expect(
          formatSummary({
            ...baseArgs,
            keyPath: 'tags',
            valueMap: { 'tags.0': '', 'tags.1': 'fallback-value' },
            summaryTemplate: "{{fields.tag | default('{{fields.tag}}')}}",
          }),
        ).toEqual('');
      });

      test('should handle nested templates with mismatched field name', () => {
        expect(
          formatSummary({
            ...baseArgs,
            keyPath: 'tags',
            valueMap: { 'tags.0': '' },
            summaryTemplate: "{{fields.tag | default('{{fields.nonexistent}}')}}",
          }),
        ).toEqual('');
      });
    });

    describe('edge cases', () => {
      test('should handle different index values', () => {
        expect(
          formatSummary({
            ...baseArgs,
            index: 2,
            valueMap: { 'images.2': 'third.jpg' },
          }),
        ).toEqual('third.jpg');
      });

      test('should handle nested key paths', () => {
        expect(
          formatSummary({
            ...baseArgs,
            keyPath: 'gallery.images',
            valueMap: { 'gallery.images.0': 'nested.jpg' },
          }),
        ).toEqual('nested.jpg');
      });
    });
  });
});

describe('Test getListFieldInfo()', () => {
  test('field with single sub-field (field option)', () => {
    /** @type {import('$lib/types/public').ListField} */
    const fieldConfig = {
      name: 'items',
      widget: 'list',
      field: { name: 'item', widget: 'string' },
    };

    const result = getListFieldInfo(fieldConfig);

    expect(result).toEqual({
      hasSingleSubField: true,
      hasMultiSubFields: false,
      hasVariableTypes: false,
      hasSubFields: true,
    });
  });

  test('field with multiple sub-fields (fields option)', () => {
    /** @type {import('$lib/types/public').ListField} */
    const fieldConfig = {
      name: 'items',
      widget: 'list',
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'description', widget: 'text' },
      ],
    };

    const result = getListFieldInfo(fieldConfig);

    expect(result).toEqual({
      hasSingleSubField: false,
      hasMultiSubFields: true,
      hasVariableTypes: false,
      hasSubFields: true,
    });
  });

  test('field with variable types (types option)', () => {
    /** @type {import('$lib/types/public').ListField} */
    const fieldConfig = {
      name: 'items',
      widget: 'list',
      types: [
        { name: 'image', fields: [{ name: 'src', widget: 'image' }] },
        { name: 'text', fields: [{ name: 'content', widget: 'text' }] },
      ],
    };

    const result = getListFieldInfo(fieldConfig);

    expect(result).toEqual({
      hasSingleSubField: false,
      hasMultiSubFields: false,
      hasVariableTypes: true,
      hasSubFields: true,
    });
  });

  test('field with no sub-fields', () => {
    /** @type {import('$lib/types/public').ListField} */
    const fieldConfig = {
      name: 'items',
      widget: 'list',
    };

    const result = getListFieldInfo(fieldConfig);

    expect(result).toEqual({
      hasSingleSubField: false,
      hasMultiSubFields: false,
      hasVariableTypes: false,
      hasSubFields: false,
    });
  });

  test('field with empty fields array (should be truthy)', () => {
    /** @type {import('$lib/types/public').ListField} */
    const fieldConfig = {
      name: 'items',
      widget: 'list',
      fields: [],
    };

    const result = getListFieldInfo(fieldConfig);

    expect(result).toEqual({
      hasSingleSubField: false,
      hasMultiSubFields: true,
      hasVariableTypes: false,
      hasSubFields: true,
    });
  });

  test('field with empty types array (should be truthy)', () => {
    /** @type {import('$lib/types/public').ListField} */
    const fieldConfig = {
      name: 'items',
      widget: 'list',
      types: [],
    };

    const result = getListFieldInfo(fieldConfig);

    expect(result).toEqual({
      hasSingleSubField: false,
      hasMultiSubFields: false,
      hasVariableTypes: true,
      hasSubFields: true,
    });
  });
});

describe('Test isSingleItemList()', () => {
  test('should be true for a list limited to one item holding no more than that', () => {
    /** @type {any} */
    const fieldConfig = { name: 'author', widget: 'list', max: 1, fields: [] };

    expect(isSingleItemList({ fieldConfig, itemCount: 0 })).toBe(true);
    expect(isSingleItemList({ fieldConfig, itemCount: 1 })).toBe(true);
    // More items than the limit, e.g. from a file edited outside the CMS
    expect(isSingleItemList({ fieldConfig, itemCount: 2 })).toBe(false);
    expect(isSingleItemList({ fieldConfig: { ...fieldConfig, max: 2 }, itemCount: 1 })).toBe(false);
    expect(
      isSingleItemList({ fieldConfig: { ...fieldConfig, max: undefined }, itemCount: 1 }),
    ).toBe(false);
  });
});

describe('Test getListItemKey()', () => {
  test('uses the generated ID of an object item', () => {
    expect(getListItemKey([{ __sc_item_id: 'abc' }], 0)).toBe('abc');
  });

  test('falls back to the index for an object item without an ID', () => {
    expect(getListItemKey([{}, { title: 'b' }], 1)).toBe(1);
  });

  test('uses the index for a primitive or missing item', () => {
    expect(getListItemKey(['a', 'b'], 1)).toBe(1);
    expect(getListItemKey([], 2)).toBe(2);
  });
});

describe('Test tagListItems()', () => {
  test('records the original key path of every object item, keeping existing tags', () => {
    const list = [{ a: 1 }, 'text', { b: 2, __sc_item_original_key_path: 'items.5' }];

    tagListItems(list, 'items');

    expect(list).toEqual([
      { a: 1, __sc_item_original_key_path: 'items.0' },
      'text',
      { b: 2, __sc_item_original_key_path: 'items.5' },
    ]);
  });

  test('also assigns IDs when requested, keeping existing ones', () => {
    /** @type {any[]} */
    const list = [{ a: 1 }, { b: 2, __sc_item_id: 'existing' }, 3];

    tagListItems(list, 'items', { assignIds: true });

    expect(list[0].__sc_item_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(list[0].__sc_item_original_key_path).toBe('items.0');
    expect(list[1]).toEqual({
      b: 2,
      __sc_item_id: 'existing',
      __sc_item_original_key_path: 'items.1',
    });
    expect(list[2]).toBe(3);
  });
});
