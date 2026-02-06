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
  mockGetAssetFolder,
  mockAllAssets,
} = vi.hoisted(() => ({
  mockGetMediaFieldURL: vi.fn(),
  mockGetCollection: vi.fn(),
  mockIsCollectionIndexFile: vi.fn(),
  mockGetField: vi.fn(),
  mockGetAssetByPath: vi.fn(),
  mockGetAssetFoldersByPath: vi.fn(),
  mockGetAssetFolder: vi.fn(),
  mockAllAssets: { set: vi.fn(), subscribe: vi.fn() },
}));

// Mock the dependencies with hoisted functions
vi.mock('$lib/services/assets', () => ({
  getAssetByPath: mockGetAssetByPath,
  /**
   * Check if a path is a relative path.
   * @param {string} path Path.
   * @returns {boolean} `true` if the path is relative.
   */
  isRelativePath: (path) => !/^[/@]/.test(path),
  allAssets: mockAllAssets,
}));

vi.mock('$lib/services/assets/folders', () => ({
  getAssetFoldersByPath: mockGetAssetFoldersByPath,
  getAssetFolder: mockGetAssetFolder,
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
        i18nMultiRootFolder: false,
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

  test('returns undefined when entry has no content in any locale (line 34-35)', async () => {
    const entryWithoutLocaleContent = /** @type {any} */ ({
      ...mockEntry,
      locales: {
        en: {
          slug: 'test-entry',
          path: 'content/posts/test-entry.md',
          // No content property
        },
      },
    });

    const result = await getEntryThumbnail(mockCollection, entryWithoutLocaleContent);

    expect(result).toBeUndefined();
  });

  test('returns undefined when all locales are missing content (line 34-35)', async () => {
    const entryWithoutAnyContent = /** @type {any} */ ({
      ...mockEntry,
      locales: {},
    });

    const result = await getEntryThumbnail(mockCollection, entryWithoutAnyContent);

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

  test('handles wildcard in thumbnail field name', async () => {
    const mockCollection = /** @type {any} */ ({
      name: 'posts',
      _i18n: { defaultLocale: 'en' },
      _thumbnailFieldNames: ['images.*.src'],
    });

    const mockEntryLocal = /** @type {any} */ ({
      locales: {
        en: {
          path: 'test.md',
          content: {
            'images.0.src': '/image1.jpg',
            'images.1.src': '/image2.jpg',
          },
        },
      },
    });

    mockGetMediaFieldURL.mockResolvedValue('https://example.com/image1.jpg');

    const result = await getEntryThumbnail(mockCollection, mockEntryLocal);

    expect(result).toBe('https://example.com/image1.jpg');
  });

  test('handles multiple thumbnail candidates and returns first available URL', async () => {
    const mockCollection = /** @type {any} */ ({
      name: 'posts',
      _i18n: { defaultLocale: 'en' },
      _thumbnailFieldNames: ['missing_image', 'existing_image'],
    });

    const mockEntryLocal = /** @type {any} */ ({
      locales: {
        en: {
          path: 'test.md',
          content: {
            missing_image: undefined,
            existing_image: '/test.jpg',
          },
        },
      },
    });

    mockGetMediaFieldURL.mockImplementation(async ({ value }) => {
      if (value === '/test.jpg') {
        return 'https://example.com/test.jpg';
      }

      return undefined;
    });

    const result = await getEntryThumbnail(mockCollection, mockEntryLocal);

    expect(result).toBe('https://example.com/test.jpg');
  });

  test('filters duplicate assets', () => {
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

    // Entry with duplicate image references
    const entryWithDuplicates = /** @type {any} */ ({
      locales: {
        en: {
          path: 'test.md',
          content: {
            image1: '/images/test.jpg',
            image2: '/images/test.jpg', // Same image referenced twice
          },
        },
      },
    });

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);
    mockGetField.mockReturnValue({ widget: 'image' });
    mockGetAssetByPath.mockReturnValue(mockAsset);
    mockGetAssetFoldersByPath.mockReturnValue([
      { collectionName: 'posts', fileName: undefined, entryRelative: false },
    ]);

    const result = getAssociatedAssets({
      entry: entryWithDuplicates,
      collectionName: 'posts',
    });

    // Should only contain the asset once despite duplicate references
    expect(result).toHaveLength(1);
    expect(result).toContain(mockAsset);
  });

  test('respects relative parameter to filter relative paths', () => {
    const mockCollection = { name: 'posts', _type: 'entry' };

    /** @type {Asset} */
    const mockAsset = {
      path: 'relative/image.jpg',
      name: 'image.jpg',
      kind: 'image',
      size: 1024,
      text: '',
      sha: 'abc123',
      folder: {
        collectionName: 'posts',
        internalPath: 'relative',
        publicPath: '/relative',
        entryRelative: true,
        hasTemplateTags: false,
      },
    };

    const entryWithRelativeAsset = /** @type {any} */ ({
      locales: {
        en: {
          path: 'test.md',
          content: {
            image1: 'relative/image.jpg', // Relative path
            image2: '/absolute/image.jpg', // Absolute path
          },
        },
      },
    });

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);

    mockGetField.mockImplementation(({ keyPath }) => {
      if (keyPath === 'image1' || keyPath === 'image2') {
        return { widget: 'image' };
      }

      return undefined;
    });

    mockGetAssetByPath.mockImplementation(({ value }) => {
      if (value === 'relative/image.jpg') {
        return mockAsset;
      }

      return undefined;
    });

    mockGetAssetFoldersByPath.mockReturnValue([
      { collectionName: 'posts', fileName: undefined, entryRelative: true },
    ]);

    const result = getAssociatedAssets({
      entry: entryWithRelativeAsset,
      collectionName: 'posts',
      relative: true,
    });

    // Should only include the relative path asset
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('relative/image.jpg');
  });

  test('accepts entry-relative assets when relative parameter is false (line 104-106 branch)', () => {
    const mockCollection = { name: 'posts', _type: 'entry' };

    /** @type {Asset} */
    const mockAsset = {
      path: 'relative/image.jpg',
      name: 'image.jpg',
      kind: 'image',
      size: 1024,
      text: '',
      sha: 'abc123',
      folder: {
        collectionName: 'posts',
        internalPath: 'relative',
        publicPath: '/relative',
        entryRelative: true,
        hasTemplateTags: false,
      },
    };

    const entryWithRelativeAsset = /** @type {any} */ ({
      locales: {
        en: {
          path: 'test.md',
          content: {
            image: 'relative/image.jpg', // Relative path
          },
        },
      },
    });

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);
    mockGetField.mockReturnValue({ widget: 'image' });
    mockGetAssetByPath.mockReturnValue(mockAsset);
    mockGetAssetFoldersByPath.mockReturnValue([
      { collectionName: 'posts', fileName: undefined, entryRelative: true },
    ]);

    const result = getAssociatedAssets({
      entry: entryWithRelativeAsset,
      collectionName: 'posts',
      relative: false, // Explicitly false - should still accept entryRelative: true assets
    });

    // Should include the asset even though it's entry-relative and relative is false
    expect(result).toHaveLength(1);
    expect(result).toContain(mockAsset);
  });

  test('excludes asset when getAssetFoldersByPath returns empty array (line 99-107)', () => {
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

    const entryWithAsset = /** @type {any} */ ({
      locales: {
        en: {
          path: 'test.md',
          content: {
            image: '/images/test.jpg',
          },
        },
      },
    });

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);
    mockGetField.mockReturnValue({ widget: 'image' });
    mockGetAssetByPath.mockReturnValue(mockAsset);
    // getAssetFoldersByPath returns empty array - no matching folder found
    mockGetAssetFoldersByPath.mockReturnValue([]);

    const result = getAssociatedAssets({
      entry: entryWithAsset,
      collectionName: 'posts',
    });

    // Should not include the asset since no folder matched
    expect(result).toHaveLength(0);
  });

  test('returns empty array when no locales have content (lines 34-35)', () => {
    const mockCollection = { name: 'posts', _type: 'entry' };

    const entryWithoutContent = /** @type {any} */ ({
      locales: {
        en: {
          path: 'test.md',
          content: undefined,
        },
      },
    });

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);

    const result = getAssociatedAssets({
      entry: entryWithoutContent,
      collectionName: 'posts',
    });

    expect(result).toEqual([]);
  });

  test('handles orphaned entry-relative assets (lines 121-131)', () => {
    const mockCollection = { name: 'posts', _type: 'entry' };

    const mockAsset = /** @type {Asset} */ ({
      path: 'post-dir/orphaned.jpg',
      name: 'orphaned.jpg',
      kind: 'image',
      size: 1024,
      text: '',
      sha: 'abc123',
      folder: {
        collectionName: 'posts',
        internalPath: 'post-dir',
        publicPath: '/post-dir',
        entryRelative: true,
        hasTemplateTags: false,
      },
    });

    const entryWithContent = /** @type {any} */ ({
      locales: {
        en: {
          path: 'post-dir/index.md',
          content: {
            title: 'Test',
            // No image field in content
          },
        },
      },
    });

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);
    mockGetField.mockReturnValue(undefined); // No image field
    mockGetAssetByPath.mockReturnValue(undefined);
    mockGetAssetFolder.mockReturnValue({ entryRelative: true });
    mockGetAssetFoldersByPath.mockReturnValue([]);
    mockAllAssets.subscribe.mockImplementation((callback) => {
      callback([mockAsset]);
      return vi.fn();
    });

    const result = getAssociatedAssets({
      entry: entryWithContent,
      collectionName: 'posts',
      relative: true,
    });

    // Should include the orphaned asset since it's in the same directory
    expect(result).toContain(mockAsset);
  });

  test('does not duplicate assets already in the array (line 126 !assets.find)', () => {
    // Test that when an asset is already in the assets array,
    // it's not added again even if it appears in allAssets
    const mockCollection = { name: 'posts', _type: 'entry' };

    const sharedAsset = /** @type {Asset} */ ({
      path: 'post-dir/shared.jpg',
      name: 'shared.jpg',
      kind: 'image',
      size: 1024,
      text: '',
      sha: 'shared123',
      folder: {
        collectionName: 'posts',
        internalPath: 'post-dir',
        publicPath: '/post-dir',
        entryRelative: true,
        hasTemplateTags: false,
      },
    });

    const entryWithContent = /** @type {any} */ ({
      locales: {
        en: {
          path: 'post-dir/index.md',
          content: {
            title: 'Test',
            image: 'post-dir/shared.jpg', // This asset is in the content
          },
        },
      },
    });

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);
    mockGetField.mockReturnValue({ widget: 'image' }); // Image field
    mockGetAssetByPath.mockReturnValue(sharedAsset); // Asset from content
    mockGetAssetFoldersByPath.mockReturnValue([
      {
        collectionName: 'posts',
        fileName: undefined,
        entryRelative: true,
      },
    ]);
    mockGetAssetFolder.mockReturnValue({ entryRelative: true });
    mockAllAssets.subscribe.mockImplementation((callback) => {
      // Same asset appears in allAssets (as orphaned)
      callback([sharedAsset]);
      return vi.fn();
    });

    const result = getAssociatedAssets({
      entry: entryWithContent,
      collectionName: 'posts',
      relative: true,
    });

    // Should only contain the asset once (not duplicated)
    expect(result.filter((a) => a.path === 'post-dir/shared.jpg')).toHaveLength(1);
  });

  test('does not include orphaned assets when relative is false (lines 121-131)', () => {
    const mockCollection = { name: 'posts', _type: 'entry' };

    const mockAsset = /** @type {Asset} */ ({
      path: 'post-dir/orphaned.jpg',
      name: 'orphaned.jpg',
      kind: 'image',
      size: 1024,
      text: '',
      sha: 'abc123',
      folder: {
        collectionName: 'posts',
        internalPath: 'post-dir',
        publicPath: '/post-dir',
        entryRelative: true,
        hasTemplateTags: false,
      },
    });

    const entryWithContent = /** @type {any} */ ({
      locales: {
        en: {
          path: 'post-dir/index.md',
          content: {
            title: 'Test',
          },
        },
      },
    });

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);
    mockGetField.mockReturnValue(undefined);
    mockGetAssetByPath.mockReturnValue(undefined);
    mockGetAssetFolder.mockReturnValue({ entryRelative: true });
    mockGetAssetFoldersByPath.mockReturnValue([]);
    mockAllAssets.subscribe.mockImplementation((callback) => {
      callback([mockAsset]);
      return vi.fn();
    });

    const result = getAssociatedAssets({
      entry: entryWithContent,
      collectionName: 'posts',
      relative: false, // Not requesting relative assets
    });

    // Should not include orphaned assets when relative is false
    expect(result).not.toContain(mockAsset);
  });

  test('treats paths starting with @ as absolute paths', () => {
    const mockCollection = { name: 'posts', _type: 'entry' };

    /** @type {Asset} */
    const mockAsset = {
      path: '/media/image.jpg',
      name: 'image.jpg',
      kind: 'image',
      size: 1024,
      text: '',
      sha: 'abc123',
      folder: {
        collectionName: 'posts',
        internalPath: 'media',
        publicPath: '/media',
        entryRelative: false,
        hasTemplateTags: false,
      },
    };

    const entryWithAliasPath = /** @type {any} */ ({
      locales: {
        en: {
          path: 'test.md',
          content: {
            image1: '@assets/image.jpg', // Alias path - should be treated as absolute
            image2: 'relative/image.jpg', // Relative path
          },
        },
      },
    });

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);

    mockGetField.mockImplementation(({ keyPath }) => {
      if (keyPath === 'image1' || keyPath === 'image2') {
        return { widget: 'image' };
      }

      return undefined;
    });

    mockGetAssetByPath.mockImplementation(({ value }) => {
      if (value === 'relative/image.jpg') {
        return mockAsset;
      }

      return undefined;
    });

    mockGetAssetFoldersByPath.mockReturnValue([
      { collectionName: 'posts', fileName: undefined, entryRelative: true },
    ]);

    const result = getAssociatedAssets({
      entry: entryWithAliasPath,
      collectionName: 'posts',
      relative: true,
    });

    // Should only include the relative path asset, not the @assets path
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/media/image.jpg');
  });

  test('excludes paths starting with @ when filtering relative paths', () => {
    const mockCollection = { name: 'posts', _type: 'entry' };

    const entryWithMixedPaths = /** @type {any} */ ({
      locales: {
        en: {
          path: 'test.md',
          content: {
            image1: '@assets/image.jpg', // Alias - absolute
            image2: '@media/uploads/photo.jpg', // Alias - absolute
            image3: 'relative/image.jpg', // Relative
          },
        },
      },
    });

    mockGetCollection.mockReturnValue(mockCollection);
    mockIsCollectionIndexFile.mockReturnValue(false);

    mockGetField.mockReturnValue({ widget: 'image' });
    mockGetAssetByPath.mockReturnValue(undefined);
    mockGetAssetFoldersByPath.mockReturnValue([
      { collectionName: 'posts', fileName: undefined, entryRelative: true },
    ]);

    const result = getAssociatedAssets({
      entry: entryWithMixedPaths,
      collectionName: 'posts',
      relative: true,
    });

    // Paths starting with @ should be treated as absolute and not included in relative filtering
    expect(result).toHaveLength(0);
    expect(
      mockGetAssetByPath.mock.calls.some((call) => call[0].value === '@assets/image.jpg'),
    ).toBe(false);
    expect(
      mockGetAssetByPath.mock.calls.some((call) => call[0].value === '@media/uploads/photo.jpg'),
    ).toBe(false);
  });
});
