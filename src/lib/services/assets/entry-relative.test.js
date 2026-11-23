import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  fillInternalPathTemplate,
  findInEntryRelativeFolder,
  getEntryRelativePublicPath,
} from '$lib/services/assets/entry-relative';
import { allAssets } from '$lib/services/assets/state';
import { fillTemplate } from '$lib/services/common/template';
import { getCollection } from '$lib/services/contents/collection';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getAssociatedCollections } from '$lib/services/contents/entry/collections';

/**
 * @import { Asset, AssetFolderInfo, Entry, InternalCollection } from '$lib/types/private';
 */

vi.mock('$lib/services/common/template');
vi.mock('$lib/services/contents/collection');
vi.mock('$lib/services/contents/collection/entries/index-file');
vi.mock('$lib/services/contents/entry/collections');

/**
 * Collection keeping each entry in a folder of its own, e.g. `content/posts/hello/index.md`.
 * @type {InternalCollection}
 */
const collection = /** @type {any} */ ({
  name: 'posts',
  folder: 'content/posts',
  _type: 'entry',
  _file: { subPath: '{{slug}}/index' },
  _i18n: { defaultLocale: 'en' },
});

/**
 * Same collection keeping the entry files side by side, e.g. `content/posts/hello.md`.
 * @type {InternalCollection}
 */
const flatCollection = /** @type {any} */ ({ ...collection, _file: { subPath: undefined } });

/**
 * Entry in a folder of its own.
 * @type {Entry}
 */
const entry = /** @type {any} */ ({
  id: 'hello',
  slug: 'hello',
  locales: { en: { slug: 'hello', path: 'content/posts/hello/index.md', content: {} } },
});

/**
 * Same entry with a locale folder per locale, as with the `multiple_folders` i18n structure.
 * @type {Entry}
 */
const i18nEntry = /** @type {any} */ ({
  ...entry,
  locales: {
    en: { slug: 'hello', path: 'content/posts/en/hello/index.md', content: {} },
    fr: { slug: 'hello', path: 'content/posts/fr/hello/index.md', content: {} },
  },
});

/**
 * Same entry stored as a file beside the other entries.
 * @type {Entry}
 */
const flatEntry = /** @type {any} */ ({
  ...entry,
  locales: { en: { slug: 'hello', path: 'content/posts/hello.md', content: {} } },
});

/**
 * `media_folder: images` with `public_folder: /blog/{{slug}}/images`: the files are saved beside
 * the entry, and referenced with an absolute path.
 * @type {AssetFolderInfo}
 */
const folder = /** @type {any} */ ({
  collectionName: 'posts',
  internalPath: 'content/posts',
  internalSubPath: 'images',
  publicPath: '/blog/{{slug}}/images',
  entryRelative: true,
  hasTemplateTags: false,
});

/**
 * Create an asset in the given folder.
 * @param {string} path Asset path.
 * @param {AssetFolderInfo} [_folder] Asset folder.
 * @returns {Asset} Asset.
 */
const createAsset = (path, _folder = folder) =>
  /** @type {any} */ ({
    path,
    name: path.split('/').pop(),
    sha: path,
    size: 1,
    kind: 'image',
    folder: _folder,
  });

beforeEach(() => {
  // Fill the slug tag with the entry’s slug
  vi.mocked(fillTemplate).mockImplementation((template, { currentSlug }) =>
    template.replaceAll('{{slug}}', /** @type {string} */ (currentSlug)),
  );
  vi.mocked(getCollection).mockReturnValue(collection);
  vi.mocked(getAssociatedCollections).mockReturnValue([collection]);
  allAssets.current = [];
});

describe('fillInternalPathTemplate()', () => {
  /** @type {InternalCollection} */
  const mockCollection = /** @type {any} */ ({ name: 'posts', _i18n: { defaultLocale: 'en' } });

  /** @type {Entry} */
  const mockEntry = /** @type {any} */ ({
    id: 'my-post',
    slug: 'my-post',
    locales: {
      en: { path: 'content/posts/my-post.md', content: { title: 'My Post' } },
    },
  });

  test('should return the path as is when it has no template tags', () => {
    expect(
      fillInternalPathTemplate({
        internalPath: 'static/uploads',
        collectionName: 'posts',
        entry: mockEntry,
      }),
    ).toBe('static/uploads');

    expect(fillTemplate).not.toHaveBeenCalled();
  });

  test('should fill all the template tags using the collection and entry', () => {
    vi.mocked(getCollection).mockReturnValue(mockCollection);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(fillTemplate).mockReturnValue('content/posts/2024/my-post/media');

    const result = fillInternalPathTemplate({
      internalPath: 'content/posts/{{year}}/{{slug}}/media',
      collectionName: 'posts',
      entry: mockEntry,
    });

    expect(result).toBe('content/posts/2024/my-post/media');
    expect(fillTemplate).toHaveBeenCalledWith('content/posts/{{year}}/{{slug}}/media', {
      type: 'media_folder',
      collection: mockCollection,
      content: { title: 'My Post' },
      currentSlug: 'my-post',
      entryFilePath: 'content/posts/my-post.md',
      isIndexFile: false,
    });
  });

  test('should fall back to the first available locale when the default locale is missing', () => {
    vi.mocked(getCollection).mockReturnValue(mockCollection);
    vi.mocked(fillTemplate).mockReturnValue('content/posts/my-post/media');

    fillInternalPathTemplate({
      internalPath: 'content/posts/{{slug}}/media',
      collectionName: 'posts',
      entry: /** @type {any} */ ({
        ...mockEntry,
        locales: { fr: { path: 'content/posts/fr/my-post.md', content: {} } },
      }),
    });

    expect(fillTemplate).toHaveBeenCalledWith(
      'content/posts/{{slug}}/media',
      expect.objectContaining({ entryFilePath: 'content/posts/fr/my-post.md' }),
    );
  });

  test('should resolve the path against the given locale’s entry file', () => {
    fillInternalPathTemplate({
      internalPath: 'content/posts/{{slug}}',
      collectionName: 'posts',
      entry: i18nEntry,
      locale: 'fr',
    });

    expect(fillTemplate).toHaveBeenCalledWith(
      'content/posts/{{slug}}',
      expect.objectContaining({ entryFilePath: 'content/posts/fr/hello/index.md' }),
    );
  });

  test('should use the entry’s first collection without a collection name', () => {
    expect(
      fillInternalPathTemplate({
        internalPath: 'content/posts/{{slug}}',
        collectionName: undefined,
        entry,
      }),
    ).toBe('content/posts/hello');
    expect(getAssociatedCollections).toHaveBeenCalledWith(entry);
  });

  test('should return undefined when the entry is not given', () => {
    expect(
      fillInternalPathTemplate({
        internalPath: 'content/posts/{{slug}}/media',
        collectionName: 'posts',
        entry: undefined,
      }),
    ).toBeUndefined();
    expect(
      fillInternalPathTemplate({
        internalPath: 'content/posts/{{slug}}/media',
        collectionName: undefined,
        entry: undefined,
      }),
    ).toBeUndefined();
  });

  test('should return undefined when the collection cannot be determined', () => {
    vi.mocked(getAssociatedCollections).mockReturnValue([]);

    expect(
      fillInternalPathTemplate({
        internalPath: 'content/posts/{{slug}}/media',
        collectionName: undefined,
        entry: mockEntry,
      }),
    ).toBeUndefined();
  });
});

describe('getEntryRelativePublicPath()', () => {
  /**
   * Get the public path of the given asset.
   * @param {Asset} asset Asset.
   * @param {boolean} [withEntry] Whether to pass the entry, which is `undefined` for a new draft.
   * @returns {string | undefined} Path.
   */
  const getPath = (asset, withEntry = true) =>
    getEntryRelativePublicPath({
      asset,
      folder: asset.folder,
      entry: withEntry ? entry : undefined,
    });

  test('should return the absolute path with the template tags filled', () => {
    expect(getPath(createAsset('content/posts/hello/images/photo.jpg'))).toBe(
      '/blog/hello/images/photo.jpg',
    );
    expect(getPath(createAsset('content/posts/hello/images/sub/photo.jpg'))).toBe(
      '/blog/hello/images/sub/photo.jpg',
    );
  });

  test('should return the absolute path for a root public path or no subfolder', () => {
    expect(
      getPath(createAsset('content/posts/hello/images/photo.jpg', { ...folder, publicPath: '/' })),
    ).toBe('/photo.jpg');
    expect(
      getPath(
        createAsset('content/posts/hello/photo.jpg', {
          ...folder,
          internalSubPath: undefined,
          publicPath: '/media',
        }),
      ),
    ).toBe('/media/photo.jpg');
  });

  test('should return the file name of an asset beside the entry file', () => {
    expect(
      getPath(
        createAsset('content/posts/hello/photo.jpg', {
          ...folder,
          internalSubPath: undefined,
          publicPath: '',
        }),
      ),
    ).toBe('photo.jpg');
  });

  test('should keep a relative public path relative', () => {
    expect(
      getPath(
        createAsset('content/posts/hello/images/photo.jpg', { ...folder, publicPath: 'images' }),
      ),
    ).toBe('images/photo.jpg');
  });

  test('should fall back to the relative path if the absolute one can’t be determined', () => {
    // Outside the subfolder the public path stands for
    expect(getPath(createAsset('content/posts/hello/photo.jpg'))).toBe('photo.jpg');
    // The template tags can’t be filled without an entry
    expect(getPath(createAsset('content/posts/images/photo.jpg'), false)).toBe('images/photo.jpg');
    expect(
      getPath(
        createAsset('content/posts/images/photo.jpg', {
          ...folder,
          internalSubPath: '{{slug}}',
          publicPath: '/images',
        }),
        false,
      ),
    ).toBeUndefined();
    // Not in the entry’s folder
    expect(getPath(createAsset('content/posts/world/images/photo.jpg'))).toBeUndefined();
  });

  test('should return the path of an asset at the repository root without an entry', () => {
    expect(
      getPath(
        createAsset('photo.jpg', {
          ...folder,
          internalPath: '',
          internalSubPath: undefined,
          publicPath: '',
        }),
        false,
      ),
    ).toBe('photo.jpg');
  });

  test('should return the absolute path without an entry if there is no template tag', () => {
    expect(
      getPath(
        createAsset('content/posts/images/photo.jpg', { ...folder, publicPath: '/images' }),
        false,
      ),
    ).toBe('/images/photo.jpg');
  });

  test('should normalize the public path the same way as a saved one', () => {
    // An empty segment, e.g. left by a tag filled with an empty string, and a `..` segment
    expect(
      getPath(
        createAsset('content/posts/hello/images/photo.jpg', {
          ...folder,
          publicPath: '/blog//media/../images',
        }),
      ),
    ).toBe('/blog/images/photo.jpg');
  });

  test('should normalize the subfolder the same way as the folder an asset is saved to', () => {
    // An empty segment, e.g. left by a tag filled with an empty string
    expect(
      getPath(
        createAsset('content/posts/hello/images/photo.jpg', {
          ...folder,
          internalSubPath: '/images',
        }),
      ),
    ).toBe('/blog/hello/images/photo.jpg');
  });
});

describe('findInEntryRelativeFolder()', () => {
  const photo = createAsset('content/posts/hello/images/photo.jpg');
  const nestedPhoto = createAsset('content/posts/hello/images/sub/nested.jpg');
  const otherPhoto = createAsset('content/posts/world/images/other.jpg');

  /**
   * Look up an asset by the given absolute path.
   * @param {string} path Path.
   * @param {Record<string, any>} [options] Other arguments.
   * @returns {Asset | undefined} Asset.
   */
  const find = (path, options = {}) =>
    findInEntryRelativeFolder({ path, folder, entry, ...options });

  beforeEach(() => {
    allAssets.current = [photo, nestedPhoto, otherPhoto];
  });

  test('should find an asset beside the entry by its absolute path', () => {
    expect(find('/blog/hello/images/photo.jpg')).toBe(photo);
    expect(find('/blog/hello/images/sub/nested.jpg')).toBe(nestedPhoto);
  });

  test('should not find an asset beside another entry or outside the public path', () => {
    expect(find('/blog/hello/images/other.jpg')).toBeUndefined();
    expect(find('/blog/world/images/other.jpg')).toBeUndefined();
    expect(find('/images/photo.jpg')).toBeUndefined();
  });

  test('should find an asset by the root public path', () => {
    const rootFolder = { ...folder, publicPath: '/' };

    expect(find('/photo.jpg', { folder: rootFolder })).toBe(photo);
    expect(find('/sub/nested.jpg', { folder: rootFolder })).toBe(nestedPhoto);
  });

  test('should find an asset in the folder holding the entry without a subfolder', () => {
    const besideEntry = createAsset('content/posts/hello/beside.jpg');

    allAssets.current = [besideEntry];

    expect(
      find('/media/beside.jpg', {
        folder: { ...folder, internalSubPath: undefined, publicPath: '/media' },
      }),
    ).toBe(besideEntry);
  });

  test('should find an asset beside an entry file that doesn’t have a folder of its own', () => {
    const flatPhoto = createAsset('content/posts/images/flat.jpg');

    vi.mocked(getCollection).mockReturnValue(flatCollection);
    allAssets.current = [flatPhoto];

    expect(
      find('/images/flat.jpg', {
        folder: { ...folder, publicPath: '/images' },
        entry: { ...entry, locales: { en: { ...entry.locales.en, path: 'content/posts/a.md' } } },
      }),
    ).toBe(flatPhoto);
  });

  test('should find an asset stored beside the entry file before it had a folder', () => {
    const legacyPhoto = createAsset('content/posts/2025/images/legacy.jpg');

    // The entry `content/posts/2025/hello.md` owns `content/posts/2025/hello`
    vi.mocked(getCollection).mockReturnValue(
      /** @type {any} */ ({ ...collection, _file: { subPath: '{{year}}/{{slug}}' } }),
    );
    allAssets.current = [legacyPhoto];

    expect(
      find('/blog/hello/images/legacy.jpg', {
        entry: {
          ...entry,
          locales: { en: { ...entry.locales.en, path: 'content/posts/2025/hello.md' } },
        },
      }),
    ).toBe(legacyPhoto);
  });

  test('should fill the template tags in the subfolder', () => {
    const hexoPhoto = createAsset('content/posts/hello/hexo.jpg');

    // Hexo’s post asset folder: `media_folder: '{{slug}}'` beside `content/posts/hello.md`
    vi.mocked(getCollection).mockReturnValue(flatCollection);
    allAssets.current = [hexoPhoto];

    expect(
      find('/assets/hexo.jpg', {
        folder: { ...folder, internalSubPath: '{{slug}}', publicPath: '/assets' },
        entry: { ...entry, locales: { en: { ...entry.locales.en, path: 'content/posts/a.md' } } },
      }),
    ).toBe(hexoPhoto);
  });

  test('should resolve a path against the collection folder without an entry', () => {
    const sharedPhoto = createAsset('content/posts/images/shared.jpg');

    allAssets.current = [sharedPhoto];

    expect(
      find('/images/shared.jpg', {
        folder: { ...folder, publicPath: '/images' },
        entry: undefined,
      }),
    ).toBe(sharedPhoto);
    // The template tags can’t be filled without an entry
    expect(
      find('/images/shared.jpg', {
        folder: { ...folder, internalSubPath: '{{slug}}', publicPath: '/images' },
        entry: undefined,
      }),
    ).toBeUndefined();
    expect(find('/blog/hello/images/photo.jpg', { entry: undefined })).toBeUndefined();
  });

  test('should resolve a path against the collection folder if the collection is unknown', () => {
    const sharedPhoto = createAsset('content/posts/images/shared.jpg');

    vi.mocked(getCollection).mockReturnValue(undefined);
    allAssets.current = [sharedPhoto];

    expect(find('/images/shared.jpg', { folder: { ...folder, publicPath: '/images' } })).toBe(
      sharedPhoto,
    );
  });

  test('should normalize the public path the same way as a saved one', () => {
    // An empty segment, e.g. left by a tag filled with an empty string, and a `..` segment
    const _folder = { ...folder, publicPath: '/blog/{{slug}}//media/../images' };

    expect(find('/blog/hello/images/photo.jpg', { folder: _folder })).toBe(photo);
    expect(find('/blog/hello//media/../images/photo.jpg', { folder: _folder })).toBeUndefined();
  });

  describe('with a locale folder per locale', () => {
    const enPhoto = createAsset('content/posts/en/hello/images/photo.jpg');
    const frPhoto = createAsset('content/posts/fr/hello/images/photo.jpg');
    const enOnlyPhoto = createAsset('content/posts/en/hello/images/cover.jpg');

    beforeEach(() => {
      allAssets.current = [enPhoto, frPhoto, enOnlyPhoto];
    });

    test('should find the asset beside the given locale’s entry file', () => {
      expect(find('/blog/hello/images/photo.jpg', { entry: i18nEntry, locale: 'fr' })).toBe(
        frPhoto,
      );
      expect(find('/blog/hello/images/photo.jpg', { entry: i18nEntry, locale: 'en' })).toBe(
        enPhoto,
      );
      expect(find('/blog/hello/images/photo.jpg', { entry: i18nEntry })).toBe(enPhoto);
    });

    test('should fall back to the default locale’s copy of a file only that locale has', () => {
      expect(find('/blog/hello/images/cover.jpg', { entry: i18nEntry, locale: 'fr' })).toBe(
        enOnlyPhoto,
      );
      expect(
        find('/blog/hello/images/missing.jpg', { entry: i18nEntry, locale: 'fr' }),
      ).toBeUndefined();
    });
  });
});

describe('round trip between an asset and its absolute public path', () => {
  /**
   * Map the given asset to its absolute public path and back.
   * @param {object} args Arguments.
   * @param {Asset} args.asset Asset.
   * @param {Entry} args.entry Entry the asset belongs to.
   * @param {string} [args.locale] Locale.
   * @returns {{ path: string | undefined, found: Asset | undefined }} Public path and the asset
   * found for it.
   */
  const roundTrip = ({ asset, entry: _entry, locale }) => {
    const path = getEntryRelativePublicPath({ asset, folder: asset.folder, entry: _entry, locale });

    const found = path
      ? findInEntryRelativeFolder({ path, folder: asset.folder, entry: _entry, locale })
      : undefined;

    return { path, found };
  };

  test('should find the same asset for an entry in a folder of its own', () => {
    const photo = createAsset('content/posts/hello/images/photo.jpg');
    const nestedPhoto = createAsset('content/posts/hello/images/sub/nested.jpg');
    const otherPhoto = createAsset('content/posts/world/images/photo.jpg');

    allAssets.current = [otherPhoto, photo, nestedPhoto];

    expect(roundTrip({ asset: photo, entry })).toEqual({
      path: '/blog/hello/images/photo.jpg',
      found: photo,
    });
    expect(roundTrip({ asset: nestedPhoto, entry })).toEqual({
      path: '/blog/hello/images/sub/nested.jpg',
      found: nestedPhoto,
    });
  });

  test('should find the same asset for an entry stored as a file', () => {
    const photo = createAsset('content/posts/images/photo.jpg');

    const besideEntry = createAsset('content/posts/beside.jpg', {
      ...folder,
      internalSubPath: undefined,
      publicPath: '/media',
    });

    vi.mocked(getCollection).mockReturnValue(flatCollection);
    allAssets.current = [photo, besideEntry];

    expect(roundTrip({ asset: photo, entry: flatEntry })).toEqual({
      path: '/blog/hello/images/photo.jpg',
      found: photo,
    });
    expect(roundTrip({ asset: besideEntry, entry: flatEntry })).toEqual({
      path: '/media/beside.jpg',
      found: besideEntry,
    });
  });

  test('should find the same asset in each locale folder', () => {
    const enPhoto = createAsset('content/posts/en/hello/images/photo.jpg');
    const frPhoto = createAsset('content/posts/fr/hello/images/photo.jpg');

    allAssets.current = [enPhoto, frPhoto];

    expect(roundTrip({ asset: enPhoto, entry: i18nEntry, locale: 'en' })).toEqual({
      path: '/blog/hello/images/photo.jpg',
      found: enPhoto,
    });
    expect(roundTrip({ asset: frPhoto, entry: i18nEntry, locale: 'fr' })).toEqual({
      path: '/blog/hello/images/photo.jpg',
      found: frPhoto,
    });
  });

  test('should find the same asset with the root public path', () => {
    const rootFolder = /** @type {AssetFolderInfo} */ ({ ...folder, publicPath: '/' });
    const photo = createAsset('content/posts/hello/images/photo.jpg', rootFolder);
    const nestedPhoto = createAsset('content/posts/hello/images/sub/nested.jpg', rootFolder);

    allAssets.current = [photo, nestedPhoto];

    expect(roundTrip({ asset: photo, entry })).toEqual({ path: '/photo.jpg', found: photo });
    expect(roundTrip({ asset: nestedPhoto, entry })).toEqual({
      path: '/sub/nested.jpg',
      found: nestedPhoto,
    });
  });
});
