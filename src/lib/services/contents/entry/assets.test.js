import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * @import { Asset, Entry, InternalEntryCollection } from '$lib/types/private';
 */

// Create hoisted mocks
const {
  mockGetMediaFieldURL,
  mockGetCollection,
  mockIsCollectionIndexFile,
  mockGetField,
  mockGetAssetByPath,
  mockGetAssetFoldersByPath,
} = vi.hoisted(() => ({
  mockGetMediaFieldURL: vi.fn(),
  mockGetCollection: vi.fn(),
  mockIsCollectionIndexFile: vi.fn(),
  mockGetField: vi.fn(),
  mockGetAssetByPath: vi.fn(),
  mockGetAssetFoldersByPath: vi.fn(),
}));

// Mock the dependencies with hoisted functions
vi.mock('$lib/services/assets', () => ({
  getAssetByPath: mockGetAssetByPath,
}));

vi.mock('$lib/services/assets/folders', () => ({
  getAssetFoldersByPath: mockGetAssetFoldersByPath,
}));

vi.mock('$lib/services/assets/info', () => ({
  getMediaFieldURL: mockGetMediaFieldURL,
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: mockGetCollection,
}));

vi.mock('$lib/services/contents/collection/index-file', () => ({
  isCollectionIndexFile: mockIsCollectionIndexFile,
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: mockGetField,
}));

// Import after mocking
const { getEntryThumbnail, getAssociatedAssets } = await import('./assets');

describe('getEntryThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMediaFieldURL.mockClear();
    mockGetCollection.mockClear();
    mockIsCollectionIndexFile.mockClear();
    mockGetField.mockClear();
    mockGetAssetByPath.mockClear();
    mockGetAssetFoldersByPath.mockClear();
  });

  /** @type {InternalEntryCollection} */
  const mockCollection = {
    name: 'posts',
    folder: 'content/posts',
    fields: [
      { name: 'title', widget: 'string' },
      { name: 'image', widget: 'image' },
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
    _thumbnailFieldNames: ['image', 'thumbnail'],
  };

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
          image: '/images/test.jpg',
        },
      },
    },
  };

  test('returns undefined when entry has no content', async () => {
    const entryWithoutContent = {
      ...mockEntry,
      locales: {
        en: {
          slug: 'test-entry',
          path: 'content/posts/test-entry.md',
          content: {},
        },
      },
    };

    const result = await getEntryThumbnail(mockCollection, entryWithoutContent);

    expect(result).toBeUndefined();
  });

  test('returns undefined when no thumbnail fields match', async () => {
    const entryWithoutImages = {
      ...mockEntry,
      locales: {
        en: {
          slug: 'test-entry',
          path: 'content/posts/test-entry.md',
          content: {
            title: 'Test Entry',
          },
        },
      },
    };

    const result = await getEntryThumbnail(mockCollection, entryWithoutImages);

    expect(result).toBeUndefined();
  });

  test('returns thumbnail URL when image field is found', async () => {
    mockGetMediaFieldURL.mockResolvedValue('https://example.com/thumbnails/test.jpg');

    const result = await getEntryThumbnail(mockCollection, mockEntry);

    expect(mockGetMediaFieldURL).toHaveBeenCalledWith({
      value: '/images/test.jpg',
      entry: mockEntry,
      collectionName: 'posts',
      thumbnail: true,
    });
    expect(result).toBe('https://example.com/thumbnails/test.jpg');
  });
});

describe('getAssociatedAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMediaFieldURL.mockClear();
    mockGetCollection.mockClear();
    mockIsCollectionIndexFile.mockClear();
    mockGetField.mockClear();
    mockGetAssetByPath.mockClear();
    mockGetAssetFoldersByPath.mockClear();
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
          image: '/images/test.jpg',
        },
      },
    },
  };

  test('returns empty array when collection does not exist', () => {
    mockGetCollection.mockReturnValue(undefined);

    const result = getAssociatedAssets({
      entry: mockEntry,
      collectionName: 'nonexistent',
    });

    expect(result).toEqual([]);
  });

  test('returns assets for image and file fields', () => {
    const mockCollection = { name: 'posts', _type: 'entry' };

    /** @type {Asset} */
    const mockAsset = {
      path: '/images/test.jpg',
      name: 'test.jpg',
      kind: 'image',
      size: 1024,
      text: '',
      sha: 'abc123',
      folder: {
        collectionName: 'posts',
        internalPath: 'images',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      },
    };

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);
    mockGetField.mockReturnValue({ widget: 'image' });
    mockGetAssetByPath.mockReturnValue(mockAsset);
    mockGetAssetFoldersByPath.mockReturnValue([
      { collectionName: 'posts', fileName: undefined, entryRelative: false },
    ]);

    const result = getAssociatedAssets({
      entry: mockEntry,
      collectionName: 'posts',
    });

    expect(result).toHaveLength(1);
    expect(result).toContain(mockAsset);
  });
});
