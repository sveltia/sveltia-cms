import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getAssociatedCollections } from '$lib/services/contents/entry/collections';

/**
 * @import { InternalCollection } from '$lib/types/private';
 */

vi.mock('$lib/services/contents');
vi.mock('$lib/services/contents/folders');
vi.mock('$lib/services/contents/collection');

describe('Test getAssociatedCollections()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return collections for entry path', async () => {
    const mockEntry = {
      id: 'test-entry',
      slug: 'test-entry',
      subPath: 'test-entry',
      locales: {
        en: {
          slug: 'test-entry',
          path: 'content/posts/test-entry.md',
          content: { title: 'Test Entry' },
        },
      },
    };

    // Mock the dependencies
    const { getEntryFoldersByPath } = await import('$lib/services/contents/folders');
    const { getCollection } = await import('$lib/services/contents/collection');

    vi.mocked(getEntryFoldersByPath).mockReturnValue([
      { collectionName: 'posts' },
      { collectionName: 'blog' },
    ]);

    /** @type {import('$lib/types/private').InternalCollection} */
    const mockCollection = {
      name: 'posts',
      _type: /** @type {'entry'} */ ('entry'),
      folder: 'content/posts',
      fields: [],
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
          i18nSingleFileDefaultRoot: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nMultiRootFolder: false,
        },
        canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
        omitDefaultLocaleFromFilePath: false,
        omitDefaultLocaleFromPreviewPath: false,
      },
      _thumbnailFieldNames: [],
    };

    // blog collection doesn't exist
    vi.mocked(getCollection).mockReturnValueOnce(mockCollection).mockReturnValueOnce(undefined);

    const result = getAssociatedCollections(mockEntry);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(mockCollection);
    expect(getEntryFoldersByPath).toHaveBeenCalledWith('content/posts/test-entry.md');
  });

  test('should return empty array when no collections found', async () => {
    const mockEntry = {
      id: 'test-entry',
      slug: 'test-entry',
      subPath: 'test-entry',
      locales: {
        en: {
          slug: 'test-entry',
          path: 'content/posts/test-entry.md',
          content: { title: 'Test Entry' },
        },
      },
    };

    const { getEntryFoldersByPath } = await import('$lib/services/contents/folders');

    vi.mocked(getEntryFoldersByPath).mockReturnValue([]);

    const result = getAssociatedCollections(mockEntry);

    expect(result).toEqual([]);
  });

  test('should look up the folders once per entry until the entry folders change', async () => {
    const mockEntry = {
      id: 'cached-entry',
      slug: 'cached-entry',
      subPath: 'cached-entry',
      locales: {
        en: { slug: 'cached-entry', path: 'content/posts/cached-entry.md', content: {} },
      },
    };

    const { allEntryFolders } = await import('$lib/services/contents');
    const { getEntryFoldersByPath } = await import('$lib/services/contents/folders');
    const { getCollection } = await import('$lib/services/contents/collection');
    const mockCollection = /** @type {InternalCollection} */ ({ name: 'posts' });

    vi.mocked(getEntryFoldersByPath).mockReturnValue([{ collectionName: 'posts' }]);
    vi.mocked(getCollection).mockReturnValue(mockCollection);

    const getFolders = vi.spyOn(allEntryFolders, 'current', 'get').mockReturnValue([]);

    expect(getAssociatedCollections(mockEntry)).toEqual([mockCollection]);
    expect(getAssociatedCollections(mockEntry)).toEqual([mockCollection]);
    expect(getEntryFoldersByPath).toHaveBeenCalledTimes(1);

    // A configuration change replaces the folder list, which drops the cache
    getFolders.mockReturnValue([]);

    expect(getAssociatedCollections(mockEntry)).toEqual([mockCollection]);
    expect(getEntryFoldersByPath).toHaveBeenCalledTimes(2);
  });
});
