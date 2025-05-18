import { describe, expect, test, vi } from 'vitest';
import { copyProperty, resolveAssetFolderPaths } from '$lib/services/contents/draft/save';

vi.mock('$lib/services/assets');

/**
 * @import {
 * AssetFolderInfo,
 * CollectionType,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalI18nOptions,
 * } from '$lib/types/private';
 * @import { Field, FileFormat } from '$lib/types/public';
 */

describe('Test resolveAssetFolderPaths()', () => {
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
    omitDefaultLocaleFromFileName: false,
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
    collectionName: 'blog',
    entryRelative: true,
    hasTemplateTags: false,
    internalPath: 'src/content/blog',
    publicPath: '',
  };

  const absoluteAssetFolder = {
    collectionName: 'blog',
    entryRelative: false,
    hasTemplateTags: false,
    internalPath: 'static/uploads/blog',
    publicPath: '/uploads/blog',
  };

  const templateTagAssetFolder = {
    collectionName: 'blog',
    entryRelative: false,
    hasTemplateTags: true,
    internalPath: 'static/uploads/blog/{{slug}}',
    publicPath: '/uploads/blog/{{slug}}',
  };

  /**
   * Mock `getAssetFolder()`.
   * @param {AssetFolderInfo} folder Asset folder info.
   */
  const setupAssetFolder = async (folder) => {
    // @ts-ignore
    // eslint-disable-next-line jsdoc/require-jsdoc
    (await import('$lib/services/assets')).getAssetFolder = () => folder;
  };

  test('simple path, multiple folders, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFolder,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo',
      resolvedPublicPath: '../foo',
    });
  });

  test('nested path, multiple folders, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nMultiFolder,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo',
      resolvedPublicPath: '../../foo',
    });
  });

  test('simple path, multiple folders at root, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nRootMultiFolder,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo',
      resolvedPublicPath: '../foo',
    });
  });

  test('nested path, multiple folders at root, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nRootMultiFolder,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo',
      resolvedPublicPath: '../../foo',
    });
  });

  test('simple path, multiple files, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFile,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog',
      resolvedPublicPath: '',
    });
  });

  test('nested path, multiple files, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nMultiFile,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo',
      resolvedPublicPath: '',
    });
  });

  test('simple path, single file, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nSingleFile,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog',
      resolvedPublicPath: '',
    });
  });

  test('nested path, single file, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nSingleFile,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo',
      resolvedPublicPath: '',
    });
  });

  test('simple path, multiple folders, entry absolute', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFolder,
    };

    await setupAssetFolder(absoluteAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: absoluteAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'static/uploads/blog',
      resolvedPublicPath: '/uploads/blog',
    });
  });

  test('nested path, multiple folders, entry absolute', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nMultiFolder,
    };

    await setupAssetFolder(absoluteAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: absoluteAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'static/uploads/blog',
      resolvedPublicPath: '/uploads/blog',
    });
  });

  test('simple path, multiple folders at root, entry absolute', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nRootMultiFolder,
    };

    await setupAssetFolder(absoluteAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: absoluteAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'static/uploads/blog',
      resolvedPublicPath: '/uploads/blog',
    });
  });

  test('nested path, multiple folders at root, entry absolute', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nRootMultiFolder,
    };

    await setupAssetFolder(absoluteAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: absoluteAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'static/uploads/blog',
      resolvedPublicPath: '/uploads/blog',
    });
  });

  test('simple path, multiple files, entry absolute', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFile,
    };

    await setupAssetFolder(absoluteAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: absoluteAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'static/uploads/blog',
      resolvedPublicPath: '/uploads/blog',
    });
  });

  test('nested path, multiple files, entry absolute', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nMultiFile,
    };

    await setupAssetFolder(absoluteAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: absoluteAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'static/uploads/blog',
      resolvedPublicPath: '/uploads/blog',
    });
  });

  test('simple path, single file, entry absolute', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nSingleFile,
    };

    await setupAssetFolder(absoluteAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: absoluteAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'static/uploads/blog',
      resolvedPublicPath: '/uploads/blog',
    });
  });

  test('nested path, single file, entry absolute', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nSingleFile,
    };

    await setupAssetFolder(absoluteAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: absoluteAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'static/uploads/blog',
      resolvedPublicPath: '/uploads/blog',
    });
  });

  test('asset folder with template tags', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: undefined },
      _i18n: i18nSingleFile,
    };

    await setupAssetFolder(templateTagAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: templateTagAssetFolder,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: 'static/uploads/blog/foo',
      resolvedPublicPath: '/uploads/blog/foo',
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
