import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * @import { Asset, AssetFolderInfo } from '$lib/types/private';
 */

const {
  mockGetAssetByPath,
  mockGetAssetFoldersByPath,
  mockGetAssetBlob,
  mockGetOwnedEntryFolderPath,
  mockGetField,
  mockGetTypedKeyPath,
  mockGetAssetLibraryFolderMap,
  mockGetDefaultAssetFolder,
} = vi.hoisted(() => ({
  mockGetAssetByPath: vi.fn(),
  mockGetAssetFoldersByPath: vi.fn(),
  mockGetAssetBlob: vi.fn(),
  mockGetOwnedEntryFolderPath: vi.fn(),
  mockGetField: vi.fn(),
  mockGetTypedKeyPath: vi.fn(),
  mockGetAssetLibraryFolderMap: vi.fn(),
  mockGetDefaultAssetFolder: vi.fn(),
}));

vi.mock('$lib/services/assets', () => ({
  getAssetByPath: mockGetAssetByPath,
}));

vi.mock('$lib/services/assets/folders', () => ({
  getAssetFoldersByPath: mockGetAssetFoldersByPath,
}));

vi.mock('$lib/services/assets/info', () => ({
  getAssetBlob: mockGetAssetBlob,
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  MARKDOWN_IMAGE_REGEX: /!\[.*?\]\((.+?)(?:\s+".*?")?\)/g,
}));

vi.mock('$lib/services/contents/draft/save/assets', () => ({
  getOwnedEntryFolderPath: mockGetOwnedEntryFolderPath,
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: mockGetField,
  getTypedKeyPath: mockGetTypedKeyPath,
}));

vi.mock('$lib/services/contents/fields', () => ({
  MEDIA_FIELD_TYPES: ['file', 'image'],
}));

vi.mock('$lib/services/contents/fields/file/helpers', () => ({
  getAssetLibraryFolderMap: mockGetAssetLibraryFolderMap,
  getDefaultAssetFolder: mockGetDefaultAssetFolder,
}));

const { copyEntryRelativeAssets } = await import('./duplicate-assets');

/** @type {AssetFolderInfo} */
const entryFolder = {
  collectionName: 'posts',
  internalPath: 'content/posts',
  internalSubPath: '',
  publicPath: '',
  entryRelative: true,
  hasTemplateTags: false,
};

/** @type {AssetFolderInfo} */
const globalFolder = {
  collectionName: undefined,
  internalPath: 'static/uploads',
  publicPath: '/uploads',
  entryRelative: false,
  hasTemplateTags: false,
};

/**
 * Create a saved asset.
 * @param {string} path Asset path.
 * @returns {Asset} Asset.
 */
const createAsset = (path) =>
  /** @type {Asset} */ ({
    path,
    name: path.split('/').pop(),
    sha: path,
    size: 5,
    kind: 'image',
    folder: entryFolder,
  });

const entry = {
  id: 'post-1',
  slug: 'hello',
  locales: {
    en: { path: 'content/posts/hello/index.md', slug: 'hello', content: {} },
    ja: { path: 'content/posts/hello/index.ja.md', slug: 'hello', content: {} },
  },
};

/** @type {any} */
let draft;
/** @type {any} */
let currentValues;
let blobURLCount = 0;

/**
 * Get the created blob URLs, in the order of creation.
 * @returns {string[]} Blob URLs.
 */
const getCreatedBlobURLs = () =>
  vi.mocked(URL.createObjectURL).mock.results.map(({ value }) => value);

beforeEach(() => {
  blobURLCount = 0;

  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    blobURLCount += 1;

    return `blob:${blobURLCount}`;
  });

  draft = {
    originalEntry: entry,
    collection: { name: 'posts', _type: 'entry' },
    collectionName: 'posts',
    fileName: undefined,
    isIndexFile: false,
    defaultLocale: 'en',
  };

  currentValues = {
    en: { title: 'Hello', image: 'photo.jpg', body: 'Text' },
    ja: { title: 'こんにちは', image: 'photo.jpg', body: 'テキスト' },
  };

  mockGetOwnedEntryFolderPath.mockReturnValue('content/posts/hello');

  mockGetField.mockImplementation(({ keyPath }) => {
    if (keyPath.endsWith('image') || keyPath.startsWith('images.')) {
      return { name: 'image', widget: 'image' };
    }

    if (keyPath === 'attachment') {
      return { name: 'attachment', widget: 'file' };
    }

    if (keyPath === 'body') {
      return { name: 'body', widget: 'markdown' };
    }

    if (keyPath === 'title') {
      return { name: 'title', widget: 'string' };
    }

    return undefined;
  });

  mockGetTypedKeyPath.mockImplementation(({ keyPath }) => keyPath.replace(/\.\d+/g, '.*'));
  mockGetAssetLibraryFolderMap.mockReturnValue({});
  mockGetDefaultAssetFolder.mockReturnValue(entryFolder);

  mockGetAssetByPath.mockImplementation(({ value }) => {
    const path = `content/posts/hello/${value.replace(/^\.\//, '')}`;

    return value.startsWith('/') || value.startsWith('http') ? undefined : createAsset(path);
  });

  mockGetAssetFoldersByPath.mockReturnValue([entryFolder]);

  mockGetAssetBlob.mockImplementation(
    async (/** @type {Asset} */ { name }) => new Blob([name], { type: 'image/jpeg' }),
  );
});

describe('copyEntryRelativeAssets()', () => {
  test('copies an image referenced from the entry and replaces the value with a blob URL', async () => {
    const files = await copyEntryRelativeAssets({ draft, currentValues });
    const [blobURL] = getCreatedBlobURLs();

    expect(blobURL).toBe('blob:1');
    expect(Object.keys(files)).toEqual([blobURL]);

    const { file, folder, replace } = files[blobURL];

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('photo.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(await file.text()).toBe('photo.jpg');
    expect(folder).toBe(entryFolder);
    expect(replace).toBe(false);

    // The asset is referenced from both locales but copied once
    expect(mockGetAssetBlob).toHaveBeenCalledTimes(1);
    expect(currentValues.en.image).toBe(blobURL);
    expect(currentValues.ja.image).toBe(blobURL);
    // Other values are untouched
    expect(currentValues.en.title).toBe('Hello');
    expect(currentValues.en.body).toBe('Text');
  });

  test('looks the asset up with the field’s typed key path', async () => {
    currentValues = { en: { 'images.0.src': 'a.jpg' } };

    mockGetField.mockReturnValue({ name: 'src', widget: 'image' });
    mockGetTypedKeyPath.mockReturnValue('images.*.src');

    await copyEntryRelativeAssets({ draft, currentValues });

    expect(mockGetTypedKeyPath).toHaveBeenCalledWith({
      collectionName: 'posts',
      fileName: undefined,
      valueMap: currentValues.en,
      keyPath: 'images.0.src',
      isIndexFile: false,
    });
    expect(mockGetAssetLibraryFolderMap).toHaveBeenCalledWith({
      collectionName: 'posts',
      fileName: undefined,
      typedKeyPath: 'images.*.src',
      isIndexFile: false,
    });
    expect(mockGetAssetByPath).toHaveBeenCalledWith({
      value: 'a.jpg',
      entry,
      collectionName: 'posts',
      fileName: undefined,
      typedKeyPath: 'images.*.src',
    });
  });

  test('copies the images embedded in a Markdown body', async () => {
    currentValues = {
      en: {
        body: [
          'Intro',
          '![First](./one.png)',
          '![Second](two.png "Title")',
          '![First again](./one.png)',
          '![Remote](https://example.com/three.png)',
        ].join('\n\n'),
      },
    };

    const files = await copyEntryRelativeAssets({ draft, currentValues });
    const blobURLs = getCreatedBlobURLs();

    expect(blobURLs).toHaveLength(2);
    expect(Object.keys(files)).toEqual(blobURLs);
    expect(files[blobURLs[0]].file.name).toBe('one.png');
    expect(files[blobURLs[1]].file.name).toBe('two.png');
    expect(currentValues.en.body).toBe(
      [
        'Intro',
        `![First](${blobURLs[0]})`,
        `![Second](${blobURLs[1]} "Title")`,
        `![First again](${blobURLs[0]})`,
        '![Remote](https://example.com/three.png)',
      ].join('\n\n'),
    );
  });

  test('copies a file referenced from a File field', async () => {
    currentValues = { en: { attachment: 'doc.pdf' } };

    mockGetAssetBlob.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));

    const files = await copyEntryRelativeAssets({ draft, currentValues });
    const [blobURL] = getCreatedBlobURLs();

    expect(files[blobURL].file.name).toBe('doc.pdf');
    expect(files[blobURL].file.type).toBe('application/pdf');
    expect(currentValues.en.attachment).toBe(blobURL);
  });

  test('does nothing for a new entry', async () => {
    draft.originalEntry = undefined;

    await expect(copyEntryRelativeAssets({ draft, currentValues })).resolves.toEqual({});
    expect(mockGetField).not.toHaveBeenCalled();
    expect(currentValues.en.image).toBe('photo.jpg');
  });

  test('falls back to any locale to find the entry file path', async () => {
    draft.defaultLocale = 'fr';

    await copyEntryRelativeAssets({ draft, currentValues });

    expect(mockGetOwnedEntryFolderPath).toHaveBeenCalledWith(
      draft.collection,
      'content/posts/hello/index.md',
    );
    expect(currentValues.en.image).toBe('blob:1');
  });

  test('leaves assets in a folder shared with the collection alone', async () => {
    // The entry is a file next to its assets, e.g. `content/posts/hello.md`
    mockGetOwnedEntryFolderPath.mockReturnValue(undefined);

    await expect(copyEntryRelativeAssets({ draft, currentValues })).resolves.toEqual({});
    expect(mockGetAssetByPath).not.toHaveBeenCalled();
    expect(currentValues.en.image).toBe('photo.jpg');
  });

  test('copies assets in a folder named after the entry with a template tag', async () => {
    // Hexo’s Post Asset Folder convention: `media_folder: '{{slug}}'`
    mockGetOwnedEntryFolderPath.mockReturnValue(undefined);
    mockGetDefaultAssetFolder.mockReturnValue({
      ...entryFolder,
      internalSubPath: '{{slug}}',
      hasTemplateTags: true,
    });

    const files = await copyEntryRelativeAssets({ draft, currentValues });

    expect(Object.keys(files)).toEqual(['blob:1']);
    expect(currentValues.en.image).toBe('blob:1');
  });

  test('leaves assets in a folder that is not entry-relative alone', async () => {
    mockGetDefaultAssetFolder.mockReturnValue(globalFolder);

    await expect(copyEntryRelativeAssets({ draft, currentValues })).resolves.toEqual({});
    expect(mockGetAssetByPath).not.toHaveBeenCalled();
    expect(currentValues.en.image).toBe('photo.jpg');
  });

  test('leaves a value that does not resolve to an asset alone', async () => {
    currentValues = { en: { image: 'https://example.com/photo.jpg' } };

    await expect(copyEntryRelativeAssets({ draft, currentValues })).resolves.toEqual({});
    expect(mockGetAssetBlob).not.toHaveBeenCalled();
    expect(currentValues.en.image).toBe('https://example.com/photo.jpg');
  });

  test('leaves an asset stored outside the entry’s own folders alone', async () => {
    // The value resolves to an asset in the global folder, picked from the asset library
    mockGetAssetFoldersByPath.mockReturnValue([globalFolder]);

    await expect(copyEntryRelativeAssets({ draft, currentValues })).resolves.toEqual({});
    expect(mockGetAssetBlob).not.toHaveBeenCalled();
    expect(currentValues.en.image).toBe('photo.jpg');
  });

  test('leaves an asset that belongs to another collection alone', async () => {
    mockGetAssetFoldersByPath.mockReturnValue([{ ...entryFolder, collectionName: 'pages' }]);

    await expect(copyEntryRelativeAssets({ draft, currentValues })).resolves.toEqual({});
    expect(mockGetAssetBlob).not.toHaveBeenCalled();
  });

  test('matches the collection file of a file collection', async () => {
    draft.fileName = 'about';
    mockGetAssetFoldersByPath.mockReturnValue([{ ...entryFolder, fileName: 'about' }]);

    await copyEntryRelativeAssets({ draft, currentValues });

    expect(mockGetAssetByPath).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'about' }));
    expect(currentValues.en.image).toBe('blob:1');
  });

  test('leaves the reference as is if the asset cannot be downloaded', async () => {
    mockGetAssetBlob.mockRejectedValue(new Error('Failed to retrieve blob'));

    await expect(copyEntryRelativeAssets({ draft, currentValues })).resolves.toEqual({});
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(currentValues.en.image).toBe('photo.jpg');
    expect(currentValues.ja.image).toBe('photo.jpg');
  });

  test('skips values that are not strings or empty', async () => {
    currentValues = { en: { image: '', images: ['a.jpg'], count: 1, flag: true, none: null } };

    await expect(copyEntryRelativeAssets({ draft, currentValues })).resolves.toEqual({});
    expect(mockGetField).not.toHaveBeenCalled();
  });

  test('skips fields that cannot reference an asset', async () => {
    currentValues = { en: { title: 'photo.jpg', unknown: 'photo.jpg' } };

    await expect(copyEntryRelativeAssets({ draft, currentValues })).resolves.toEqual({});
    expect(mockGetTypedKeyPath).not.toHaveBeenCalled();
    expect(currentValues.en.title).toBe('photo.jpg');
    expect(currentValues.en.unknown).toBe('photo.jpg');
  });
});
