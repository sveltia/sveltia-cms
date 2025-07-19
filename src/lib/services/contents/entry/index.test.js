import { writable } from 'svelte/store';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { getEntryPreviewURL } from '$lib/services/contents/entry/index';

/**
 * @import {
 * Entry,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

// Mock the dependencies
vi.mock('$lib/services/config');
vi.mock('$lib/services/contents/collection/index-file');
vi.mock('$lib/services/common/slug');

describe('Test getEntryPreviewURL()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** @type {Entry} */
  const mockEntry = {
    id: 'test-entry',
    slug: 'test-entry',
    subPath: 'test-entry',
    locales: {
      en: {
        slug: 'test-entry',
        path: 'content/posts/test-entry.md',
        content: {
          title: 'Test Entry',
          date: '2024-01-15T10:30:00Z',
          tags: ['test', 'example'],
        },
      },
      ja: {
        slug: 'テスト-エントリ',
        path: 'content/posts/テスト-エントリ.md',
        content: {
          title: 'テストエントリ',
          date: '2024-01-15T10:30:00Z',
          tags: ['テスト', '例'],
        },
      },
    },
  };

  /** @type {InternalCollection} */
  const mockCollection = {
    name: 'posts',
    folder: 'content/posts',
    preview_path: '/posts/{{slug}}',
    fields: [
      {
        name: 'title',
        widget: 'string',
      },
      {
        name: 'date',
        widget: 'datetime',
        format: 'YYYY-MM-DDTHH:mm:ssZ',
      },
    ],
    _type: 'entry',
    _file: {
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: 'content/posts',
    },
    _i18n: {
      i18nEnabled: false,
      saveAllLocales: false,
      allLocales: ['en'],
      initialLocales: ['en'],
      defaultLocale: 'en',
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nRootMultiFolder: false,
      },
      canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
      omitDefaultLocaleFromFileName: false,
    },
    _thumbnailFieldNames: [],
  };

  test('returns undefined when show_preview_links is false', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: false,
      _baseURL: 'https://example.com',
    });

    const result = getEntryPreviewURL(mockEntry, 'en', mockCollection);

    expect(result).toBeUndefined();
  });

  test('returns undefined when baseURL is missing', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
    });

    const result = getEntryPreviewURL(mockEntry, 'en', mockCollection);

    expect(result).toBeUndefined();
  });

  test('returns undefined when entry locale does not exist', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    const result = getEntryPreviewURL(mockEntry, 'fr', mockCollection);

    expect(result).toBeUndefined();
  });

  test('returns undefined when preview_path is missing', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    const collectionWithoutPreviewPath = { ...mockCollection };

    delete collectionWithoutPreviewPath.preview_path;

    const result = getEntryPreviewURL(mockEntry, 'en', collectionWithoutPreviewPath);

    expect(result).toBeUndefined();
  });

  test('generates basic preview URL with slug', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('posts/test-entry');

    const result = getEntryPreviewURL(mockEntry, 'en', mockCollection);

    expect(fillSlugTemplate).toHaveBeenCalledWith(
      '/posts/{{slug}}',
      expect.objectContaining({
        type: 'preview_path',
        collection: mockCollection,
        content: mockEntry.locales.en.content,
        locale: 'en',
        currentSlug: 'test-entry',
        entryFilePath: 'content/posts/test-entry.md',
        dateTimeParts: undefined,
        isIndexFile: false,
      }),
    );
    expect(result).toBe('https://example.com/posts/test-entry');
  });

  test('handles baseURL with trailing slash', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com/',
    });

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('posts/test-entry');

    const result = getEntryPreviewURL(mockEntry, 'en', mockCollection);

    expect(result).toBe('https://example.com/posts/test-entry');
  });

  test('handles path with leading slash', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('/posts/test-entry');

    const result = getEntryPreviewURL(mockEntry, 'en', mockCollection);

    expect(result).toBe('https://example.com/posts/test-entry');
  });

  test('works with different locales', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('posts/テスト-エントリ');

    const result = getEntryPreviewURL(mockEntry, 'ja', mockCollection);

    expect(fillSlugTemplate).toHaveBeenCalledWith(
      '/posts/{{slug}}',
      expect.objectContaining({
        locale: 'ja',
        currentSlug: 'テスト-エントリ',
        content: mockEntry.locales.ja.content,
      }),
    );
    expect(result).toBe('https://example.com/posts/テスト-エントリ');
  });

  test('handles datetime fields in preview path template', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    const collectionWithDatePath = {
      ...mockCollection,
      preview_path: '/{{year}}/{{month}}/{{slug}}',
    };

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('2024/01/test-entry');

    const result = getEntryPreviewURL(mockEntry, 'en', collectionWithDatePath);

    expect(fillSlugTemplate).toHaveBeenCalledWith(
      '/{{year}}/{{month}}/{{slug}}',
      expect.objectContaining({
        dateTimeParts: expect.objectContaining({
          year: '2024',
          month: '01',
          day: '15',
        }),
      }),
    );
    expect(result).toBe('https://example.com/2024/01/test-entry');
  });

  test('handles specific datetime field in preview path', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    const entryWithCustomDate = {
      ...mockEntry,
      locales: {
        en: {
          ...mockEntry.locales.en,
          content: {
            ...mockEntry.locales.en.content,
            publishDate: '2023-12-25T15:45:00Z',
          },
        },
      },
    };

    const collectionWithCustomDateField = {
      ...mockCollection,
      preview_path: '/{{year}}/{{month}}/{{slug}}',
      preview_path_date_field: 'publishDate',
      fields: [
        ...(mockCollection.fields || []),
        {
          name: 'publishDate',
          widget: 'datetime',
          format: 'YYYY-MM-DDTHH:mm:ssZ',
        },
      ],
    };

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('2023/12/test-entry');

    const result = getEntryPreviewURL(entryWithCustomDate, 'en', collectionWithCustomDateField);

    expect(fillSlugTemplate).toHaveBeenCalledWith(
      '/{{year}}/{{month}}/{{slug}}',
      expect.objectContaining({
        dateTimeParts: expect.objectContaining({
          year: '2023',
          month: '12',
          day: '25',
        }),
      }),
    );
    expect(result).toBe('https://example.com/2023/12/test-entry');
  });

  test('returns undefined when datetime field is missing but required in template', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    const entryWithoutDate = {
      ...mockEntry,
      locales: {
        en: {
          ...mockEntry.locales.en,
          content: {
            title: 'Test Entry',
            // No date field
          },
        },
      },
    };

    const collectionWithDatePath = {
      ...mockCollection,
      preview_path: '/{{year}}/{{month}}/{{slug}}',
    };

    const result = getEntryPreviewURL(entryWithoutDate, 'en', collectionWithDatePath);

    expect(result).toBeUndefined();
  });

  test('handles UTC datetime fields', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    const collectionWithUTCDatePath = {
      ...mockCollection,
      preview_path: '/{{year}}/{{month}}/{{slug}}',
      fields: [
        {
          name: 'title',
          widget: 'string',
        },
        {
          name: 'date',
          widget: 'datetime',
          format: 'YYYY-MM-DDTHH:mm:ssZ',
          picker_utc: true,
        },
      ],
    };

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('2024/01/test-entry');

    const result = getEntryPreviewURL(mockEntry, 'en', collectionWithUTCDatePath);

    expect(result).toBe('https://example.com/2024/01/test-entry');
  });

  test('handles _index slug files correctly (omits _index from URL)', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    // Create an entry with _index slug
    const indexEntry = {
      ...mockEntry,
      slug: '_index',
      locales: {
        en: {
          slug: '_index',
          path: 'content/posts/_index.md',
          content: {
            title: 'Posts Index',
            date: '2024-01-15T10:30:00Z',
          },
        },
      },
    };

    // Mock index file functions
    const { isCollectionIndexFile, getIndexFile } = await import(
      '$lib/services/contents/collection/index-file'
    );

    vi.mocked(isCollectionIndexFile).mockReturnValue(true);
    vi.mocked(getIndexFile).mockReturnValue({
      fields: mockCollection.fields,
    });

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('posts');

    const result = getEntryPreviewURL(indexEntry, 'en', mockCollection);

    expect(fillSlugTemplate).toHaveBeenCalledWith(
      '/posts/{{slug}}',
      expect.objectContaining({
        currentSlug: '', // Empty slug for _index file (slug is ignored)
        isIndexFile: true,
      }),
    );
    expect(result).toBe('https://example.com/posts');
  });

  test('works with collection files', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    /** @type {InternalCollectionFile} */
    const mockCollectionFile = {
      name: 'homepage',
      file: 'content/index.md',
      preview_path: '/',
      fields: [
        {
          name: 'title',
          widget: 'string',
        },
      ],
      _file: {
        extension: 'md',
        format: 'yaml-frontmatter',
        basePath: 'content',
      },
      _i18n: {
        i18nEnabled: false,
        saveAllLocales: false,
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        structure: 'single_file',
        structureMap: {
          i18nSingleFile: true,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
        omitDefaultLocaleFromFileName: false,
      },
    };

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('');

    const result = getEntryPreviewURL(mockEntry, 'en', mockCollection, mockCollectionFile);

    expect(fillSlugTemplate).toHaveBeenCalledWith(
      '/',
      expect.objectContaining({
        type: 'preview_path',
        collection: mockCollection,
      }),
    );
    expect(result).toBe('https://example.com/');
  });

  test('returns undefined when fillSlugTemplate throws error', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate to throw an error
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockImplementation(() => {
      throw new Error('Template error');
    });

    const result = getEntryPreviewURL(mockEntry, 'en', mockCollection);

    expect(result).toBeUndefined();
  });

  test('handles empty content object', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      show_preview_links: true,
      _baseURL: 'https://example.com',
    });

    const entryWithEmptyContent = {
      ...mockEntry,
      locales: {
        en: {
          ...mockEntry.locales.en,
          content: {},
        },
      },
    };

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('posts/test-entry');

    const result = getEntryPreviewURL(entryWithEmptyContent, 'en', mockCollection);

    expect(result).toBe('https://example.com/posts/test-entry');
  });

  test('uses default show_preview_links when not explicitly set', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      _baseURL: 'https://example.com',
      // show_preview_links not set, should default to true
    });

    // Mock index file functions
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(isCollectionIndexFile).mockReturnValue(false);

    // Mock fillSlugTemplate
    const { fillSlugTemplate } = await import('$lib/services/common/slug');

    vi.mocked(fillSlugTemplate).mockReturnValue('posts/test-entry');

    const result = getEntryPreviewURL(mockEntry, 'en', mockCollection);

    expect(result).toBe('https://example.com/posts/test-entry');
  });
});
