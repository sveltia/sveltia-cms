import { describe, expect, test } from 'vitest';
import { copyProperty, getEntryAssetFolderPaths } from '$lib/services/contents/draft/save';

/**
 * @import {
 * CollectionType,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalI18nOptions,
 * } from '$lib/types/private';
 * @import { Field, FileFormat } from '$lib/types/public';
 */

describe('Test getEntryAssetFolderPaths()', () => {
  const currentSlug = 'foo';

  const collectionBase = {
    name: 'blog',
    folder: 'src/content/blog',
    _type: /** @type {CollectionType} */ ('entry'),
    _thumbnailFieldNames: [],
  };

  const i18nBaseConfig = {
    i18nEnabled: true,
    allLocales: ['en'],
    initialLocales: ['en'],
    defaultLocale: 'en',
    canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
  };

  /** @type {InternalI18nOptions} */
  const i18nMultiFolder = { ...i18nBaseConfig, structure: 'multiple_folders' };
  /** @type {InternalI18nOptions} */
  const i18nRootMultiFolder = { ...i18nBaseConfig, structure: 'multiple_folders_i18n_root' };
  /** @type {InternalI18nOptions} */
  const i18nMultiFile = { ...i18nBaseConfig, structure: 'multiple_files' };
  /** @type {InternalI18nOptions} */
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
    /** @type {InternalCollection} */
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
    /** @type {InternalCollection} */
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

  test('simple path, multiple folders at root, entry relative', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nRootMultiFolder,
      _assetFolder: relativeAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'src/content/blog',
      internalAssetFolder: 'src/content/blog/foo',
      publicAssetFolder: '../foo',
    });
  });

  test('nested path, multiple folders at root, entry relative', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nRootMultiFolder,
      _assetFolder: relativeAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'src/content/blog',
      internalAssetFolder: 'src/content/blog/foo',
      publicAssetFolder: '../../foo',
    });
  });

  test('simple path, multiple files, entry relative', () => {
    /** @type {InternalCollection} */
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
    /** @type {InternalCollection} */
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
    /** @type {InternalCollection} */
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
    /** @type {InternalCollection} */
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
    /** @type {InternalCollection} */
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
    /** @type {InternalCollection} */
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

  test('simple path, multiple folders at root, entry absolute', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nRootMultiFolder,
      _assetFolder: absoluteAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'static/uploads/blog',
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('nested path, multiple folders at root, entry absolute', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nRootMultiFolder,
      _assetFolder: absoluteAssetFolder,
    };

    expect(getEntryAssetFolderPaths({ collection, content: {}, currentSlug })).toEqual({
      internalBaseAssetFolder: 'static/uploads/blog',
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('simple path, multiple files, entry absolute', () => {
    /** @type {InternalCollection} */
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
    /** @type {InternalCollection} */
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
    /** @type {InternalCollection} */
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
    /** @type {InternalCollection} */
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

describe('Test copyProperty()', () => {
  /** @type {Field[]} */
  const fields = [
    { name: 'title', widget: 'string', required: true },
    { name: 'description', widget: 'string', required: false },
    { name: 'image', widget: 'image', required: false },
    { name: 'hidden', widget: 'boolean', required: false },
    { name: 'threshold', widget: 'number', required: false },
    { name: 'organizers', widget: 'list', required: false },
    { name: 'program', widget: 'object', required: false },
    { name: 'address', widget: 'object', required: false },
    { name: 'variables', widget: 'keyvalue', required: false },
  ];

  /** @type {FlattenedEntryContent} */
  const content = {
    title: 'My Post',
    description: '',
    image: '',
    hidden: false,
    threshold: null,
    organizers: [],
    program: null,
    address: {},
    variables: {},
  };

  /**
   * Wrapper for {@link copyProperty}.
   * @param {boolean} [omitEmptyOptionalFields] The omit option.
   * @returns {FlattenedEntryContent} Copied content. Note: It’s not sorted here because sorting is
   * done in `finalizeContent`.
   */
  const copy = (omitEmptyOptionalFields = false) => {
    /** @type {FlattenedEntryContent} */
    const sortedMap = {};

    /** @type {FlattenedEntryContent} */
    const unsortedMap = {
      ...structuredClone(content),
      'variables.foo': 'foo',
      'variables.bar': 'bar',
    };

    const args = {
      locale: 'en',
      unsortedMap,
      sortedMap,
      isTomlOutput: false,
      omitEmptyOptionalFields,
    };

    fields.forEach((field) => {
      copyProperty({ ...args, key: field.name, field });
    });

    return sortedMap;
  };

  test('omit option unspecified', () => {
    expect(copy()).toEqual(content);
  });

  test('omit option disabled', () => {
    expect(copy(false)).toEqual(content);
  });

  test('omit option enabled', () => {
    // Here `variables.X` are not included but that’s fine; it’s done is `finalizeContent`
    expect(copy(true)).toEqual({ title: 'My Post', variables: {} });
  });
});
