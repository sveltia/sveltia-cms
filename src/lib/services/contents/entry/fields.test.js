import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getCollection, isEntryCollection } from '$lib/services/contents/collection';
import {
  fieldConfigCacheMap,
  getField,
  getFieldDisplayValue,
  getVisibleFieldDisplayValue,
  isFieldMultiple,
  isFieldRequired,
} from '$lib/services/contents/entry/fields';
import { isMultiple } from '$lib/services/integrations/media-libraries/shared';

// Mock dependencies
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
  isEntryCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/i18n', () => ({
  getCanonicalLocale: vi.fn((locale) => locale),
  getListFormatter: vi.fn(() => ({
    format: vi.fn((items) => items.join(', ')),
  })),
}));

vi.mock('$lib/services/contents/widgets', () => ({
  MEDIA_WIDGETS: ['file', 'image'],
  MULTI_VALUE_WIDGETS: ['file', 'image', 'relation', 'select'],
}));

vi.mock('$lib/services/integrations/media-libraries/shared', () => ({
  isMultiple: vi.fn(),
}));

const mockGetCollection = vi.mocked(getCollection);
const mockIsEntryCollection = vi.mocked(isEntryCollection);
const mockIsMultiple = vi.mocked(isMultiple);

describe('Test getField()', () => {
  // Comprehensive mock collection that covers all test scenarios
  const mockCollection = {
    name: 'posts',
    folder: 'content/posts',
    _type: 'entry',
    fields: [
      { name: 'title', widget: 'string' },
      { name: 'body', widget: 'markdown' },
      {
        name: 'author',
        widget: 'object',
        fields: [
          { name: 'name', widget: 'string' },
          { name: 'email', widget: 'string' },
        ],
      },
      {
        name: 'tags',
        widget: 'list',
        field: { name: 'tag', widget: 'string' },
      },
      {
        name: 'images',
        widget: 'list',
        fields: [
          { name: 'src', widget: 'image' },
          { name: 'alt', widget: 'string' },
        ],
      },
      {
        name: 'blocks',
        widget: 'list',
        types: [
          {
            name: 'text',
            fields: [{ name: 'content', widget: 'markdown' }],
          },
          {
            name: 'image',
            fields: [{ name: 'src', widget: 'image' }],
          },
        ],
      },
      {
        name: 'widget',
        widget: 'object',
        types: [
          {
            name: 'text',
            fields: [{ name: 'content', widget: 'string' }],
          },
          {
            name: 'button',
            fields: [{ name: 'label', widget: 'string' }],
          },
        ],
      },
      {
        name: 'sections',
        widget: 'list',
        fields: [
          {
            name: 'content',
            widget: 'object',
            fields: [
              { name: 'title', widget: 'string' },
              {
                name: 'items',
                widget: 'list',
                field: { name: 'item', widget: 'string' },
              },
            ],
          },
        ],
      },
      {
        name: 'blocksWithCustomType',
        widget: 'list',
        typeKey: 'blockType',
        types: [
          {
            name: 'text',
            fields: [{ name: 'content', widget: 'markdown' }],
          },
        ],
      },
      {
        name: 'itemsList',
        widget: 'list',
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'value', widget: 'number' },
          { name: 'description', widget: 'text' },
        ],
      },
      {
        name: 'emptyList',
        widget: 'list',
        // Missing field, fields, or types
      },
      {
        name: 'category',
        widget: 'select',
        options: ['blog', 'news', 'tutorial'],
      },
      {
        name: 'cities',
        widget: 'select',
        multiple: true,
        options: ['new-york', 'london', 'tokyo', 'paris'],
      },
    ],
    index_file: {
      fields: [{ name: 'description', widget: 'text' }],
    },
  };

  // Mock file collection
  const mockFileCollection = {
    name: 'config',
    _type: 'file',
    _fileMap: {
      'site-config': {
        name: 'site-config',
        file: 'config/site.yml',
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'description', widget: 'text' },
        ],
      },
    },
  };

  beforeEach(() => {
    // Clear cache before each test
    fieldConfigCacheMap.clear();
    vi.clearAllMocks();

    // Setup default mock behavior
    mockIsEntryCollection.mockImplementation(
      // @ts-ignore
      (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fieldConfigCacheMap.clear();
  });

  describe('Basic functionality', () => {
    test('should return undefined for non-existent collection', () => {
      mockGetCollection.mockReturnValue(undefined);

      const result = getField({
        collectionName: 'nonexistent',
        keyPath: 'title',
      });

      expect(result).toBeUndefined();
      expect(mockGetCollection).toHaveBeenCalledWith('nonexistent');
    });

    test('should return field config for simple field in entry collection', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'title',
      });

      expect(result).toEqual({ name: 'title', widget: 'string' });
    });

    test('should return field config for nested field', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'author.name',
      });

      expect(result).toEqual({ name: 'name', widget: 'string' });
    });

    test('should return undefined for non-existent field', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'nonexistent',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('File collections', () => {
    test('should return field config for file collection', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockFileCollection);

      const result = getField({
        collectionName: 'config',
        fileName: 'site-config',
        keyPath: 'title',
      });

      expect(result).toEqual({ name: 'title', widget: 'string' });
    });

    test('should return undefined for file collection without fileName', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockFileCollection);

      const result = getField({
        collectionName: 'config',
        keyPath: 'title',
      });

      expect(result).toBeUndefined();
    });

    test('should return undefined for non-existent file in file collection', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockFileCollection);

      const result = getField({
        collectionName: 'config',
        fileName: 'nonexistent',
        keyPath: 'title',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('List fields', () => {
    test('should handle list field with single subfield', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // Access list item by index
      const result = getField({
        collectionName: 'posts',
        keyPath: 'tags.0',
        valueMap: {},
      });

      expect(result).toEqual({ name: 'tag', widget: 'string' });
    });

    test('should handle list field with multiple subfields', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // Access nested field in list item
      const result = getField({
        collectionName: 'posts',
        keyPath: 'images.0.alt',
        valueMap: {},
      });

      expect(result).toEqual({ name: 'alt', widget: 'string' });
    });

    test('should handle list field with variable types', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // Access field in typed list item
      const result = getField({
        collectionName: 'posts',
        keyPath: 'blocks.0.content',
        valueMap: { 'blocks.0.type': 'text' },
      });

      expect(result).toEqual({ name: 'content', widget: 'markdown' });
    });

    test('should handle object field with variable types', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'widget.label',
        valueMap: { 'widget.type': 'button' },
      });

      expect(result).toEqual({ name: 'label', widget: 'string' });
    });

    test('should return undefined for invalid list field access', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // Try to access with wrong subfield name
      const result = getField({
        collectionName: 'posts',
        keyPath: 'tags.0.wrong_field',
        valueMap: {},
      });

      expect(result).toBeUndefined();
    });
  });

  describe('Variable type fields with valueMap', () => {
    describe('List fields with variable types', () => {
      test('should handle list field variable types with different type values', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        // Test text type
        const textResult = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: { 'blocks.0.type': 'text' },
        });

        expect(textResult).toEqual({ name: 'content', widget: 'markdown' });

        // Test image type
        const imageResult = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.src',
          valueMap: { 'blocks.0.type': 'image' },
        });

        expect(imageResult).toEqual({ name: 'src', widget: 'image' });
      });

      test('should handle multiple list items with different types', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const valueMap = {
          'blocks.0.type': 'text',
          'blocks.1.type': 'image',
          'blocks.2.type': 'text',
        };

        // Test first item (text)
        const result0 = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap,
        });

        expect(result0).toEqual({ name: 'content', widget: 'markdown' });

        // Test second item (image)
        const result1 = getField({
          collectionName: 'posts',
          keyPath: 'blocks.1.src',
          valueMap,
        });

        expect(result1).toEqual({ name: 'src', widget: 'image' });

        // Test third item (text again)
        const result2 = getField({
          collectionName: 'posts',
          keyPath: 'blocks.2.content',
          valueMap,
        });

        expect(result2).toEqual({ name: 'content', widget: 'markdown' });
      });

      test('should handle custom typeKey in list variable types', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const result = getField({
          collectionName: 'posts',
          keyPath: 'blocksWithCustomType.0.content',
          valueMap: { 'blocksWithCustomType.0.blockType': 'text' },
        });

        expect(result).toEqual({ name: 'content', widget: 'markdown' });
      });

      test('should return undefined for unknown type in list variable types', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const result = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: { 'blocks.0.type': 'unknown' },
        });

        expect(result).toBeUndefined();
      });

      test('should return undefined when type is missing in valueMap for list variable types', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const result = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: {}, // No type specified
        });

        expect(result).toBeUndefined();
      });

      test('should handle accessing type field itself in list variable types', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        // When accessing the type field itself, it should return undefined since `type` is not a
        // field in any of the types
        const result = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.type',
          valueMap: { 'blocks.0.type': 'text' },
        });

        expect(result).toBeUndefined();
      });
    });

    describe('Object fields with variable types', () => {
      test('should handle object field variable types with different type values', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        // Test text type
        const textResult = getField({
          collectionName: 'posts',
          keyPath: 'widget.content',
          valueMap: { 'widget.type': 'text' },
        });

        expect(textResult).toEqual({ name: 'content', widget: 'string' });

        // Test button type
        const buttonResult = getField({
          collectionName: 'posts',
          keyPath: 'widget.label',
          valueMap: { 'widget.type': 'button' },
        });

        expect(buttonResult).toEqual({ name: 'label', widget: 'string' });
      });

      test('should return undefined for unknown type in object variable types', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const result = getField({
          collectionName: 'posts',
          keyPath: 'widget.content',
          valueMap: { 'widget.type': 'unknown' },
        });

        expect(result).toBeUndefined();
      });

      test('should return undefined when type is missing in valueMap for object variable types', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const result = getField({
          collectionName: 'posts',
          keyPath: 'widget.content',
          valueMap: {}, // No type specified
        });

        expect(result).toBeUndefined();
      });

      test('should handle accessing type field itself in object variable types', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        // When accessing the type field itself, it should return undefined since `type` is not a
        // field in any of the types
        const result = getField({
          collectionName: 'posts',
          keyPath: 'widget.type',
          valueMap: { 'widget.type': 'text' },
        });

        expect(result).toBeUndefined();
      });

      test('should handle accessing non-existent field in typed object', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const result = getField({
          collectionName: 'posts',
          keyPath: 'widget.nonexistent',
          valueMap: { 'widget.type': 'text' },
        });

        expect(result).toBeUndefined();
      });
    });

    describe('Complex nested variable types', () => {
      // First, let’s extend the mock collection with more complex nested scenarios
      beforeEach(() => {
        // Add a more complex nested structure to the mock
        const complexNestedField = {
          name: 'complexContent',
          widget: 'list',
          types: [
            {
              name: 'section',
              fields: [
                {
                  name: 'header',
                  widget: 'object',
                  types: [
                    {
                      name: 'simple',
                      fields: [{ name: 'title', widget: 'string' }],
                    },
                    {
                      name: 'advanced',
                      fields: [
                        { name: 'title', widget: 'string' },
                        { name: 'subtitle', widget: 'string' },
                      ],
                    },
                  ],
                },
                {
                  name: 'items',
                  widget: 'list',
                  types: [
                    {
                      name: 'text',
                      fields: [{ name: 'content', widget: 'markdown' }],
                    },
                    {
                      name: 'link',
                      fields: [
                        { name: 'url', widget: 'string' },
                        { name: 'label', widget: 'string' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        };

        // Add to mock collection
        mockCollection.fields.push(complexNestedField);
      });

      test('should handle deeply nested variable types', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const valueMap = {
          'complexContent.0.type': 'section',
          'complexContent.0.header.type': 'advanced',
          'complexContent.0.items.0.type': 'link',
        };

        // Test nested object field within typed list
        const headerResult = getField({
          collectionName: 'posts',
          keyPath: 'complexContent.0.header.subtitle',
          valueMap,
        });

        expect(headerResult).toEqual({ name: 'subtitle', widget: 'string' });

        // Test nested list field within typed list
        const itemResult = getField({
          collectionName: 'posts',
          keyPath: 'complexContent.0.items.0.url',
          valueMap,
        });

        expect(itemResult).toEqual({ name: 'url', widget: 'string' });
      });

      test('should handle partial valueMap in deeply nested structures', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        // Missing intermediate type should result in undefined
        const result = getField({
          collectionName: 'posts',
          keyPath: 'complexContent.0.header.subtitle',
          valueMap: {
            'complexContent.0.type': 'section',
            // Missing 'complexContent.0.header.type': 'advanced'
          },
        });

        expect(result).toBeUndefined();
      });

      test('should handle mixed variable and fixed types in nested structures', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        // sections field has fixed structure but nested content might have variable types
        const valueMap = {
          'complexContent.0.type': 'section',
          'complexContent.0.header.type': 'simple',
        };

        const result = getField({
          collectionName: 'posts',
          keyPath: 'complexContent.0.header.title',
          valueMap,
        });

        expect(result).toEqual({ name: 'title', widget: 'string' });
      });
    });

    describe('Edge cases with valueMap', () => {
      test('should handle empty string as type value', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const result = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: { 'blocks.0.type': '' },
        });

        expect(result).toBeUndefined();
      });

      test('should handle null/undefined values in valueMap', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const result1 = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: { 'blocks.0.type': null },
        });

        const result2 = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: { 'blocks.0.type': undefined },
        });

        expect(result1).toBeUndefined();
        expect(result2).toBeUndefined();
      });

      test('should handle valueMap with extra unrelated keys', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const result = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: {
            'blocks.0.type': 'text',
            'unrelated.field': 'value',
            'another.random.key': 'data',
          },
        });

        expect(result).toEqual({ name: 'content', widget: 'markdown' });
      });

      test('should handle case-sensitive type matching', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        // Type names should be case-sensitive
        const result = getField({
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: { 'blocks.0.type': 'TEXT' }, // Wrong case
        });

        expect(result).toBeUndefined();
      });
    });

    describe('Caching with valueMap variations', () => {
      test('should create different cache entries for different valueMap values', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        // These should create separate cache entries
        const args1 = {
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: { 'blocks.0.type': 'text' },
        };

        const args2 = {
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: { 'blocks.0.type': 'image' },
        };

        getField(args1);
        getField(args2);

        // Should have called `getCollection` twice due to different cache keys
        expect(mockGetCollection).toHaveBeenCalledTimes(2);
      });

      test('should use cache for identical valueMap objects', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        const valueMap = { 'blocks.0.type': 'text' };

        const args = {
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap,
        };

        // First call
        getField(args);

        // Second call with same valueMap object
        getField(args);

        // Should only call `getCollection` once due to caching
        expect(mockGetCollection).toHaveBeenCalledTimes(1);
      });

      test('should use cache for equivalent valueMap objects with different references', () => {
        // @ts-expect-error - Simplified mock for testing
        mockGetCollection.mockReturnValue(mockCollection);

        // Different object references but same content
        const args1 = {
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: { 'blocks.0.type': 'text' },
        };

        const args2 = {
          collectionName: 'posts',
          keyPath: 'blocks.0.content',
          valueMap: { 'blocks.0.type': 'text' },
        };

        getField(args1);
        getField(args2);

        // Should only call `getCollection` once due to JSON.stringify cache key
        expect(mockGetCollection).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Index file handling', () => {
    test('should use index file fields when isIndexFile is true', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'description',
        isIndexFile: true,
      });

      expect(result).toEqual({ name: 'description', widget: 'text' });
    });

    test('should fallback to regular fields when index file fields not found', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'title',
        isIndexFile: true,
      });

      expect(result).toEqual({ name: 'title', widget: 'string' });
    });
  });

  describe('Caching', () => {
    test('should cache results', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const args = {
        collectionName: 'posts',
        keyPath: 'title',
      };

      // First call
      const result1 = getField(args);

      expect(mockGetCollection).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = getField(args);

      expect(mockGetCollection).toHaveBeenCalledTimes(1); // No additional call
      expect(result1).toBe(result2);
    });

    test('should cache undefined results', () => {
      mockGetCollection.mockReturnValue(undefined);

      const args = {
        collectionName: 'nonexistent',
        keyPath: 'title',
      };

      // First call
      const result1 = getField(args);

      expect(mockGetCollection).toHaveBeenCalledTimes(1);
      expect(result1).toBeUndefined();

      // Second call should use cache
      const result2 = getField(args);

      expect(mockGetCollection).toHaveBeenCalledTimes(1); // No additional call
      expect(result2).toBeUndefined();
    });

    test('should have different cache keys for different parameters', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // Different `keyPath` should create different cache entries
      getField({ collectionName: 'posts', keyPath: 'title' });
      getField({ collectionName: 'posts', keyPath: 'body' });

      expect(mockGetCollection).toHaveBeenCalledTimes(2);
    });
  });

  describe('Complex nested scenarios', () => {
    test('should handle deeply nested list and object combinations', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'sections.0.content.items.0',
        valueMap: {},
      });

      expect(result).toEqual({ name: 'item', widget: 'string' });
    });

    test('should handle custom typeKey in variable types', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'blocksWithCustomType.0.content',
        valueMap: { 'blocksWithCustomType.0.blockType': 'text' },
      });

      expect(result).toEqual({ name: 'content', widget: 'markdown' });
    });
  });

  describe('Edge cases', () => {
    test('should handle empty keyPath', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: '',
      });

      expect(result).toBeUndefined();
    });

    test('should handle null/undefined collections gracefully', () => {
      mockGetCollection.mockReturnValue(undefined);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'title',
      });

      expect(result).toBeUndefined();
    });

    test('should handle collections without fields', () => {
      const emptyCollection = {
        name: 'posts',
        folder: 'content/posts',
        _type: 'entry',
        // No fields property
      };

      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(emptyCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'title',
      });

      expect(result).toBeUndefined();
    });

    test('should handle malformed list field structures', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'emptyList.0',
        valueMap: {},
      });

      expect(result).toBeUndefined();
    });
  });

  describe('Bug fixes', () => {
    test('should handle numeric keys in list fields correctly', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // Test various numeric indices
      const result0 = getField({
        collectionName: 'posts',
        keyPath: 'itemsList.0.title',
        valueMap: {},
      });

      const result10 = getField({
        collectionName: 'posts',
        keyPath: 'itemsList.10.value',
        valueMap: {},
      });

      expect(result0).toEqual({ name: 'title', widget: 'string' });
      expect(result10).toEqual({ name: 'value', widget: 'number' });
    });

    test('should not skip numeric keys for list fields with multiple fields', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // The current implementation keeps the field for numeric keys in multi-field lists and
      // continues to the next part of the path
      const result = getField({
        collectionName: 'posts',
        keyPath: 'itemsList.0.title',
        valueMap: {},
      });

      expect(result).toEqual({ name: 'title', widget: 'string' });
    });

    test('should handle list field variable types with missing type value', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // When type is not specified in valueMap, should return undefined
      const result = getField({
        collectionName: 'posts',
        keyPath: 'blocks.0.content',
        valueMap: {}, // No type specified
      });

      expect(result).toBeUndefined();
    });
  });

  describe('Select widget tests', () => {
    test('should return field config for single select widget', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'category',
        valueMap: {},
      });

      expect(result).toEqual({
        name: 'category',
        widget: 'select',
        options: ['blog', 'news', 'tutorial'],
      });
    });

    test('should return field config for multiple select widget', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      const result = getField({
        collectionName: 'posts',
        keyPath: 'cities',
        valueMap: {},
      });

      expect(result).toEqual({
        name: 'cities',
        widget: 'select',
        multiple: true,
        options: ['new-york', 'london', 'tokyo', 'paris'],
      });
    });

    test('should return field config for multiple select widget accessed by index', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // Multiple select can be accessed with index like cities.0
      const result = getField({
        collectionName: 'posts',
        keyPath: 'cities.0',
        valueMap: {},
      });

      expect(result).toEqual({
        name: 'cities',
        widget: 'select',
        multiple: true,
        options: ['new-york', 'london', 'tokyo', 'paris'],
      });
    });

    test('should return field config for multiple select widget accessed by higher index', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // Multiple select can be accessed with any numeric index
      const result = getField({
        collectionName: 'posts',
        keyPath: 'cities.2',
        valueMap: {},
      });

      expect(result).toEqual({
        name: 'cities',
        widget: 'select',
        multiple: true,
        options: ['new-york', 'london', 'tokyo', 'paris'],
      });
    });

    test('should return undefined for single select widget accessed by index', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // Single select should not be accessible with index
      const result = getField({
        collectionName: 'posts',
        keyPath: 'category.0',
        valueMap: {},
      });

      expect(result).toBeUndefined();
    });

    test('should return undefined for non-numeric access on multiple select', () => {
      // @ts-expect-error - Simplified mock for testing
      mockGetCollection.mockReturnValue(mockCollection);

      // Non-numeric keys should not work with multiple select
      const result = getField({
        collectionName: 'posts',
        keyPath: 'cities.invalid',
        valueMap: {},
      });

      expect(result).toBeUndefined();
    });
  });
});

describe('Test isFieldMultiple()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Media widgets', () => {
    test('should call isMultiple for file widget', () => {
      const fieldConfig = { name: 'test', widget: 'file', multiple: true };

      mockIsMultiple.mockReturnValue(true);

      const result = isFieldMultiple(fieldConfig);

      expect(mockIsMultiple).toHaveBeenCalledWith(fieldConfig);
      expect(result).toBe(true);
    });

    test('should call isMultiple for image widget', () => {
      const fieldConfig = { name: 'test', widget: 'image', multiple: false };

      mockIsMultiple.mockReturnValue(false);

      const result = isFieldMultiple(fieldConfig);

      expect(mockIsMultiple).toHaveBeenCalledWith(fieldConfig);
      expect(result).toBe(false);
    });

    test('should handle when isMultiple returns true for media widgets', () => {
      const fieldConfig = { name: 'test', widget: 'file' };

      mockIsMultiple.mockReturnValue(true);

      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(true);
    });

    test('should handle when isMultiple returns false for media widgets', () => {
      const fieldConfig = { name: 'test', widget: 'image' };

      mockIsMultiple.mockReturnValue(false);

      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
    });
  });

  describe('Multi-value widgets', () => {
    test('should return true for relation widget with multiple=true', () => {
      const fieldConfig = { name: 'test', widget: 'relation', multiple: true };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(true);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for relation widget with multiple=false', () => {
      const fieldConfig = { name: 'test', widget: 'relation', multiple: false };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for relation widget with multiple=undefined', () => {
      const fieldConfig = { name: 'test', widget: 'relation' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return true for select widget with multiple=true', () => {
      const fieldConfig = { name: 'test', widget: 'select', multiple: true };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(true);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for select widget with multiple=false', () => {
      const fieldConfig = { name: 'test', widget: 'select', multiple: false };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for select widget with multiple=undefined', () => {
      const fieldConfig = { name: 'test', widget: 'select' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should handle truthy values for multiple property', () => {
      const fieldConfig = { name: 'test', widget: 'select', multiple: 1 };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(true);
    });

    test('should handle falsy values for multiple property', () => {
      const fieldConfig = { name: 'test', widget: 'relation', multiple: 0 };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
    });
  });

  describe('Other widgets', () => {
    test('should return false for string widget', () => {
      const fieldConfig = { name: 'test', widget: 'string' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for text widget', () => {
      const fieldConfig = { name: 'test', widget: 'text' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for markdown widget', () => {
      const fieldConfig = { name: 'test', widget: 'markdown' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for number widget', () => {
      const fieldConfig = { name: 'test', widget: 'number' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for boolean widget', () => {
      const fieldConfig = { name: 'test', widget: 'boolean' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for datetime widget', () => {
      const fieldConfig = { name: 'test', widget: 'datetime' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for list widget', () => {
      const fieldConfig = { name: 'test', widget: 'list' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should return false for object widget', () => {
      const fieldConfig = { name: 'test', widget: 'object' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });
  });

  describe('Default widget behavior', () => {
    test('should default to string widget when widget is undefined', () => {
      const fieldConfig = {};
      // @ts-ignore - Testing edge case with incomplete field config
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });

    test('should handle null widget value', () => {
      const fieldConfig = { widget: null };
      // @ts-ignore - Testing edge case with incomplete field config
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
      expect(mockIsMultiple).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    test('should handle empty field config', () => {
      const fieldConfig = {};
      // @ts-ignore - Testing edge case with incomplete field config
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    test('should handle media widget that is also multi-value widget', () => {
      // file and image widgets are in both MEDIA_WIDGETS and MULTI_VALUE_WIDGETS
      // The function should prioritize MEDIA_WIDGETS (call isMultiple function)
      const fieldConfig = { name: 'test', widget: 'file', multiple: true };

      mockIsMultiple.mockReturnValue(true);

      const result = isFieldMultiple(fieldConfig);

      expect(mockIsMultiple).toHaveBeenCalledWith(fieldConfig);
      expect(result).toBe(true);
    });

    test('should handle widget name with different casing', () => {
      // The function should work with exact widget names
      const fieldConfig = { name: 'test', widget: 'SELECT' }; // Different case
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false); // Not in MULTI_VALUE_WIDGETS
    });

    test('should handle additional properties in field config', () => {
      const fieldConfig = {
        name: 'test_field',
        widget: 'select',
        multiple: true,
        options: ['option1', 'option2'],
        required: true,
      };

      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(true);
    });
  });

  describe('Type casting edge cases', () => {
    test('should handle string "true" as truthy for multiple property', () => {
      const fieldConfig = { name: 'test', widget: 'relation', multiple: 'true' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(true);
    });

    test('should handle string "false" as truthy for multiple property', () => {
      const fieldConfig = { name: 'test', widget: 'relation', multiple: 'false' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(true); // Non-empty string is truthy
    });

    test('should handle empty string as falsy for multiple property', () => {
      const fieldConfig = { name: 'test', widget: 'relation', multiple: '' };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    test('should handle null as falsy for multiple property', () => {
      const fieldConfig = { name: 'test', widget: 'select', multiple: null };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(false);
    });

    test('should handle array as truthy for multiple property', () => {
      const fieldConfig = { name: 'test', widget: 'select', multiple: [] };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(true); // Empty array is truthy in JavaScript
    });

    test('should handle non-empty array as truthy for multiple property', () => {
      const fieldConfig = { name: 'test', widget: 'select', multiple: [1, 2, 3] };
      const result = isFieldMultiple(fieldConfig);

      expect(result).toBe(true); // Non-empty array is truthy
    });
  });
});

describe('Test isFieldRequired()', () => {
  const name = 'title';
  const locale = 'en';

  test('required: undefined', () => {
    expect(isFieldRequired({ fieldConfig: { name }, locale })).toBe(true);
  });

  test('required: boolean', () => {
    expect(isFieldRequired({ fieldConfig: { name, required: true }, locale })).toBe(true);
    expect(isFieldRequired({ fieldConfig: { name, required: false }, locale })).toBe(false);
  });

  test('required: array', () => {
    expect(isFieldRequired({ fieldConfig: { name, required: ['en'] }, locale })).toBe(true);
    expect(isFieldRequired({ fieldConfig: { name, required: ['ja'] }, locale })).toBe(false);
    expect(isFieldRequired({ fieldConfig: { name, required: ['en', 'ja'] }, locale })).toBe(true);
    expect(isFieldRequired({ fieldConfig: { name, required: [] }, locale })).toBe(false);
  });
});

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
        name: 'images',
        widget: 'list',
        fields: [
          { name: 'src', widget: 'image' },
          { name: 'alt', widget: 'string' },
        ],
      },
      // Number widget fields for testing
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

  describe('List widget handling', () => {
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

    test('should ignore complex list widgets (with fields or types)', () => {
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

      // Complex list widgets should not be formatted as simple lists
      expect(result).toBe('');
    });

    test('should format list widgets with field property', () => {
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

      // List widgets with field property should be formatted as simple lists
      expect(result).toContain('javascript');
      expect(result).toContain('web development');
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
        transformations: ['upper'],
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
        transformations: ['upper'],
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

  describe('Number widget handling', () => {
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
      expect(Intl.NumberFormat).toHaveBeenCalledWith('en');
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
      expect(Intl.NumberFormat).toHaveBeenCalledWith('en');
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
      expect(Intl.NumberFormat).toHaveBeenCalledWith('en');
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
      expect(Intl.NumberFormat).toHaveBeenCalledWith('en');
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
      keyPathRegex: /^item\.0\./,
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
      keyPathRegex: /^item\.0\./,
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
      keyPathRegex: /^item\.0\./,
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
      keyPathRegex: /^item\.0\./,
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
      keyPathRegex: /^item\.0\./,
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
      keyPathRegex: /^item\.0\./,
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
      keyPathRegex: /^item\.0\./,
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
      keyPathRegex: /^item\.0\./,
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
      keyPathRegex: /^item\.0\./,
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
      keyPathRegex: /^item\.0\./,
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
      keyPathRegex: /^item\.0\./,
      getFieldArgs: { collectionName: 'unknown_collection', keyPath: '', valueMap },
    });

    // When field config is not found, the function should return empty string
    expect(result).toBe('');
  });
});
