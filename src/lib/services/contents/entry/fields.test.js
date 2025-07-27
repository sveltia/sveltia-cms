import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getCollection, isEntryCollection } from '$lib/services/contents/collection';
import {
  fieldConfigCacheMap,
  getField,
  isFieldRequired,
} from '$lib/services/contents/entry/fields';

// Mock dependencies
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
  isEntryCollection: vi.fn(),
}));

const mockGetCollection = vi.mocked(getCollection);
const mockIsEntryCollection = vi.mocked(isEntryCollection);

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
