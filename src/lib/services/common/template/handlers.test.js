import { describe, expect, test } from 'vitest';

import { handleDateTimeTag, handleFilePathTag, handleSlugTag, handleUuidTag } from './handlers';

describe('Template handler functions', () => {
  describe('handleDateTimeTag()', () => {
    test('should return date-time field value when tag matches', () => {
      const dateTimeParts = {
        year: '2024',
        month: '10',
        day: '02',
        hour: '14',
        minute: '30',
        second: '45',
      };

      expect(handleDateTimeTag('year', dateTimeParts)).toBe('2024');
      expect(handleDateTimeTag('month', dateTimeParts)).toBe('10');
      expect(handleDateTimeTag('day', dateTimeParts)).toBe('02');
      expect(handleDateTimeTag('hour', dateTimeParts)).toBe('14');
      expect(handleDateTimeTag('minute', dateTimeParts)).toBe('30');
      expect(handleDateTimeTag('second', dateTimeParts)).toBe('45');
    });

    test('should return undefined for non-date-time tags', () => {
      const dateTimeParts = { year: '2024', month: '10', day: '02' };

      expect(handleDateTimeTag('slug', dateTimeParts)).toBeUndefined();
      expect(handleDateTimeTag('title', dateTimeParts)).toBeUndefined();
      expect(handleDateTimeTag('unknown', dateTimeParts)).toBeUndefined();
    });
  });

  describe('handleUuidTag()', () => {
    test('should return UUID for uuid tag', () => {
      const result = handleUuidTag('uuid');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result?.length).toBeGreaterThan(0);
    });

    test('should return short UUID for uuid_short tag', () => {
      const result = handleUuidTag('uuid_short');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result?.length).toBeGreaterThan(0);
    });

    test('should return shorter UUID for uuid_shorter tag', () => {
      const result = handleUuidTag('uuid_shorter');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result?.length).toBeGreaterThan(0);
    });

    test('should return undefined for non-UUID tags', () => {
      expect(handleUuidTag('slug')).toBeUndefined();
      expect(handleUuidTag('title')).toBeUndefined();
      expect(handleUuidTag('unknown')).toBeUndefined();
    });
  });

  describe('handleSlugTag()', () => {
    test('should return slug when tag is slug and currentSlug exists', () => {
      expect(handleSlugTag('slug', 'my-post', 'path', false)).toBe('my-post');
      expect(handleSlugTag('slug', 'another-slug', 'filename', false)).toBe('another-slug');
    });

    test('should return undefined when tag is not slug', () => {
      expect(handleSlugTag('title', 'my-post', 'path', false)).toBeUndefined();
      expect(handleSlugTag('year', 'my-post', 'path', false)).toBeUndefined();
    });

    test('should return undefined when currentSlug is undefined', () => {
      expect(handleSlugTag('slug', undefined, 'path', false)).toBeUndefined();
    });

    test('should return empty string for preview_path with index file', () => {
      expect(handleSlugTag('slug', '_index', 'preview_path', true)).toBe('');
      expect(handleSlugTag('slug', 'any-slug', 'preview_path', true)).toBe('');
    });

    test('should return slug for preview_path with non-index file', () => {
      expect(handleSlugTag('slug', 'my-post', 'preview_path', false)).toBe('my-post');
    });

    test('should return slug for non-preview_path types even with index file', () => {
      expect(handleSlugTag('slug', '_index', 'path', true)).toBe('_index');
      expect(handleSlugTag('slug', '_index', 'filename', true)).toBe('_index');
    });
  });

  describe('handleFilePathTag()', () => {
    test('should return dirname from entry file path', () => {
      expect(handleFilePathTag('dirname', 'content/posts/2024/my-post.md', 'content/posts')).toBe(
        '/2024',
      );
      expect(handleFilePathTag('dirname', 'content/blog/article.md', 'content/blog')).toBe('');
      expect(
        handleFilePathTag('dirname', 'content/posts/nested/folder/file.md', 'content/posts'),
      ).toBe('/nested/folder');
    });

    test('should return filename without extension', () => {
      expect(handleFilePathTag('filename', 'content/posts/my-post.md', 'content/posts')).toBe(
        'my-post',
      );
      expect(handleFilePathTag('filename', 'path/to/article.html', 'path/to')).toBe('article');
      expect(handleFilePathTag('filename', 'file.component.tsx', undefined)).toBe('file');
    });

    test('should return file extension', () => {
      expect(handleFilePathTag('extension', 'content/posts/my-post.md', 'content/posts')).toBe(
        'md',
      );
      expect(handleFilePathTag('extension', 'path/to/article.html', 'path/to')).toBe('html');
      expect(handleFilePathTag('extension', 'file.component.tsx', undefined)).toBe('tsx');
    });

    test('should return empty string when entry file path is undefined', () => {
      expect(handleFilePathTag('dirname', undefined, 'content/posts')).toBe('');
      expect(handleFilePathTag('filename', undefined, 'content/posts')).toBe('');
      expect(handleFilePathTag('extension', undefined, 'content/posts')).toBe('');
    });

    test('should return undefined for unknown tags', () => {
      expect(
        handleFilePathTag('slug', 'content/posts/my-post.md', 'content/posts'),
      ).toBeUndefined();
      expect(
        handleFilePathTag('title', 'content/posts/my-post.md', 'content/posts'),
      ).toBeUndefined();
    });

    test('should handle paths without base path', () => {
      expect(handleFilePathTag('dirname', 'posts/2024/my-post.md', undefined)).toBe('posts/2024');
      expect(handleFilePathTag('filename', 'my-post.md', undefined)).toBe('my-post');
    });
  });
});
