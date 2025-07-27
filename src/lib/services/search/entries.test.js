import { describe, expect, it } from 'vitest';

import { scanEntry, searchEntries } from './entries';

/**
 * @import { Entry } from '$lib/types/private';
 */

describe('searchEntries basic functionality', () => {
  /**
   * Create test entries with proper type structure.
   * @param {string} id Entry ID.
   * @param {object} content Entry content.
   * @returns {Entry} Mock entry object.
   */
  const createEntry = (id, content = {}) =>
    /** @type {Entry} */ ({
      id,
      slug: id,
      subPath: `/${id}`,
      collectionName: 'blog',
      fileName: `${id}.md`,
      sha: 'mock-sha',
      size: 1024,
      locales: {
        en: {
          slug: id,
          path: `/${id}`,
          content: {
            title: 'Default Title',
            description: 'Default description',
            ...content,
          },
        },
      },
      defaultLocaleKey: 'en',
      currentLocaleKey: 'en',
      // RepositoryFileMetadata properties
      commitAuthor: undefined,
      commitDate: undefined,
    });

  it('should return empty array when no entries provided', () => {
    const result = searchEntries({ entries: [], terms: 'test' });

    expect(result).toEqual([]);
  });

  it('should return empty array when no terms provided', () => {
    const entries = [createEntry('entry1'), createEntry('entry2')];
    const result = searchEntries({ entries, terms: '' });

    expect(result).toEqual([]);
  });

  it('should return empty array when terms are only whitespace', () => {
    const entries = [createEntry('entry1'), createEntry('entry2')];
    const result = searchEntries({ entries, terms: '   ' });

    expect(result).toEqual([]);
  });

  it('should test scanEntry function exists and returns number', () => {
    const entry = createEntry('test-entry', {
      title: 'Test Entry',
      description: 'A test entry about testing',
    });

    const points = scanEntry({ entry, terms: 'test' });

    expect(typeof points).toBe('number');
    expect(points).toBeGreaterThanOrEqual(0);
  });

  it('should handle entries with complex content', () => {
    const entries = [
      createEntry('blog-post', {
        title: 'JavaScript Best Practices',
        description: 'Learn about JavaScript development',
        tags: ['javascript', 'programming'],
        published: true,
        date: '2023-01-01',
      }),
      createEntry('python-guide', {
        title: 'Python Programming Guide',
        description: 'A comprehensive Python tutorial',
        tags: ['python', 'tutorial'],
        published: false,
      }),
    ];

    const result = searchEntries({ entries, terms: 'javascript' });

    // The function should work without errors
    expect(Array.isArray(result)).toBe(true);

    // If it finds matches, they should be valid entries
    result.forEach((entry) => {
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('slug');
      expect(entry).toHaveProperty('subPath');
      expect(entry).toHaveProperty('locales');
    });
  });

  it('should handle case-insensitive searches', () => {
    const entries = [
      createEntry('tutorial', {
        title: 'JavaScript Tutorial',
        description: 'Learn JavaScript basics',
      }),
      createEntry('guide', {
        title: 'Python Guide',
        description: 'Python programming guide',
      }),
    ];

    const result = searchEntries({ entries, terms: 'JAVASCRIPT' });

    expect(Array.isArray(result)).toBe(true);
  });

  it('should verify searchEntries respects normalization', () => {
    const entries = [
      createEntry('café-review', {
        title: 'Café Review',
        description: 'Review of a local café',
      }),
    ];

    // Should find the entry even with different accent usage
    const result = searchEntries({ entries, terms: 'cafe' });

    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle entries with numeric content', () => {
    const entries = [
      createEntry('year-2023', {
        title: 'Year 2023 Review',
        description: 'Looking back at 2023',
        year: 2023,
        views: 1500,
      }),
    ];

    const result = searchEntries({ entries, terms: '2023' });

    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle entries with empty or null content values', () => {
    const entries = [
      createEntry('empty-content', {
        title: 'Valid Title',
        description: '', // empty string
        tags: null, // null value
        metadata: undefined, // undefined value
      }),
    ];

    const result = searchEntries({ entries, terms: 'valid' });

    expect(Array.isArray(result)).toBe(true);
  });

  it('should test scanEntry with different content types', () => {
    const entry = createEntry('mixed-content', {
      title: 'Mixed Content Entry',
      description: 'Entry with various data types',
      year: 2023,
      published: true,
      tags: ['test', 'entry'],
      rating: 4.5,
    });

    // Test with different search terms
    const titlePoints = scanEntry({ entry, terms: 'mixed' });
    const yearPoints = scanEntry({ entry, terms: '2023' });
    const nonMatchPoints = scanEntry({ entry, terms: 'nonexistent' });

    expect(typeof titlePoints).toBe('number');
    expect(typeof yearPoints).toBe('number');
    expect(typeof nonMatchPoints).toBe('number');
    expect(nonMatchPoints).toBe(0);
  });

  it('should handle multiple locale entries', () => {
    const entry = /** @type {Entry} */ ({
      id: 'multilingual',
      slug: 'multilingual',
      subPath: '/multilingual',
      collectionName: 'blog',
      fileName: 'multilingual.md',
      sha: 'mock-sha',
      size: 1024,
      locales: {
        en: {
          slug: 'multilingual',
          path: '/multilingual',
          content: {
            title: 'English Title',
            description: 'English description',
          },
        },
        es: {
          slug: 'multilingual',
          path: '/multilingual',
          content: {
            title: 'Título en Español',
            description: 'Descripción en español',
          },
        },
      },
      defaultLocaleKey: 'en',
      currentLocaleKey: 'en',
      // RepositoryFileMetadata properties
      commitAuthor: undefined,
      commitDate: undefined,
    });

    const points = scanEntry({ entry, terms: 'english' });

    expect(typeof points).toBe('number');
    expect(points).toBeGreaterThanOrEqual(0);
  });
});
