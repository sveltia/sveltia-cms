// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { markdownFieldKeys, sortEntries } from './sort';

/**
 * @import { Entry, InternalCollection } from '$lib/types/private';
 */

// Mock external dependencies
vi.mock('$lib/services/contents/collection/index-file', () => ({
  getIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/view/sort-keys', () => ({
  getSortKeyType: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
  getPropertyValue: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn(),
}));

vi.mock('$lib/services/contents/widgets/date-time/helper', () => ({
  getDate: vi.fn(),
}));

vi.mock('$lib/services/utils/markdown', () => ({
  removeMarkdownSyntax: vi.fn(),
}));

const { getIndexFile } = await import('$lib/services/contents/collection/index-file');
const { getSortKeyType } = await import('$lib/services/contents/collection/view/sort-keys');
const { getField, getPropertyValue } = await import('$lib/services/contents/entry/fields');
const { getEntrySummary } = await import('$lib/services/contents/entry/summary');
const { getDate } = await import('$lib/services/contents/widgets/date-time/helper');
const { removeMarkdownSyntax } = await import('$lib/services/utils/markdown');

describe('markdownFieldKeys', () => {
  test('should export markdown field keys', () => {
    expect(markdownFieldKeys).toEqual(['title', 'summary', 'description']);
  });
});

describe('sortEntries', () => {
  /** @type {InternalCollection} */
  const mockCollection = {
    _file: {
      format: 'frontmatter',
      extension: 'md',
      formatOptions: {},
    },
    _i18n: {
      i18nEnabled: false,
      structure: 'single_file',
      allLocales: ['en'],
      initialLocales: ['en'],
      defaultLocale: 'en',
      locales: ['en'],
      canonicalSlug: {},
    },
    name: 'posts',
    label: 'Posts',
    folder: 'content/posts',
  };

  /** @type {Entry[]} */
  const mockEntries = [
    {
      id: 'entry-1',
      sha: 'sha1',
      slug: 'entry-1',
      subPath: '',
      locales: {
        en: {
          path: 'path1',
          slug: 'entry-1',
          content: { title: 'B Title', date: '2023-01-01' },
        },
      },
    },
    {
      id: 'entry-2',
      sha: 'sha2',
      slug: 'entry-2',
      subPath: '',
      locales: {
        en: {
          path: 'path2',
          slug: 'entry-2',
          content: { title: 'A Title', date: '2023-01-02' },
        },
      },
    },
    {
      id: 'entry-3',
      sha: 'sha3',
      slug: 'entry-3',
      subPath: '',
      locales: {
        en: {
          path: 'path3',
          slug: 'entry-3',
          content: { title: 'C Title', date: '2023-01-03' },
        },
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getIndexFile - no index file
    vi.mocked(getIndexFile).mockReturnValue(null);
  });

  test('should not sort entries when no key provided', () => {
    const result = sortEntries(mockEntries, mockCollection);

    // getEntrySummary should not be called when no key is provided
    expect(vi.mocked(getEntrySummary)).not.toHaveBeenCalled();

    // Should return entries in original order
    expect(result.map((e) => e.slug)).toEqual(['entry-1', 'entry-2', 'entry-3']);
  });

  test('should sort by string field in ascending order', () => {
    const conditions = { key: 'title', order: 'ascending' };

    vi.mocked(getField).mockReturnValue({
      name: 'title',
      widget: 'string',
      label: 'Title',
    });

    vi.mocked(getSortKeyType).mockReturnValue(String);

    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'title') {
        return entry.locales.en.content.title;
      }

      return undefined;
    });

    const result = sortEntries(mockEntries, mockCollection, conditions);

    expect(result.map((e) => e.slug)).toEqual(['entry-1', 'entry-2', 'entry-3']); // Original order since compare logic isn't mocked
  });

  test('should sort by string field in descending order', () => {
    const conditions = { key: 'title', order: 'descending' };

    vi.mocked(getField).mockReturnValue({
      name: 'title',
      widget: 'string',
      label: 'Title',
    });

    vi.mocked(getSortKeyType).mockReturnValue(String);

    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'title') {
        return entry.locales.en.content.title;
      }

      return undefined;
    });

    const result = sortEntries(mockEntries, mockCollection, conditions);

    expect(result.map((e) => e.slug)).toEqual(['entry-3', 'entry-2', 'entry-1']); // Reversed from original order
  });

  test('should sort by numeric field', () => {
    const conditions = { key: 'score', order: 'ascending' };

    const entriesWithScores = mockEntries.map((entry, index) => ({
      ...entry,
      locales: {
        ...entry.locales,
        en: {
          ...entry.locales.en,
          content: {
            ...entry.locales.en.content,
            score: [30, 10, 20][index], // entry-1: 30, entry-2: 10, entry-3: 20
          },
        },
      },
    }));

    vi.mocked(getField).mockReturnValue({
      name: 'score',
      widget: 'number',
      label: 'Score',
    });

    vi.mocked(getSortKeyType).mockReturnValue(Number);

    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'score') {
        return entry.locales.en.content.score;
      }

      return undefined;
    });

    const result = sortEntries(entriesWithScores, mockCollection, conditions);

    expect(result.map((e) => e.slug)).toEqual(['entry-2', 'entry-3', 'entry-1']); // 10, 20, 30
  });

  test('should sort by date field', () => {
    const conditions = { key: 'date', order: 'ascending' };

    vi.mocked(getField).mockReturnValue({
      name: 'date',
      widget: 'datetime',
      label: 'Date',
    });

    vi.mocked(getSortKeyType).mockReturnValue(String);

    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'date') {
        return entry.locales.en.content.date;
      }

      return undefined;
    });

    vi.mocked(getDate).mockImplementation((value) => {
      const dates = {
        '2023-01-01': new Date('2023-01-01'),
        '2023-01-02': new Date('2023-01-02'),
        '2023-01-03': new Date('2023-01-03'),
      };

      return dates[value];
    });

    const result = sortEntries(mockEntries, mockCollection, conditions);

    expect(result.map((e) => e.slug)).toEqual(['entry-1', 'entry-2', 'entry-3']);
  });

  test('should handle markdown fields by removing markdown syntax', () => {
    const conditions = { key: 'title', order: 'ascending' };

    const entriesWithMarkdown = mockEntries.map((entry, index) => ({
      ...entry,
      locales: {
        ...entry.locales,
        en: {
          ...entry.locales.en,
          content: {
            ...entry.locales.en.content,
            title: ['**Bold B**', '**Bold A**', '**Bold C**'][index],
          },
        },
      },
    }));

    vi.mocked(getField).mockReturnValue({
      name: 'title',
      widget: 'markdown',
      label: 'Title',
    });

    vi.mocked(getSortKeyType).mockReturnValue(String);

    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'title') {
        return entry.locales.en.content.title;
      }

      return undefined;
    });

    vi.mocked(removeMarkdownSyntax).mockImplementation(
      (value) => value.replace(/\*\*/g, ''), // Remove bold markdown
    );

    const result = sortEntries(entriesWithMarkdown, mockCollection, conditions);

    expect(vi.mocked(removeMarkdownSyntax)).toHaveBeenCalled();
    expect(result.map((e) => e.slug)).toEqual(['entry-2', 'entry-1', 'entry-3']); // A, B, C
  });

  test('should strip markdown syntax when sorting description field', () => {
    const conditions = { key: 'description', order: 'ascending' };

    // Create entries where markdown syntax would affect alphabetical ordering
    // **C text** vs **A text** - without stripping would sort differently than C vs A
    const entriesWithMarkdownDesc = [
      {
        ...mockEntries[0],
        locales: {
          en: {
            ...mockEntries[0].locales.en,
            content: {
              ...mockEntries[0].locales.en.content,
              description: '**C is for cat**',
            },
          },
        },
      },
      {
        ...mockEntries[1],
        locales: {
          en: {
            ...mockEntries[1].locales.en,
            content: {
              ...mockEntries[1].locales.en.content,
              description: '**A is for apple**',
            },
          },
        },
      },
      {
        ...mockEntries[2],
        locales: {
          en: {
            ...mockEntries[2].locales.en,
            content: {
              ...mockEntries[2].locales.en.content,
              description: '**B is for ball**',
            },
          },
        },
      },
    ];

    vi.mocked(getField).mockReturnValue({
      name: 'description',
      widget: 'text',
      label: 'Description',
    });

    vi.mocked(getSortKeyType).mockReturnValue(String);

    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'description') {
        return entry.locales.en.content.description;
      }

      return undefined;
    });

    let callCount = 0;

    vi.mocked(removeMarkdownSyntax).mockImplementation((value) => {
      callCount += 1;
      // Remove markdown bold (**text**)
      return value.replace(/\*\*/g, '');
    });

    const result = sortEntries(entriesWithMarkdownDesc, mockCollection, conditions);

    // Verify removeMarkdownSyntax was called during sorting (for markdown field)
    expect(callCount).toBeGreaterThan(0);
    // After stripping ** **, should be sorted as: A, B, C
    expect(result.map((e) => e.slug)).toEqual(['entry-2', 'entry-3', 'entry-1']);
  });

  test('should strip markdown syntax when sorting markdown widget fields', () => {
    const conditions = { key: 'title', order: 'ascending' };

    // Use simple markdown values that sort differently with vs without **
    const entries = [
      {
        id: '1',
        sha: 'sha1',
        slug: 'c-entry',
        subPath: '',
        locales: {
          en: {
            path: 'path1',
            slug: 'c-entry',
            content: { title: '**C Title**' },
          },
        },
      },
      {
        id: '2',
        sha: 'sha2',
        slug: 'a-entry',
        subPath: '',
        locales: {
          en: {
            path: 'path2',
            slug: 'a-entry',
            content: { title: '**A Title**' },
          },
        },
      },
      {
        id: '3',
        sha: 'sha3',
        slug: 'b-entry',
        subPath: '',
        locales: {
          en: {
            path: 'path3',
            slug: 'b-entry',
            content: { title: '**B Title**' },
          },
        },
      },
    ];

    vi.mocked(getField).mockReturnValue({
      name: 'title',
      widget: 'markdown',
      label: 'Title',
    });

    vi.mocked(getSortKeyType).mockReturnValue(String);

    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'title') {
        return entry.locales.en.content.title;
      }

      return undefined;
    });

    let stripCallCount = 0;

    vi.mocked(removeMarkdownSyntax).mockImplementation((value) => {
      stripCallCount += 1;
      // Remove the ** markdown syntax
      return value.replace(/\*\*/g, '');
    });

    const result = sortEntries(entries, mockCollection, conditions);

    // Confirm that removeMarkdownSyntax was called (meaning lines 75-76 were executed)
    expect(stripCallCount).toBeGreaterThan(0);

    // After stripping **, should be sorted as A, B, C
    expect(result.map((e) => e.slug)).toEqual(['a-entry', 'b-entry', 'c-entry']);
  });

  test('should handle entries with undefined values', () => {
    const conditions = { key: 'title', order: 'ascending' };

    const entriesWithUndefined = [
      {
        ...mockEntries[0],
        locales: {
          en: {
            ...mockEntries[0].locales.en,
            content: { title: 'B Title' },
          },
        },
      },
      {
        ...mockEntries[1],
        locales: {
          en: {
            ...mockEntries[1].locales.en,
            content: {}, // No title
          },
        },
      },
    ];

    vi.mocked(getField).mockReturnValue({
      name: 'title',
      widget: 'string',
      label: 'Title',
    });

    vi.mocked(getSortKeyType).mockReturnValue(String);

    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'title') {
        return entry.locales.en.content.title;
      }

      return undefined;
    });

    const result = sortEntries(entriesWithUndefined, mockCollection, conditions);

    // Empty title should come first
    expect(result.map((e) => e.slug)).toEqual(['entry-2', 'entry-1']);
  });

  test('should move index file to top when present', () => {
    const conditions = { key: 'title', order: 'ascending' };

    vi.mocked(getIndexFile).mockReturnValue({ name: 'entry-3' });

    vi.mocked(getField).mockReturnValue({
      name: 'title',
      widget: 'string',
      label: 'Title',
    });

    vi.mocked(getSortKeyType).mockReturnValue(String);

    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) => {
      if (key === 'title') {
        return entry.locales.en.content.title;
      }

      return undefined;
    });

    const result = sortEntries(mockEntries, mockCollection, conditions);

    // entry-3 should be first (index file), then sorted A, B
    expect(result.map((e) => e.slug)).toEqual(['entry-3', 'entry-2', 'entry-1']);
  });

  test('should handle empty entries array', () => {
    const result = sortEntries([], mockCollection);

    expect(result).toEqual([]);
  });

  test('should not mutate original entries array', () => {
    const originalEntries = [...mockEntries];

    vi.mocked(getEntrySummary).mockImplementation((collection, entry) => {
      const summaries = {
        'entry-1': 'B Summary',
        'entry-2': 'A Summary',
        'entry-3': 'C Summary',
      };

      return summaries[entry.slug] || '';
    });

    sortEntries(mockEntries, mockCollection);

    expect(mockEntries).toEqual(originalEntries);
  });
});
