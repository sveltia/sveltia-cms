import { describe, expect, test, vi } from 'vitest';

import { resolveAssetFolderPaths } from '$lib/services/contents/draft/save/assets';

vi.mock('$lib/services/assets');

/**
 * @import {
 * AssetFolderInfo,
 * InternalCollection,
 * InternalI18nOptions,
 * } from '$lib/types/private';
 * @import { FileFormat } from '$lib/types/public';
 */

describe('Test resolveAssetFolderPaths()', () => {
  const currentSlug = 'foo';

  const collectionBase = {
    name: 'blog',
    folder: 'src/content/blog',
    fields: [],
    _type: /** @type {'entry'} */ ('entry'),
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
  const i18nMultiFolder = {
    ...i18nBaseConfig,
    structure: 'multiple_folders',
    structureMap: {
      i18nSingleFile: false,
      i18nMultiFile: false,
      i18nMultiFolder: true,
      i18nRootMultiFolder: false,
    },
  };

  /** @type {InternalI18nOptions} */
  const i18nRootMultiFolder = {
    ...i18nBaseConfig,
    structure: 'multiple_folders_i18n_root',
    structureMap: {
      i18nSingleFile: false,
      i18nMultiFile: false,
      i18nMultiFolder: false,
      i18nRootMultiFolder: true,
    },
  };

  /** @type {InternalI18nOptions} */
  const i18nMultiFile = {
    ...i18nBaseConfig,
    structure: 'multiple_files',
    structureMap: {
      i18nSingleFile: false,
      i18nMultiFile: true,
      i18nMultiFolder: false,
      i18nRootMultiFolder: false,
    },
  };

  /** @type {InternalI18nOptions} */
  const i18nSingleFile = {
    ...i18nBaseConfig,
    structure: 'single_file',
    structureMap: {
      i18nSingleFile: true,
      i18nMultiFile: false,
      i18nMultiFolder: false,
      i18nRootMultiFolder: false,
    },
  };

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

  test('collection with media_folder, multiple folders, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      media_folder: 'images',
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
      resolvedInternalPath: 'src/content/blog/foo/images',
      resolvedPublicPath: '../foo',
    });
  });

  test('collection with media_folder, nested path, multiple folders, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      media_folder: 'assets/media',
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
      resolvedInternalPath: 'src/content/blog/foo/assets/media',
      resolvedPublicPath: '../../foo',
    });
  });

  test('collection with media_folder, multiple files, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      media_folder: 'uploads',
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
      resolvedInternalPath: 'src/content/blog/uploads',
      resolvedPublicPath: '',
    });
  });

  test('collection with media_folder, nested path, multiple files, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      media_folder: 'media/files',
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
      resolvedInternalPath: 'src/content/blog/foo/media/files',
      resolvedPublicPath: '',
    });
  });

  test('collection with media_folder, single file, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      media_folder: 'static',
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
      resolvedInternalPath: 'src/content/blog/static',
      resolvedPublicPath: '',
    });
  });

  test('collection with empty media_folder, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      media_folder: '',
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

  test('collection with undefined media_folder, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      media_folder: undefined,
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
});
