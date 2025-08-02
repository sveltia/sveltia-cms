import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';

import { formatSummary } from '$lib/services/contents/widgets/object/helper';

vi.mock('$lib/services/config');

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

    test('should ignore non-string, non-numeric values for fallback', () => {
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
      ).toEqual('5');
    });

    test('should return empty string for nested key paths without field configuration', () => {
      expect(
        formatSummary({
          ...baseArgs,
          keyPath: 'content.metadata',
          valueMap: {
            'content.metadata.title': 'Nested Title',
            'content.metadata.description': 'Nested Description',
          },
        }),
      ).toEqual('');
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
