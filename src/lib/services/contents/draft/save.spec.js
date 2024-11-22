import { describe, expect, test } from 'vitest';
import { getEntryAssetFolderPaths } from '$lib/services/contents/draft/save';

describe('Test getEntryAssetFolderPaths()', () => {
  const currentSlug = 'foo';

  const collectionBase = {
    _type: /** @type {CollectionType} */ ('entry'),
    name: 'blog',
    folder: 'src/content/blog',
  };

  const i18nBaseConfig = {
    i18nEnabled: true,
    locales: ['en'],
    defaultLocale: 'en',
    canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
  };

  /** @type {I18nConfig} */
  const i18nMultiFolder = { ...i18nBaseConfig, structure: 'multiple_folders' };
  /** @type {I18nConfig} */
  const i18nMultiFile = { ...i18nBaseConfig, structure: 'multiple_files' };
  /** @type {I18nConfig} */
  const i18nSingleFile = { ...i18nBaseConfig, structure: 'single_file' };

  const _file = {
    extension: 'md',
    format: /** @type {FileFormat} */ ('yaml-frontmatter'),
    basePath: 'src/content/blog',
  };

  const relativeAssetFolder = {
    entryRelative: true,
    internalPath: 'src/content/blog',
    publicPath: '',
  };

  const absoluteAssetFolder = {
    entryRelative: false,
    internalPath: 'static/uploads/blog',
    publicPath: '/uploads/blog',
  };

  test('simple path, multiple folders, entry relative', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFolder,
      _assetFolder: relativeAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'src/content/blog',
      internalAssetFolder: 'src/content/blog/foo',
      publicAssetFolder: '../foo',
    });
  });

  test('nested path, multiple folders, entry relative', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nMultiFolder,
      _assetFolder: relativeAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'src/content/blog',
      internalAssetFolder: 'src/content/blog/foo',
      publicAssetFolder: '../../foo',
    });
  });

  test('simple path, multiple files, entry relative', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFile,
      _assetFolder: relativeAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'src/content/blog',
      internalAssetFolder: 'src/content/blog',
      publicAssetFolder: '',
    });
  });

  test('nested path, multiple files, entry relative', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nMultiFile,
      _assetFolder: relativeAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'src/content/blog',
      internalAssetFolder: 'src/content/blog/foo',
      publicAssetFolder: '',
    });
  });

  test('simple path, single file, entry relative', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nSingleFile,
      _assetFolder: relativeAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'src/content/blog',
      internalAssetFolder: 'src/content/blog',
      publicAssetFolder: '',
    });
  });

  test('nested path, single file, entry relative', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nSingleFile,
      _assetFolder: relativeAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'src/content/blog',
      internalAssetFolder: 'src/content/blog/foo',
      publicAssetFolder: '',
    });
  });

  test('simple path, multiple folders, entry absolute', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFolder,
      _assetFolder: absoluteAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'static/uploads/blog',
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('nested path, multiple folders, entry absolute', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nMultiFolder,
      _assetFolder: absoluteAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'static/uploads/blog',
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('simple path, multiple files, entry absolute', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFile,
      _assetFolder: absoluteAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'static/uploads/blog',
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('nested path, multiple files, entry absolute', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nMultiFile,
      _assetFolder: absoluteAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'static/uploads/blog',
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('simple path, single file, entry absolute', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nSingleFile,
      _assetFolder: absoluteAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'static/uploads/blog',
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('nested path, single file, entry absolute', () => {
    /** @type {Collection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nSingleFile,
      _assetFolder: absoluteAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'static/uploads/blog',
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });
});
