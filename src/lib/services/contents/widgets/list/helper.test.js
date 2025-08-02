import { writable } from 'svelte/store';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import { formatSummary } from './helper';

vi.mock('$lib/services/config');

describe('Test formatSummary() — comprehensive tests', () => {
  describe('Multiple fields configuration', () => {
    let siteConfig;

    beforeAll(async () => {
      const configModule = await import('$lib/services/config');

      siteConfig = writable({
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
      });
      // @ts-ignore
      configModule.siteConfig = siteConfig;
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
      (await import('$lib/services/config')).siteConfig = writable({
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
      });
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
