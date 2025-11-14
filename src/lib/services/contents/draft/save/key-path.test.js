// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';

// Mock the config service to prevent issues with uninitialized stores
vi.mock('$lib/services/config', () => ({
  cmsConfig: { subscribe: vi.fn((callback) => callback({})) },
}));

// Mock svelte/store get function to return empty config
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({})),
  };
});

// Import after mocks are set up
const { createKeyPathList } = await import('./key-path.js');

describe('contents/draft/save/key-path', () => {
  describe('createKeyPathList', () => {
    it('should create key path list for simple fields', () => {
      const fields = [
        { name: 'title', widget: 'string' },
        { name: 'body', widget: 'markdown' },
        { name: 'date', widget: 'datetime' },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['title', 'body', 'date']);
    });

    it('should handle object fields', () => {
      const fields = [
        {
          name: 'author',
          widget: 'object',
          fields: [
            { name: 'name', widget: 'string' },
            { name: 'email', widget: 'string' },
          ],
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['author', 'author.name', 'author.email']);
    });

    it('should handle list fields with fields', () => {
      const fields = [
        {
          name: 'books',
          widget: 'list',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'author', widget: 'string' },
          ],
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['books', 'books.*.title', 'books.*.author']);
    });

    it('should handle list fields with single field', () => {
      const fields = [
        {
          name: 'tags',
          widget: 'list',
          field: { name: 'tag', widget: 'string' },
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['tags', 'tags.*']);
    });

    it('should handle list fields without field or fields', () => {
      const fields = [
        {
          name: 'items',
          widget: 'list',
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['items', 'items.*']);
    });

    it('should handle nested object in list', () => {
      const fields = [
        {
          name: 'authors',
          widget: 'list',
          fields: [
            { name: 'name', widget: 'string' },
            {
              name: 'contact',
              widget: 'object',
              fields: [
                { name: 'email', widget: 'string' },
                { name: 'phone', widget: 'string' },
              ],
            },
          ],
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual([
        'authors',
        'authors.*.name',
        'authors.*.contact',
        'authors.*.contact.email',
        'authors.*.contact.phone',
      ]);
    });

    it('should handle object with types (variable types)', () => {
      const fields = [
        {
          name: 'content',
          widget: 'object',
          types: [
            {
              name: 'text',
              fields: [{ name: 'body', widget: 'markdown' }],
            },
            {
              name: 'image',
              fields: [{ name: 'src', widget: 'image' }],
            },
          ],
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['content', 'content.type', 'content.body', 'content.src']);
    });

    it('should handle list with types (variable types)', () => {
      const fields = [
        {
          name: 'blocks',
          widget: 'list',
          types: [
            {
              name: 'text',
              fields: [{ name: 'content', widget: 'markdown' }],
            },
            {
              name: 'gallery',
              fields: [{ name: 'images', widget: 'list', field: { widget: 'image' } }],
            },
          ],
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual([
        'blocks',
        'blocks.*.type',
        'blocks.*.content',
        'blocks.*.images',
        'blocks.*.images.*',
      ]);
    });

    it('should handle custom typeKey', () => {
      const fields = [
        {
          name: 'sections',
          widget: 'list',
          typeKey: 'component',
          types: [
            {
              name: 'hero',
              fields: [{ name: 'title', widget: 'string' }],
            },
          ],
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['sections', 'sections.*.component', 'sections.*.title']);
    });

    it('should handle select widget with multiple', () => {
      const fields = [
        {
          name: 'categories',
          widget: 'select',
          multiple: true,
          options: ['tech', 'design', 'business'],
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['categories', 'categories.*']);
    });

    it('should handle select widget without multiple', () => {
      const fields = [
        {
          name: 'category',
          widget: 'select',
          multiple: false,
          options: ['tech', 'design', 'business'],
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['category']);
    });

    it('should handle relation widget with multiple', () => {
      const fields = [
        {
          name: 'related',
          widget: 'relation',
          multiple: true,
          collection: 'posts',
          search_fields: ['title'],
          value_field: 'title',
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['related', 'related.*']);
    });

    it('should handle deeply nested structures', () => {
      const fields = [
        {
          name: 'page',
          widget: 'object',
          fields: [
            { name: 'title', widget: 'string' },
            {
              name: 'sections',
              widget: 'list',
              fields: [
                { name: 'heading', widget: 'string' },
                {
                  name: 'items',
                  widget: 'list',
                  fields: [
                    { name: 'label', widget: 'string' },
                    { name: 'value', widget: 'string' },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual([
        'page',
        'page.title',
        'page.sections',
        'page.sections.*.heading',
        'page.sections.*.items',
        'page.sections.*.items.*.label',
        'page.sections.*.items.*.value',
      ]);
    });

    it('should handle empty fields array', () => {
      const fields = [];
      const result = createKeyPathList(fields);

      expect(result).toEqual([]);
    });

    it('should handle keyvalue widget', () => {
      const fields = [
        {
          name: 'metadata',
          widget: 'keyvalue',
        },
      ];

      const result = createKeyPathList(fields);

      expect(result).toEqual(['metadata']);
    });
  });
});
