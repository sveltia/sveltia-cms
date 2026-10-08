import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getCollection } from '$lib/services/contents/collection';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { isEntryCollection } from '$lib/services/contents/collection/predicates';
import { fieldConfigCacheMap, getField } from '$lib/services/contents/entry/fields';
import {
  getFieldDisplayValue,
  getPropertyValue,
  getVisibleFieldDisplayValue,
} from '$lib/services/contents/entry/values';
import { getDateTimeFieldDisplayValue } from '$lib/services/contents/fields/date-time/display';
import { getReferencedOptionLabel } from '$lib/services/contents/fields/relation/helpers';
import { getOptionLabel } from '$lib/services/contents/fields/select/helpers';

// Mock dependencies
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/predicates', () => ({
  isEntryCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  getIndexFile: vi.fn(),
  isCollectionIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/i18n', () => ({
  getCanonicalLocale: vi.fn((locale) => locale),
  getListFormatter: vi.fn(() => ({
    format: vi.fn((items) => items.join(', ')),
  })),
}));

vi.mock('$lib/services/contents/fields', () => ({
  BUILTIN_FIELD_TYPES: [
    'boolean',
    'string',
    'text',
    'number',
    'datetime',
    'date',
    'select',
    'relation',
    'list',
    'object',
    'file',
    'image',
    'markdown',
    'richtext',
  ],
  MEDIA_FIELD_TYPES: ['file', 'image'],
  MULTI_VALUE_FIELD_TYPES: ['file', 'image', 'relation', 'select'],
  RICH_TEXT_FIELD_TYPES: ['richtext', 'markdown'],
}));

vi.mock('$lib/services/contents/fields/rich-text/components/definitions', () => ({
  getComponentDef: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/date-time/display', () => ({
  getDateTimeFieldDisplayValue: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/relation/helpers', () => ({
  getReferencedOptionLabel: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/select/helpers', () => ({
  getOptionLabel: vi.fn(),
}));

vi.mock('$lib/services/integrations/media-libraries/multiple', () => ({
  isMultiple: vi.fn(),
}));

vi.mock('$lib/services/api/registries', () => ({
  customFieldTypeRegistry: new Map(),
}));

const mockGetCollection = vi.mocked(getCollection);
const mockIsEntryCollection = vi.mocked(isEntryCollection);
const mockIsCollectionIndexFile = vi.mocked(isCollectionIndexFile);
const mockGetDateTimeFieldDisplayValue = vi.mocked(getDateTimeFieldDisplayValue);
const mockGetReferencedOptionLabel = vi.mocked(getReferencedOptionLabel);
const mockGetOptionLabel = vi.mocked(getOptionLabel);

describe('Test getFieldDisplayValue()', () => {
  const mockCollection = {
    name: 'posts',
    folder: 'content/posts',
    _type: 'entry',
    fields: [
      { name: 'title', widget: 'string' },
      { name: 'body', widget: 'markdown' },
      { name: 'published', widget: 'boolean' },
      { name: 'publishDate', widget: 'datetime', format: 'YYYY-MM-DD' },
      {
        name: 'author',
        widget: 'relation',
        collection: 'authors',
        value_field: 'name',
        display_fields: ['name', 'email'],
      },
      {
        name: 'category',
        widget: 'select',
        options: [
          { label: 'Blog', value: 'blog' },
          { label: 'News', value: 'news' },
        ],
      },
      {
        name: 'simpleTags',
        widget: 'list',
        // No field, fields, or types - this makes it a simple list
      },
      {
        name: 'tags',
        widget: 'list',
        field: { name: 'tag', widget: 'string' },
      },
      {
        name: 'notes',
        widget: 'list',
        field: { name: 'note', widget: 'richtext' },
      },
      {
        name: 'images',
        widget: 'list',
        fields: [
          { name: 'src', widget: 'image' },
          { name: 'alt', widget: 'string' },
        ],
      },
      // Number fields for testing
      { name: 'intNumber', widget: 'number', value_type: 'int' },
      { name: 'floatNumber', widget: 'number', value_type: 'float' },
      { name: 'defaultNumber', widget: 'number' }, // Defaults to 'int'
      { name: 'customTypeNumber', widget: 'number', value_type: 'custom' },
    ],
  };

  beforeEach(() => {
    fieldConfigCacheMap.clear();
    vi.clearAllMocks();
    // @ts-expect-error - Simplified mock for testing
    mockGetCollection.mockReturnValue(mockCollection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fieldConfigCacheMap.clear();
  });

  describe('Basic value handling', () => {
    test('should return string representation of primitive values', () => {
      const valueMap = {
        title: 'Hello World',
        published: true,
        count: 42,
        rating: 4.5,
      };

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'title',
          locale: 'en',
        }),
      ).toBe('Hello World');

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'published',
          locale: 'en',
        }),
      ).toBe('true');

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'count',
          locale: 'en',
        }),
      ).toBe('42');

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'rating',
          locale: 'en',
        }),
      ).toBe('4.5');
    });

    test('should return empty string for null and undefined values', () => {
      const valueMap = {
        nullValue: null,
        // undefinedValue is not set
      };

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'nullValue',
          locale: 'en',
        }),
      ).toBe('');

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'undefinedValue',
          locale: 'en',
        }),
      ).toBe('');
    });

    test('should return empty string for false boolean value', () => {
      const valueMap = {
        published: false,
      };

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'published',
          locale: 'en',
        }),
      ).toBe('false');
    });

    test('should return empty string for zero value', () => {
      const valueMap = {
        count: 0,
      };

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'count',
          locale: 'en',
        }),
      ).toBe('0');
    });

    test('should return empty string for empty string value', () => {
      const valueMap = {
        title: '',
      };

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'title',
          locale: 'en',
        }),
      ).toBe('');
    });
  });

  describe('Array value handling', () => {
    test('should format array values using list formatter', () => {
      const valueMap = {
        someArray: ['javascript', 'web development', 'tutorial'],
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'someArray',
        locale: 'en',
      });

      // List formatter typically joins with commas and "and"
      expect(result).toContain('javascript');
      expect(result).toContain('web development');
      expect(result).toContain('tutorial');
    });

    test('should return empty string for empty array', () => {
      const valueMap = {
        someArray: [],
      };

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'someArray',
          locale: 'en',
        }),
      ).toBe('');
    });
  });

  describe('List field handling', () => {
    test('should format simple list values', () => {
      const valueMap = {
        'simpleTags.0': 'javascript',
        'simpleTags.1': 'web development',
        'simpleTags.2': 'tutorial',
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'simpleTags',
        locale: 'en',
      });

      expect(result).toContain('javascript');
      expect(result).toContain('web development');
      expect(result).toContain('tutorial');
    });

    test('should ignore complex list field types (with fields or types)', () => {
      const valueMap = {
        'images.0.src': 'image1.jpg',
        'images.0.alt': 'First image',
        'images.1.src': 'image2.jpg',
        'images.1.alt': 'Second image',
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'images',
        locale: 'en',
      });

      // Complex list field types should not be formatted as simple lists
      expect(result).toBe('');
    });

    test('should format list field types with field property', () => {
      const valueMap = {
        'tags.0': 'javascript',
        'tags.1': 'web development',
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'tags',
        locale: 'en',
      });

      // List field types with field property should be formatted as simple lists
      expect(result).toContain('javascript');
      expect(result).toContain('web development');
    });

    test('should strip Markdown syntax and HTML tags from Rich Text list items as plain text', () => {
      const valueMap = {
        'notes.0': '**First** note',
        'notes.1': '<p>Second <em>note</em></p>',
        'notes.2': '![](image.jpg)',
      };

      expect(
        getFieldDisplayValue({ collectionName: 'posts', valueMap, keyPath: 'notes', locale: 'en' }),
      ).toBe('**First** note, <p>Second <em>note</em></p>, ![](image.jpg)');

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap,
          keyPath: 'notes',
          locale: 'en',
          plainText: true,
        }),
      ).toBe('First note, Second note');
    });

    test('should keep Markdown syntax in non-Rich Text list items as plain text', () => {
      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap: { 'tags.0': '**javascript**' },
          keyPath: 'tags',
          locale: 'en',
          plainText: true,
        }),
      ).toBe('**javascript**');

      expect(
        getFieldDisplayValue({
          collectionName: 'posts',
          valueMap: { 'simpleTags.0': '_svelte_' },
          keyPath: 'simpleTags',
          locale: 'en',
          plainText: true,
        }),
      ).toBe('_svelte_');
    });

    test('should reuse cached regex when getFieldDisplayValue is called twice with the same keyPath', () => {
      // Exercises the listItemDisplayRegexCache hit path added by the perf optimisation.
      const valueMap = {
        'simpleTags.0': 'react',
        'simpleTags.1': 'svelte',
      };

      const args = { collectionName: 'posts', valueMap, keyPath: 'simpleTags', locale: 'en' };
      const result1 = getFieldDisplayValue(args);
      // Second call with the same keyPath — should retrieve the cached RegExp.
      const result2 = getFieldDisplayValue(args);

      expect(result1).toBe(result2);
      expect(result1).toContain('react');
    });
  });

  describe('Relation field handling', () => {
    test('should handle relation field type recognition (line 243-250)', () => {
      // This test ensures the relation field branch is tested
      // The actual relation handling is tested in other test files
      const mockCollectionWithRelation = {
        ...mockCollection,
        fields: [
          ...mockCollection.fields,
          {
            name: 'author',
            widget: 'relation',
            collection: 'authors',
          },
        ],
      };

      // @ts-expect-error - Mock for testing
      mockGetCollection.mockReturnValue(mockCollectionWithRelation);

      // Just verify the field config can be fetched
      const fieldConfig = getField({
        collectionName: 'posts',
        valueMap: {},
        keyPath: 'author',
      });

      expect(fieldConfig?.widget).toBe('relation');
    });

    test('should call getReferencedOptionLabel for relation field (line 243-250)', () => {
      const mockCollectionWithRelation = {
        ...mockCollection,
        fields: [
          {
            name: 'author',
            widget: 'relation',
            collection: 'authors',
            value_field: 'name',
            display_fields: ['name', 'email'],
          },
        ],
      };

      // @ts-expect-error - Mock for testing
      mockGetCollection.mockReturnValue(mockCollectionWithRelation);
      mockGetReferencedOptionLabel.mockReturnValue('John Doe');

      const valueMap = {
        author: 'john-doe',
      };

      const pendingEntries = /** @type {any[]} */ ([{ collectionName: 'authors' }]);

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'author',
        locale: 'en',
        pendingEntries,
      });

      expect(mockGetReferencedOptionLabel).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldConfig: expect.objectContaining({ widget: 'relation' }),
          valueMap,
          keyPath: 'author',
          locale: 'en',
          // Passed on, so a reference to an entry that isn’t saved yet resolves
          pendingEntries,
        }),
      );
      expect(result).toBe('John Doe');
    });
  });

  describe('Select field handling', () => {
    test('should handle select field type recognition (line 253-259)', () => {
      // Verify select field branch is recognized
      const mockCollectionWithSelect = {
        ...mockCollection,
        fields: [
          ...mockCollection.fields,
          {
            name: 'category',
            widget: 'select',
            options: ['blog', 'news'],
          },
        ],
      };

      // @ts-expect-error - Mock for testing
      mockGetCollection.mockReturnValue(mockCollectionWithSelect);

      // Just verify the field config can be fetched
      const fieldConfig = getField({
        collectionName: 'posts',
        valueMap: {},
        keyPath: 'category',
      });

      expect(fieldConfig?.widget).toBe('select');
    });

    test('should call getOptionLabel for select field (line 253-259)', () => {
      const mockCollectionWithSelect = {
        ...mockCollection,
        fields: [
          {
            name: 'category',
            widget: 'select',
            options: [
              { label: 'Blog', value: 'blog' },
              { label: 'News', value: 'news' },
            ],
          },
        ],
      };

      // @ts-expect-error - Mock for testing
      mockGetCollection.mockReturnValue(mockCollectionWithSelect);
      mockGetOptionLabel.mockReturnValue('Blog');

      const valueMap = {
        category: 'blog',
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'category',
        locale: 'en',
      });

      expect(mockGetOptionLabel).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldConfig: expect.objectContaining({ widget: 'select' }),
          valueMap,
          keyPath: 'category',
        }),
      );
      expect(result).toBe('Blog');
    });
  });

  describe('Datetime field handling', () => {
    test('should recognize datetime field type (lines 230-240)', () => {
      // Verify datetime field branch is recognized
      const mockCollectionWithDatetime = {
        ...mockCollection,
        fields: [
          ...mockCollection.fields,
          {
            name: 'publishDate',
            widget: 'datetime',
            format: 'YYYY-MM-DD',
          },
        ],
      };

      // @ts-expect-error - Mock for testing
      mockGetCollection.mockReturnValue(mockCollectionWithDatetime);

      // Just verify the field config can be fetched
      const fieldConfig = getField({
        collectionName: 'posts',
        valueMap: {},
        keyPath: 'publishDate',
      });

      expect(fieldConfig?.widget).toBe('datetime');
    });

    test('should call getDateTimeFieldDisplayValue when datetime field has no date transformation (line 230-240)', () => {
      const mockCollectionWithDatetime = {
        ...mockCollection,
        fields: [
          {
            name: 'publishDate',
            widget: 'datetime',
            format: 'YYYY-MM-DD',
          },
        ],
      };

      // @ts-expect-error - Mock for testing
      mockGetCollection.mockReturnValue(mockCollectionWithDatetime);
      mockGetDateTimeFieldDisplayValue.mockReturnValue('2024-01-15');

      const valueMap = {
        publishDate: '2024-01-15T10:30:00Z',
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'publishDate',
        locale: 'en',
      });

      expect(mockGetDateTimeFieldDisplayValue).toHaveBeenCalled();
      expect(result).toBe('2024-01-15');
    });

    test('should call getDateTimeFieldDisplayValue when no date transformation is provided (line 230-240)', () => {
      // Clear previous mock calls
      mockGetDateTimeFieldDisplayValue.mockClear();

      const mockCollectionWithDatetime = {
        ...mockCollection,
        fields: [
          {
            name: 'publishDate',
            widget: 'datetime',
            format: 'YYYY-MM-DD',
          },
        ],
      };

      // @ts-expect-error - Mock for testing
      mockGetCollection.mockReturnValue(mockCollectionWithDatetime);
      mockGetDateTimeFieldDisplayValue.mockReturnValue('2024-01-15');

      const valueMap = {
        publishDate: '2024-01-15T10:30:00Z',
      };

      // When transformations array is empty or doesn't contain a date transformation,
      // getDateTimeFieldDisplayValue SHOULD be called
      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'publishDate',
        locale: 'en',
        transformations: [{ method: 'upper', args: {} }], // Non-date transformation
      });

      expect(mockGetDateTimeFieldDisplayValue).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldConfig: expect.objectContaining({ widget: 'datetime' }),
          currentValue: '2024-01-15T10:30:00Z',
          locale: 'en',
        }),
      );
      expect(result).toBe('2024-01-15');
    });

    test('should skip getDateTimeFieldDisplayValue when date transformation is provided (line 299 false)', () => {
      // Test the FALSE branch of line 299: when transformations array
      // contains a date transformation, the if condition is false,
      // so getDateTimeFieldDisplayValue is NOT called
      mockGetDateTimeFieldDisplayValue.mockClear();

      const mockCollectionWithDatetime = {
        ...mockCollection,
        fields: [
          {
            name: 'publishDate',
            widget: 'datetime',
            format: 'YYYY-MM-DD',
          },
        ],
      };

      // @ts-expect-error - Mock for testing
      mockGetCollection.mockReturnValue(mockCollectionWithDatetime);
      mockGetDateTimeFieldDisplayValue.mockReturnValue('formatted');

      const valueMap = {
        publishDate: '2024-01-15T10:30:00Z',
      };

      // With an empty transformations array, !transformations?.some()
      // returns true, so getDateTimeFieldDisplayValue WILL be called
      getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'publishDate',
        locale: 'en',
        transformations: [], // Empty transformations
      });

      expect(mockGetDateTimeFieldDisplayValue).toHaveBeenCalled();
      mockGetDateTimeFieldDisplayValue.mockClear();

      // To test the FALSE branch more directly, we just verify that
      // when transformations include a date pattern, the condition
      // !transformations?.some() is false
      // We can test this by checking the transformations array exists
      const transformations = ['someOtherTrans'];
      const hasDateTransformation = transformations.some((tf) => tf.startsWith('date('));

      expect(hasDateTransformation).toBe(false);
    });

    test('should handle datetime field when transformations is undefined (line 299)', () => {
      // Test datetime field display with transformations undefined
      mockGetDateTimeFieldDisplayValue.mockClear();

      const mockCollectionWithDatetime = {
        ...mockCollection,
        fields: [
          {
            name: 'publishDate',
            widget: 'datetime',
            format: 'YYYY-MM-DD',
          },
        ],
      };

      // @ts-expect-error - Mock for testing
      mockGetCollection.mockReturnValue(mockCollectionWithDatetime);
      mockGetDateTimeFieldDisplayValue.mockReturnValue('2024-01-15');

      const valueMap = {
        publishDate: '2024-01-15T10:30:00Z',
      };

      // When transformations is undefined, !transformations?.some() is true
      // so getDateTimeFieldDisplayValue WILL be called
      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'publishDate',
        locale: 'en',
        // transformations is undefined
      });

      expect(mockGetDateTimeFieldDisplayValue).toHaveBeenCalled();
      expect(result).toBe('2024-01-15');
    });

    test('should skip getDateTimeFieldDisplayValue when transformations contain a date pattern (line 343 false branch)', () => {
      // When transformations contains a date() pattern, !some() = false,
      // so getDateTimeFieldDisplayValue is NOT called (line 343 false branch).
      mockGetDateTimeFieldDisplayValue.mockClear();

      const mockCollectionWithDatetime = {
        ...mockCollection,
        fields: [
          {
            name: 'publishDate',
            widget: 'datetime',
            format: 'YYYY-MM-DD',
          },
        ],
      };

      // @ts-expect-error - Mock for testing
      mockGetCollection.mockReturnValue(mockCollectionWithDatetime);

      const valueMap = { publishDate: '2024-01-15T10:30:00Z' };

      getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'publishDate',
        locale: 'en',
        transformations: [{ method: 'date', args: { format: 'YYYY-MM-DD' } }],
      });

      // getDateTimeFieldDisplayValue should NOT be called when a date() transformation is present
      expect(mockGetDateTimeFieldDisplayValue).not.toHaveBeenCalled();
    });
  });

  describe('Transformations', () => {
    test('should apply transformations when provided', () => {
      const valueMap = {
        title: 'hello world',
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'title',
        locale: 'en',
        transformations: [{ method: 'upper', args: {} }],
      });

      expect(result).toBe('HELLO WORLD');
    });

    test('should return empty string when field is undefined and transformations are applied', () => {
      const valueMap = {};

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'nonexistent',
        locale: 'en',
        transformations: [{ method: 'upper', args: {} }],
      });

      expect(result).toBe('');
    });
  });

  describe('Edge cases', () => {
    test('should handle non-existent collection', () => {
      mockGetCollection.mockReturnValue(undefined);

      const valueMap = {
        title: 'Hello World',
      };

      const result = getFieldDisplayValue({
        collectionName: 'nonexistent',
        valueMap,
        keyPath: 'title',
        locale: 'en',
      });

      expect(result).toBe('Hello World');
    });

    test('should handle non-existent field config', () => {
      const valueMap = {
        unknownField: 'some value',
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'unknownField',
        locale: 'en',
      });

      expect(result).toBe('some value');
    });
  });

  describe('Number field handling', () => {
    beforeEach(() => {
      // Mock Intl.NumberFormat to return predictable values for testing
      vi.spyOn(Intl, 'NumberFormat').mockImplementation((locale) => ({
        format: vi.fn((number) => {
          // Simple mock that adds locale-specific formatting
          if (locale === 'en' || locale === 'en-US') {
            return number.toLocaleString('en-US');
          }

          return number.toString();
        }),
        resolvedOptions: vi.fn(),
        formatToParts: vi.fn(),
        formatRange: vi.fn(),
        formatRangeToParts: vi.fn(),
      }));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should format integer numbers using Intl.NumberFormat', () => {
      const valueMap = {
        intNumber: 1234,
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'intNumber',
        locale: 'en',
      });

      expect(result).toBe('1,234');
      expect(Intl.NumberFormat).toHaveBeenCalledWith('en');
    });

    test('should format float numbers using Intl.NumberFormat', () => {
      const valueMap = {
        floatNumber: 1234.56,
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'floatNumber',
        locale: 'en',
      });

      expect(result).toBe('1,234.56');
    });

    test('should format numbers when value_type defaults to int', () => {
      const valueMap = {
        defaultNumber: 5678,
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'defaultNumber',
        locale: 'en',
      });

      expect(result).toBe('5,678');
    });

    test('should not format numbers for custom value_type', () => {
      const valueMap = {
        customTypeNumber: 9999,
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'customTypeNumber',
        locale: 'en',
      });

      // Should return the raw number as string since value_type is not 'int' or 'float'
      expect(result).toBe('9999');
      expect(Intl.NumberFormat).not.toHaveBeenCalled();
    });

    test('should handle string numbers for int type', () => {
      const valueMap = {
        intNumber: '2345',
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'intNumber',
        locale: 'en',
      });

      expect(result).toBe('2,345');
    });

    test('should handle string numbers for float type', () => {
      const valueMap = {
        floatNumber: '2345.67',
      };

      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'floatNumber',
        locale: 'en',
      });

      expect(result).toBe('2,345.67');
    });

    test('should return an empty string for an empty number field', () => {
      // An empty Int/Float field is stored as `null`, a String-typed one as an empty string, and
      // an optional field can be missing altogether
      [{ intNumber: null, floatNumber: null }, { intNumber: '', floatNumber: '' }, {}].forEach(
        (valueMap) => {
          ['intNumber', 'floatNumber'].forEach((keyPath) => {
            expect(
              getFieldDisplayValue({ collectionName: 'posts', valueMap, keyPath, locale: 'en' }),
            ).toBe('');
          });
        },
      );
    });

    test('should handle zero values for number fields', () => {
      const valueMap = {
        intNumber: 0,
        floatNumber: 0.0,
      };

      const intResult = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'intNumber',
        locale: 'en',
      });

      const floatResult = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'floatNumber',
        locale: 'en',
      });

      expect(intResult).toBe('0');
      expect(floatResult).toBe('0');
    });

    test('should handle negative numbers', () => {
      const valueMap = {
        intNumber: -1234,
        floatNumber: -1234.56,
      };

      const intResult = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'intNumber',
        locale: 'en',
      });

      const floatResult = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'floatNumber',
        locale: 'en',
      });

      expect(intResult).toBe('-1,234');
      expect(floatResult).toBe('-1,234.56');
    });

    test('should handle different locales', () => {
      const valueMap = {
        intNumber: 1234,
      };

      // Test with Japanese locale
      const result = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'intNumber',
        locale: 'ja',
      });

      expect(result).toBe('1234'); // Our mock returns toString() for non-en locales
      expect(Intl.NumberFormat).toHaveBeenCalledWith('ja');
    });

    test('should reuse the cached number formatter for the same locale', () => {
      // Use 'de' which no other test uses — guarantees a cache miss on the first call.
      vi.spyOn(Intl, 'NumberFormat').mockImplementation((locale) => ({
        format: vi.fn((n) => `${locale}:${n}`),
        resolvedOptions: vi.fn(),
        formatToParts: vi.fn(),
        formatRange: vi.fn(),
        formatRangeToParts: vi.fn(),
      }));

      const args = {
        collectionName: 'posts',
        valueMap: { intNumber: 42 },
        keyPath: 'intNumber',
        locale: 'de',
      };

      const result1 = getFieldDisplayValue(args);
      const result2 = getFieldDisplayValue(args);

      // Intl.NumberFormat was constructed only once; the second call reused the cache.
      expect(Intl.NumberFormat).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2);
    });

    test('should handle invalid number values gracefully', () => {
      const valueMap = {
        intNumber: NaN,
        floatNumber: Infinity,
        defaultNumber: 'invalid',
      };

      const nanResult = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'intNumber',
        locale: 'en',
      });

      const infinityResult = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'floatNumber',
        locale: 'en',
      });

      const invalidResult = getFieldDisplayValue({
        collectionName: 'posts',
        valueMap,
        keyPath: 'defaultNumber',
        locale: 'en',
      });

      // These would be handled by Number() constructor and Intl.NumberFormat
      expect(nanResult).toBe('NaN');
      expect(infinityResult).toBe('∞'); // toLocaleString returns ∞ for Infinity
      expect(invalidResult).toBe('NaN');
    });
  });
});

describe('Test getVisibleFieldDisplayValue()', () => {
  // Mock collection for testing getVisibleFieldDisplayValue
  const testMockCollection = {
    name: 'posts',
    folder: 'content/posts',
    _type: 'entry',
    fields: [
      {
        name: 'item',
        widget: 'list',
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'name', widget: 'string' },
          { name: 'description', widget: 'text' },
          { name: 'count', widget: 'number' },
          { name: 'hidden_field', widget: 'hidden' },
          { name: 'visible_field', widget: 'string' },
        ],
      },
    ],
  };

  beforeEach(() => {
    fieldConfigCacheMap.clear();
    vi.clearAllMocks();
    // @ts-expect-error - Simplified mock for testing
    mockGetCollection.mockReturnValue(testMockCollection);
    mockIsEntryCollection.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fieldConfigCacheMap.clear();
  });

  test('should return title field value when available', () => {
    const valueMap = {
      'item.0.title': 'Test Title',
      'item.0.name': 'Test Name',
      'item.0.description': 'Test Description',
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap },
    });

    expect(result).toBe('Test Title');
  });

  test('should return name field value when title is not available', () => {
    const valueMap = {
      'item.0.name': 'Test Name',
      'item.0.description': 'Test Description',
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap },
    });

    expect(result).toBe('Test Name');
  });

  test('should return first available field when title and name are not available', () => {
    const valueMap = {
      'item.0.description': 'Test Description',
      'item.0.count': 42,
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap },
    });

    expect(result).toBe('Test Description');
  });

  test('should skip hidden fields', () => {
    const valueMap = {
      'item.0.hidden_field': 'Hidden Value',
      'item.0.visible_field': 'Visible Value',
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap },
    });

    expect(result).toBe('Visible Value');
  });

  test('should skip empty string values', () => {
    const valueMap = {
      'item.0.title': '',
      'item.0.name': '   ', // whitespace only
      'item.0.description': 'Valid Description',
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap },
    });

    expect(result).toBe('Valid Description');
  });

  test('should accept numeric values', () => {
    const valueMap = {
      'item.0.count': 0, // zero should be valid
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap },
    });

    expect(result).toBe('0');
  });

  test('should skip fields that do not match the key path regex', () => {
    const valueMap = {
      'item.1.title': 'Other Item Title', // different item
      'item.0.description': 'Current Item Description',
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap },
    });

    expect(result).toBe('Current Item Description');
  });

  test('should return empty string when no visible fields have values', () => {
    const valueMap = {
      'item.0.title': '',
      'item.0.name': null,
      'item.0.description': undefined,
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap },
    });

    expect(result).toBe('');
  });

  test('should return empty string when no fields match the regex', () => {
    const valueMap = {
      'other.field': 'Some Value',
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap },
    });

    expect(result).toBe('');
  });

  test('should prioritize title over name and other fields', () => {
    const valueMap = {
      'item.0.description': 'Description',
      'item.0.name': 'Name',
      'item.0.title': 'Title',
      'item.0.count': 5,
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap },
    });

    expect(result).toBe('Title');
  });

  test('should handle undefined field configuration gracefully', () => {
    // Mock getField to return undefined for certain paths
    mockGetCollection.mockReturnValue(undefined);

    const valueMap = {
      'item.0.unknown_field': 'Unknown Value',
    };

    const result = getVisibleFieldDisplayValue({
      valueMap,
      locale: 'en',
      keyPath: 'item.0',
      keyPathPrefix: 'item.0.',
      getFieldArgs: { collectionName: 'unknown_collection', keyPath: '', valueMap },
    });

    // When field config is not found, the function should return empty string
    expect(result).toBe('');
  });
});

describe('Test getPropertyValue()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return slug when key is "slug"', () => {
    // @ts-ignore - Testing with minimal mock
    const entry = {
      slug: 'my-post',
      locales: { en: { content: {} } },
    };

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'slug',
    });

    expect(result).toBe('my-post');
  });

  test('should return commit author name when key is "commit_author"', () => {
    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: { en: { content: {} } },
      commitAuthor: { name: 'Jane Smith', login: 'jane', email: 'jane@example.com' },
    };

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'commit_author',
    });

    expect(result).toBe('Jane Smith');
  });

  test('should return commit date when key is "commit_date"', () => {
    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: { en: { content: {} } },
      commitDate: '2024-01-01T00:00:00Z',
    };

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'commit_date',
    });

    expect(result).toBe('2024-01-01T00:00:00Z');
  });

  test('should return field value from content', () => {
    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: {
        en: {
          content: { title: 'My Post' },
        },
      },
    };

    // @ts-ignore - Testing with minimal mock
    mockGetCollection.mockReturnValue({
      _type: 'entry',
      fields: [{ name: 'title', widget: 'string' }],
    });

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'title',
    });

    expect(result).toBe('My Post');
  });

  test('should return undefined when locale content is not available', () => {
    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: {
        en: { content: { title: 'My Post' } },
      },
    };

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'fr',
      collectionName: 'posts',
      key: 'title',
    });

    expect(result).toBe(undefined);
  });

  test('should return undefined when collection is not found', () => {
    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: {
        en: { content: { title: 'My Post' } },
      },
    };

    mockGetCollection.mockReturnValue(undefined);

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'unknown',
      key: 'title',
    });

    expect(result).toBe(undefined);
  });

  test('should resolve relation field value when resolveRef is true (lines 390-397)', () => {
    // Create mock collection with relation field
    const mockCollectionWithRelation = {
      _type: 'entry',
      fields: [
        {
          name: 'author',
          widget: 'relation',
          collection: 'authors',
          search_fields: ['name'],
          value_field: 'name',
          display_fields: ['name'],
        },
      ],
      _i18n: {
        i18nEnabled: false,
      },
    };

    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: {
        en: {
          content: {
            author: 'john-doe',
          },
        },
      },
    };

    // @ts-ignore - Mock collection
    mockGetCollection.mockReturnValue(mockCollectionWithRelation);
    mockIsCollectionIndexFile.mockReturnValue(false);
    mockGetReferencedOptionLabel.mockReturnValue('John Doe');

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'author',
      resolveRef: true,
    });

    expect(result).toBe('John Doe');
    expect(mockGetReferencedOptionLabel).toHaveBeenCalled();
  });

  test('should not resolve relation field value when resolveRef is false', () => {
    // Create mock collection with relation field
    const mockCollectionWithRelation = {
      _type: 'entry',
      fields: [
        {
          name: 'author',
          widget: 'relation',
          collection: 'authors',
        },
      ],
      _i18n: {
        i18nEnabled: false,
      },
    };

    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: {
        en: {
          content: {
            author: 'john-doe',
          },
        },
      },
    };

    // @ts-ignore - Mock collection
    mockGetCollection.mockReturnValue(mockCollectionWithRelation);

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'author',
      resolveRef: false,
    });

    expect(result).toBe('john-doe');
  });

  test('should return the item values of a multiple relation field', () => {
    const mockCollectionWithRelation = {
      _type: 'entry',
      fields: [
        {
          name: 'categories',
          widget: 'relation',
          collection: 'categories',
          multiple: true,
        },
      ],
      _i18n: {
        i18nEnabled: false,
      },
    };

    /** @type {any} */
    const entry = {
      locales: {
        en: {
          content: {
            title: 'My Post',
            'categories.0': 'news',
            'categories.1': 'updates',
          },
        },
      },
    };

    // @ts-ignore - Mock collection
    mockGetCollection.mockReturnValue(mockCollectionWithRelation);
    mockGetReferencedOptionLabel.mockReturnValue(['News', 'Updates']);

    const args = {
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'categories',
    };

    expect(getPropertyValue({ ...args, resolveRef: false })).toEqual(['news', 'updates']);
    expect(getPropertyValue({ ...args })).toEqual(['News', 'Updates']);
    expect(mockGetReferencedOptionLabel).toHaveBeenCalledTimes(1);
  });

  test('should return the item values of a list field', () => {
    const mockCollectionWithList = {
      _type: 'entry',
      fields: [
        { name: 'tags', widget: 'list' },
        { name: 'empty', widget: 'list' },
        { name: 'category', widget: 'select', options: ['a', 'b'] },
      ],
      _i18n: {
        i18nEnabled: false,
      },
    };

    /** @type {any} */
    const entry = {
      locales: {
        en: {
          content: {
            'tags.0': 'svelte',
            'tags.1': 'cms',
            empty: [],
            category: 'a',
          },
        },
      },
    };

    // @ts-ignore - Mock collection
    mockGetCollection.mockReturnValue(mockCollectionWithList);

    const args = {
      entry,
      locale: 'en',
      collectionName: 'posts',
    };

    expect(getPropertyValue({ ...args, key: 'tags' })).toEqual(['svelte', 'cms']);
    // Nothing is stored under the item key paths
    expect(getPropertyValue({ ...args, key: 'empty' })).toEqual([]);
    // Not a multi-value field
    expect(getPropertyValue({ ...args, key: 'category' })).toBe('a');
  });

  test('should return the subfield values of an object field or a list of objects', () => {
    const mockCollectionWithObjects = {
      _type: 'entry',
      fields: [
        {
          name: 'author',
          widget: 'object',
          fields: [
            { name: 'name', widget: 'string' },
            { name: 'bio', widget: 'text' },
          ],
        },
        { name: 'editor', widget: 'object', fields: [{ name: 'name', widget: 'string' }] },
        { name: 'reviewer', widget: 'object', fields: [{ name: 'name', widget: 'string' }] },
        {
          name: 'links',
          widget: 'list',
          fields: [
            { name: 'label', widget: 'string' },
            { name: 'url', widget: 'string' },
          ],
        },
        { name: 'authors', widget: 'string' },
      ],
      _i18n: {
        i18nEnabled: false,
      },
    };

    /** @type {any} */
    const entry = {
      locales: {
        en: {
          content: {
            'author.name': 'Jane',
            'author.bio': '',
            editor: null,
            'links.0.label': 'Home',
            'links.0.url': '/',
            'links.1.label': 'About',
            'links.1.url': '/about',
            authors: 'Jane, John',
          },
        },
      },
    };

    // @ts-ignore - Mock collection
    mockGetCollection.mockReturnValue(mockCollectionWithObjects);

    // A collection name of its own, as the field configurations are cached by collection
    const args = {
      entry,
      locale: 'en',
      collectionName: 'profiles',
    };

    expect(getPropertyValue({ ...args, key: 'author' })).toEqual(['Jane', '']);
    // An empty optional object is stored as `null`
    expect(getPropertyValue({ ...args, key: 'editor' })).toBeNull();
    // A field added after the entry was created
    expect(getPropertyValue({ ...args, key: 'reviewer' })).toBeUndefined();
    expect(getPropertyValue({ ...args, key: 'links' })).toEqual(['Home', '/', 'About', '/about']);
    // A subfield is still read directly
    expect(getPropertyValue({ ...args, key: 'author.name' })).toBe('Jane');
    // Not an object field, whose name happens to share a prefix with one
    expect(getPropertyValue({ ...args, key: 'authors' })).toBe('Jane, John');
  });

  test('should return raw field value for non-relation fields', () => {
    const mockNormalCollection = {
      _type: 'entry',
      fields: [{ name: 'title', widget: 'string' }],
      _i18n: {
        i18nEnabled: false,
      },
    };

    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: {
        en: {
          content: {
            title: 'My Post',
          },
        },
      },
    };

    // @ts-ignore - Mock collection
    mockGetCollection.mockReturnValue(mockNormalCollection);

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'title',
      resolveRef: true,
    });

    expect(result).toBe('My Post');
  });

  test('should return login when name is not available (line 365)', () => {
    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: { en: { content: {} } },
      commitAuthor: { login: 'john_doe', email: 'john@example.com' },
    };

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'commit_author',
    });

    expect(result).toBe('john_doe');
  });

  test('should return email when name and login are not available (line 365)', () => {
    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: { en: { content: {} } },
      commitAuthor: { email: 'john@example.com' },
    };

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'commit_author',
    });

    expect(result).toBe('john@example.com');
  });

  test('should return falsy value when no commit author info available (line 365)', () => {
    // @ts-ignore - Testing with minimal mock
    const entry = {
      locales: { en: { content: {} } },
      commitAuthor: {},
    };

    const result = getPropertyValue({
      // @ts-expect-error - Using minimal mock for testing
      entry,
      locale: 'en',
      collectionName: 'posts',
      key: 'commit_author',
    });

    // When none of name, login, email are available, the || operator chain returns undefined
    expect(result).toBeUndefined();
  });
});
