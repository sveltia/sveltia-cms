import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getAssetSavingInfo,
  replaceBlobURL,
  resolveAssetFolderPaths,
} from '$lib/services/contents/draft/save/assets';

vi.mock('$lib/services/assets', () => ({
  getAssetsByDirName: vi.fn(() => []),
  getAssetFolder: vi.fn(() => ({})),
}));
vi.mock('$lib/services/utils/file', () => ({
  getGitHash: vi.fn(),
  formatFileName: vi.fn((name) => name.toLowerCase()),
  encodeFilePath: vi.fn((path) => encodeURIComponent(path)),
  createPath: vi.fn((parts) => parts.filter(Boolean).join('/')),
  resolvePath: vi.fn((path) => path),
}));
vi.mock('$lib/services/contents/draft/slugs', () => ({
  getFillSlugOptions: vi.fn(() => ({ content: {}, collection: {} })),
}));
vi.mock('$lib/services/contents/draft/save/entry-path', () => ({
  createEntryPath: vi.fn(() => 'path/to/entry'),
}));
vi.mock('$lib/services/assets/kinds', () => ({
  getAssetKind: vi.fn(() => 'image'),
}));

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
    omitDefaultLocaleFromFilePath: false,
    omitDefaultLocaleFromPreviewPath: false,
  };

  /** @type {InternalI18nOptions} */
  const i18nMultiFolder = {
    ...i18nBaseConfig,
    structure: 'multiple_folders',
    structureMap: {
      i18nSingleFile: false,
      i18nMultiFile: false,
      i18nMultiFolder: true,
      i18nMultiRootFolder: false,
    },
  };

  /** @type {InternalI18nOptions} */
  const i18nMultiRootFolder = {
    ...i18nBaseConfig,
    structure: 'multiple_folders_i18n_root',
    structureMap: {
      i18nSingleFile: false,
      i18nMultiFile: false,
      i18nMultiFolder: false,
      i18nMultiRootFolder: true,
    },
  };

  /** @type {InternalI18nOptions} */
  const i18nRootMultiFolders = {
    ...i18nBaseConfig,
    structure: 'multiple_root_folders',
    structureMap: {
      i18nSingleFile: false,
      i18nMultiFile: false,
      i18nMultiFolder: false,
      i18nMultiRootFolder: true,
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
      i18nMultiRootFolder: false,
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
      i18nMultiRootFolder: false,
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
    internalSubPath: 'images',
    publicPath: '',
  };

  const absoluteAssetFolder = {
    collectionName: 'blog',
    entryRelative: false,
    hasTemplateTags: false,
    internalPath: 'static/uploads/blog',
    internalSubPath: undefined,
    publicPath: '/uploads/blog',
  };

  const templateTagAssetFolder = {
    collectionName: 'blog',
    entryRelative: false,
    hasTemplateTags: true,
    internalPath: 'static/uploads/blog/{{slug}}',
    internalSubPath: undefined,
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
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo/images',
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
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo/index.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo/images',
      resolvedPublicPath: '../../foo',
    });
  });

  test('simple path, multiple folders at root, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiRootFolder,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo/images',
      resolvedPublicPath: '../foo',
    });
  });

  test('simple path, multiple root folders (new), entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nRootMultiFolders,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo/images',
      resolvedPublicPath: '../foo',
    });
  });

  test('nested path, multiple folders at root, entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nMultiRootFolder,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo/index.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo/images',
      resolvedPublicPath: '../../foo',
    });
  });

  test('nested path, multiple root folders (new), entry relative', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nRootMultiFolders,
    };

    await setupAssetFolder(relativeAssetFolder);

    expect(
      resolveAssetFolderPaths({
        folder: relativeAssetFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo/index.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo/images',
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
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/images',
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
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo/index.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo/images',
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
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/images',
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
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo/index.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo/images',
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
      _i18n: i18nMultiRootFolder,
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

  test('simple path, multiple root folders (new), entry absolute', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nRootMultiFolders,
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
      _i18n: i18nMultiRootFolder,
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

  test('nested path, multiple root folders (new), entry absolute', async () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nRootMultiFolders,
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
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
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

    const folder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: 'assets/media',
      publicPath: '',
    };

    await setupAssetFolder(folder);

    expect(
      resolveAssetFolderPaths({
        folder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo/index.md',
        },
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

    const folder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: 'uploads',
      publicPath: '',
    };

    await setupAssetFolder(folder);

    expect(
      resolveAssetFolderPaths({
        folder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
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

    const folder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: 'media/files',
      publicPath: '',
    };

    await setupAssetFolder(folder);

    expect(
      resolveAssetFolderPaths({
        folder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo/index.md',
        },
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

    const folder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: 'static',
      publicPath: '',
    };

    await setupAssetFolder(folder);

    expect(
      resolveAssetFolderPaths({
        folder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
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

    const folder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: '',
      publicPath: '',
    };

    await setupAssetFolder(folder);

    expect(
      resolveAssetFolderPaths({
        folder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
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

    const folder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: undefined,
      publicPath: '',
    };

    await setupAssetFolder(folder);

    expect(
      resolveAssetFolderPaths({
        folder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog',
      resolvedPublicPath: '',
    });
  });

  test('handles undefined internal path', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file,
      _i18n: i18nMultiFile,
    };

    /** @type {AssetFolderInfo} */
    const folderWithUndefinedInternalPath = {
      collectionName: 'blog',
      entryRelative: false,
      hasTemplateTags: false,
      internalPath: undefined,
      internalSubPath: undefined,
      publicPath: '/uploads',
    };

    expect(
      resolveAssetFolderPaths({
        folder: folderWithUndefinedInternalPath,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: '',
      resolvedPublicPath: '',
    });
  });

  test('handles undefined public path', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file,
      _i18n: i18nMultiFile,
    };

    /** @type {AssetFolderInfo} */
    const folderWithUndefinedPublicPath = {
      collectionName: 'blog',
      entryRelative: false,
      hasTemplateTags: false,
      internalPath: 'static/uploads',
      internalSubPath: undefined,
      publicPath: undefined,
    };

    expect(
      resolveAssetFolderPaths({
        folder: folderWithUndefinedPublicPath,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: '',
      resolvedPublicPath: '',
    });
  });

  test('handles both internal and public paths undefined', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file,
      _i18n: i18nMultiFile,
    };

    /** @type {AssetFolderInfo} */
    const folderWithBothUndefined = {
      collectionName: 'blog',
      entryRelative: false,
      hasTemplateTags: false,
      internalPath: undefined,
      internalSubPath: undefined,
      publicPath: undefined,
    };

    expect(
      resolveAssetFolderPaths({
        folder: folderWithBothUndefined,
        fillSlugOptions: { collection, content: {}, currentSlug },
      }),
    ).toEqual({
      resolvedInternalPath: '',
      resolvedPublicPath: '',
    });
  });

  test('entry relative with non-multi-folders and empty public path', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFile,
    };

    const entryRelativeFolder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: undefined,
      publicPath: '',
    };

    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog',
      resolvedPublicPath: '',
    });
  });

  test('entry relative with non-multi-folders and dot public path', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFile,
    };

    const entryRelativeFolder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: undefined,
      publicPath: '.',
    };

    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog',
      resolvedPublicPath: '.',
    });
  });

  test('entry relative with non-multi-folders and regular public path', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nMultiFile,
    };

    const entryRelativeFolder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: undefined,
      publicPath: '/images',
    };

    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog',
      resolvedPublicPath: '/images',
    });
  });

  test('entry relative with nested path, non-multi-folders and regular public path', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}/index' },
      _i18n: i18nMultiFile,
    };

    const entryRelativeFolder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: undefined,
      publicPath: '/images',
    };

    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo/index.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog/foo',
      resolvedPublicPath: '/images',
    });
  });

  test('entry relative with single file i18n and empty public path', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nSingleFile,
    };

    const entryRelativeFolder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: undefined,
      publicPath: '',
    };

    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog',
      resolvedPublicPath: '',
    });
  });

  test('entry relative with single file i18n and dot public path', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nSingleFile,
    };

    const entryRelativeFolder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: undefined,
      publicPath: '.',
    };

    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog',
      resolvedPublicPath: '.',
    });
  });

  test('entry relative with single file i18n and root public path', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nSingleFile,
    };

    const entryRelativeFolder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: undefined,
      publicPath: '.',
    };

    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog',
      resolvedPublicPath: '.',
    });
  });

  test('entry relative with single file i18n and root public path', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{slug}}' },
      _i18n: i18nSingleFile,
    };

    const entryRelativeFolder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: undefined,
      publicPath: '/',
    };

    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug,
          entryFilePath: 'src/content/blog/foo.md',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'src/content/blog',
      resolvedPublicPath: '/',
    });
  });

  test('file collection type with entry relative and regular public path', () => {
    /** @type {any} */
    const fileCollection = {
      name: 'settings',
      files: [],
      _type: 'file',
      _i18n: i18nSingleFile,
      _thumbnailFieldNames: [],
      _fileMap: {},
    };

    const entryRelativeFolder = {
      collectionName: 'settings',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'data',
      internalSubPath: undefined,
      publicPath: '/data',
    };

    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection: fileCollection,
          content: {},
          currentSlug,
          entryFilePath: 'data/foo',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'data',
      resolvedPublicPath: '/data',
    });
  });

  test('file collection type with entry relative and empty public path', () => {
    /** @type {any} */
    const fileCollection = {
      name: 'settings',
      files: [],
      _type: 'file',
      _i18n: i18nSingleFile,
      _thumbnailFieldNames: [],
      _fileMap: {},
    };

    const entryRelativeFolder = {
      collectionName: 'settings',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'data',
      internalSubPath: undefined,
      publicPath: '',
    };

    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection: fileCollection,
          content: {},
          currentSlug,
          entryFilePath: 'data/foo',
        },
      }),
    ).toEqual({
      resolvedInternalPath: 'data',
      resolvedPublicPath: '',
    });
  });

  test('nested path with date template tags uses entryFilePath to preserve date context', () => {
    // This test demonstrates the critical issue where date-related template tags
    // (e.g., {{year}}-{{month}}-{{day}}-{{slug}}/index) should use the already-resolved
    // entryFilePath rather than reconstructing from templates to avoid saving assets
    // in a different folder if the entry is updated at a later date.
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      // subPath with date template tags - if reconstructed later with new dates,
      // would create incorrect paths like: 2026-02-14-my-post/images
      // instead of: 2024-01-01-my-post/images (where entry was created)
      _file: { ..._file, subPath: '{{year}}-{{month}}-{{day}}-{{slug}}/index' },
      _i18n: i18nMultiFile,
    };

    const entryRelativeFolder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: 'images',
      publicPath: '',
    };

    // entryFilePath has dates already filled in from when entry was created
    // (2024-01-01-my-post/index.md)
    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug: 'my-post',
          // Entry created 2024-01-01, stored in this path with dates already filled
          entryFilePath: 'src/content/blog/2024-01-01-my-post/index.md',
        },
      }),
    ).toEqual({
      // Assets should use same folder path with original dates, not reconstructed dates
      resolvedInternalPath: 'src/content/blog/2024-01-01-my-post/images',
      resolvedPublicPath: '',
    });
  });

  test('simple path with date template tags preserves original entry folder', () => {
    /** @type {InternalCollection} */
    const collection = {
      ...collectionBase,
      _file: { ..._file, subPath: '{{year}}/{{month}}/{{slug}}' },
      _i18n: i18nMultiFolder,
    };

    const entryRelativeFolder = {
      collectionName: 'blog',
      entryRelative: true,
      hasTemplateTags: false,
      internalPath: 'src/content/blog',
      internalSubPath: 'assets',
      publicPath: '',
    };

    // Entry created 2024-01-15, stored with dates from creation time
    // The critical part: internal path uses entryFilePath to preserve original dates
    expect(
      resolveAssetFolderPaths({
        folder: entryRelativeFolder,
        fillSlugOptions: {
          collection,
          content: {},
          currentSlug: 'my-post',
          entryFilePath: 'src/content/blog/2024/01/my-post.md',
        },
      }),
    ).toEqual({
      // Assets stay in same dated folder (2024/01) not reconstructed with current date (2026/02)
      resolvedInternalPath: 'src/content/blog/2024/01/my-post/assets',
      // Note: publicPath will be recalculated based on current template context,
      // but the internal storage location is what matters for asset preservation
      resolvedPublicPath: expect.any(String),
    });
  });
});

describe('Test replaceBlobURL()', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { getGitHash } = await import('$lib/services/utils/file');

    vi.mocked(getGitHash).mockResolvedValue('sha123');
  });

  test('should replace blob URL with public URL for new file', async () => {
    const mockFile = new File(['test content'], 'test-image.jpg', { type: 'image/jpeg' });
    const blobURL = 'blob:http://localhost:5173/abc-123';

    /** @type {any} */
    const draft = {
      collection: {
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'posts' },
        _assetFolder: { fields: [] },
      },
      collectionName: 'posts',
      fileName: undefined,
      collectionFile: undefined,
      isIndexFile: false,
      currentValues: { en: { title: 'Test' } },
      currentSlugs: { en: 'test-post' },
    };

    /** @type {any} */
    const folder = {
      internalPath: 'static/images',
      publicPath: '/images',
      entryRelative: false,
      collectionName: 'posts',
      hasTemplateTags: false,
    };

    const content = { image: blobURL };
    /** @type {any[]} */
    const changes = [];
    /** @type {any[]} */
    const savingAssets = [];

    await replaceBlobURL({
      file: mockFile,
      folder,
      blobURL,
      draft,
      defaultLocaleSlug: 'test-post',
      keyPath: 'image',
      content,
      changes,
      savingAssets,
      slugificationEnabled: false,
      encodingEnabled: false,
    });

    expect(content.image).toBe('/images/test-image.jpg');
    expect(changes).toHaveLength(1);
    expect(savingAssets).toHaveLength(1);
  });

  test('should reuse existing file when duplicate detected', async () => {
    const { getGitHash } = await import('$lib/services/utils/file');
    const mockFile = new File(['test content'], 'duplicate.jpg', { type: 'image/jpeg' });
    const blobURL = 'blob:http://localhost:5173/def-456';

    vi.mocked(getGitHash).mockResolvedValue('sha-duplicate');

    /** @type {any} */
    const draft = {
      collection: {
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'posts' },
        _assetFolder: { fields: [] },
      },
      collectionName: 'posts',
      fileName: undefined,
      collectionFile: undefined,
      isIndexFile: false,
      currentValues: { en: { title: 'Test' } },
      currentSlugs: { en: 'test-post' },
    };

    /** @type {any} */
    const folder = {
      internalPath: 'static/images',
      publicPath: '/images',
      entryRelative: false,
      collectionName: 'posts',
      hasTemplateTags: false,
    };

    const content = { image: blobURL };
    /** @type {any[]} */
    const changes = [];

    /** @type {any[]} */
    const savingAssets = [
      {
        collectionName: 'posts',
        name: 'existing-file.jpg',
        path: 'static/images/existing-file.jpg',
        sha: 'sha-duplicate',
        size: 1024,
        kind: 'image',
      },
    ];

    await replaceBlobURL({
      file: mockFile,
      folder,
      blobURL,
      draft,
      defaultLocaleSlug: 'test-post',
      keyPath: 'image',
      content,
      changes,
      savingAssets,
      slugificationEnabled: false,
      encodingEnabled: false,
    });

    expect(content.image).toBe('/images/existing-file.jpg');
    expect(changes).toHaveLength(0); // No new change added
    expect(savingAssets).toHaveLength(1); // No new asset added
  });

  test('should handle root public path correctly', async () => {
    const mockFile = new File(['content'], 'root-image.jpg', { type: 'image/jpeg' });
    const blobURL = 'blob:http://localhost:5173/ghi-789';

    /** @type {any} */
    const draft = {
      collection: {
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'posts' },
        _assetFolder: { fields: [] },
      },
      collectionName: 'posts',
      fileName: undefined,
      collectionFile: undefined,
      isIndexFile: false,
      currentValues: { en: { title: 'Test' } },
      currentSlugs: { en: 'test-post' },
    };

    /** @type {any} */
    const folder = {
      internalPath: 'static',
      publicPath: '/',
      entryRelative: false,
      collectionName: 'posts',
      hasTemplateTags: false,
    };

    const content = { image: blobURL };
    /** @type {any[]} */
    const changes = [];
    /** @type {any[]} */
    const savingAssets = [];

    await replaceBlobURL({
      file: mockFile,
      folder,
      blobURL,
      draft,
      defaultLocaleSlug: 'test-post',
      keyPath: 'image',
      content,
      changes,
      savingAssets,
      slugificationEnabled: false,
      encodingEnabled: false,
    });

    expect(content.image).toBe('/root-image.jpg'); // Root path should not have double slash
  });

  test('should encode file path when encoding is enabled', async () => {
    const { encodeFilePath } = await import('$lib/services/utils/file');

    vi.mocked(encodeFilePath).mockReturnValue('/images/test%20file%20with%20spaces.jpg');

    const mockFile = new File(['content'], 'test file with spaces.jpg', { type: 'image/jpeg' });
    const blobURL = 'blob:http://localhost:5173/jkl-012';

    /** @type {any} */
    const draft = {
      collection: {
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'posts' },
        _assetFolder: { fields: [] },
      },
      collectionName: 'posts',
      fileName: undefined,
      collectionFile: undefined,
      isIndexFile: false,
      currentValues: { en: { title: 'Test' } },
      currentSlugs: { en: 'test-post' },
    };

    /** @type {any} */
    const folder = {
      internalPath: 'static/images',
      publicPath: '/images',
      entryRelative: false,
      collectionName: 'posts',
      hasTemplateTags: false,
    };

    const content = { image: blobURL };
    /** @type {any[]} */
    const changes = [];
    /** @type {any[]} */
    const savingAssets = [];

    await replaceBlobURL({
      file: mockFile,
      folder,
      blobURL,
      draft,
      defaultLocaleSlug: 'test-post',
      keyPath: 'image',
      content,
      changes,
      savingAssets,
      slugificationEnabled: false,
      encodingEnabled: true,
    });

    expect(content.image).toContain('%20'); // Spaces should be encoded
  });

  test('should handle empty internal path', async () => {
    const mockFile = new File(['content'], 'no-path.jpg', { type: 'image/jpeg' });
    const blobURL = 'blob:http://localhost:5173/mno-345';

    /** @type {any} */
    const draft = {
      collection: {
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'posts' },
        _assetFolder: { fields: [] },
      },
      collectionName: 'posts',
      fileName: undefined,
      collectionFile: undefined,
      isIndexFile: false,
      currentValues: { en: { title: 'Test' } },
      currentSlugs: { en: 'test-post' },
    };

    /** @type {any} */
    const folder = {
      internalPath: '',
      publicPath: '',
      entryRelative: false,
      collectionName: 'posts',
      hasTemplateTags: false,
    };

    const content = { image: blobURL };
    /** @type {any[]} */
    const changes = [];
    /** @type {any[]} */
    const savingAssets = [];

    await replaceBlobURL({
      file: mockFile,
      folder,
      blobURL,
      draft,
      defaultLocaleSlug: 'test-post',
      keyPath: 'image',
      content,
      changes,
      savingAssets,
      slugificationEnabled: false,
      encodingEnabled: false,
    });

    expect(content.image).toBe('no-path.jpg');
  });

  test('should replace multiple occurrences of blob URL', async () => {
    const mockFile = new File(['content'], 'multi-use.jpg', { type: 'image/jpeg' });
    const blobURL = 'blob:http://localhost:5173/stu-901';

    /** @type {any} */
    const draft = {
      collection: {
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'posts' },
        _assetFolder: { fields: [] },
      },
      collectionName: 'posts',
      fileName: undefined,
      collectionFile: undefined,
      isIndexFile: false,
      currentValues: { en: { title: 'Test' } },
      currentSlugs: { en: 'test-post' },
    };

    /** @type {any} */
    const folder = {
      internalPath: 'static',
      publicPath: '/static',
      entryRelative: false,
      collectionName: 'posts',
      hasTemplateTags: false,
    };

    const content = {
      body: `![Image](${blobURL}) and another reference ${blobURL}`,
    };

    /** @type {any[]} */
    const changes = [];
    /** @type {any[]} */
    const savingAssets = [];

    await replaceBlobURL({
      file: mockFile,
      folder,
      blobURL,
      draft,
      defaultLocaleSlug: 'test-post',
      keyPath: 'body',
      content,
      changes,
      savingAssets,
      slugificationEnabled: false,
      encodingEnabled: false,
    });

    expect(content.body).not.toContain(blobURL);
  });

  test('should handle dot-only public path correctly', async () => {
    const { getFillSlugOptions } = await import('$lib/services/contents/draft/slugs');
    const mockFile = new File(['content'], 'relative-image.jpg', { type: 'image/jpeg' });
    const blobURL = 'blob:http://localhost:5173/vwx-234';

    /** @type {InternalCollection} */
    const mockCollection = {
      _type: /** @type {'entry'} */ ('entry'),
      name: 'posts',
      folder: 'posts',
      fields: [],
      _i18n: {
        i18nEnabled: true,
        defaultLocale: 'en',
        structure: 'single_file',
        allLocales: ['en'],
        initialLocales: ['en'],
        canonicalSlug: { key: '', value: '' },
        omitDefaultLocaleFromFilePath: false,
        omitDefaultLocaleFromPreviewPath: false,
        structureMap: {
          i18nSingleFile: true,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nMultiRootFolder: false,
        },
      },
      _file: {
        basePath: 'posts',
        subPath: 'test-post',
        extension: 'md',
        format: 'yaml-frontmatter',
      },
      _thumbnailFieldNames: [],
    };

    vi.mocked(getFillSlugOptions).mockReturnValue({
      collection: mockCollection,
      content: {},
    });

    /** @type {any} */
    const draft = {
      collection: mockCollection,
      collectionName: 'posts',
      fileName: undefined,
      collectionFile: undefined,
      isIndexFile: false,
      currentValues: { en: { title: 'Test' } },
      currentSlugs: { en: 'test-post' },
    };

    /** @type {any} */
    const folder = {
      internalPath: 'content/posts',
      publicPath: '.',
      entryRelative: true,
      collectionName: 'posts',
      hasTemplateTags: false,
    };

    const content = { image: blobURL };
    /** @type {any[]} */
    const changes = [];
    /** @type {any[]} */
    const savingAssets = [];

    await replaceBlobURL({
      file: mockFile,
      folder,
      blobURL,
      draft,
      defaultLocaleSlug: 'test-post',
      keyPath: 'image',
      content,
      changes,
      savingAssets,
      slugificationEnabled: false,
      encodingEnabled: false,
    });

    expect(content.image).toBe('./relative-image.jpg');
  });
});

describe('Test getAssetSavingInfo()', () => {
  /** @type {any} */
  let mockGetAssetsByDirName;
  /** @type {any} */
  let mockGetFillSlugOptions;
  /** @type {any} */
  let mockCreateEntryPath;

  beforeEach(async () => {
    vi.clearAllMocks();

    const assetsModule = await import('$lib/services/assets');
    const slugsModule = await import('$lib/services/contents/draft/slugs');
    const entryPathModule = await import('$lib/services/contents/draft/save/entry-path');

    mockGetAssetsByDirName = assetsModule.getAssetsByDirName;
    mockGetFillSlugOptions = slugsModule.getFillSlugOptions;
    mockCreateEntryPath = entryPathModule.createEntryPath;
  });

  test('should return asset saving info for non-entry-relative folder', async () => {
    /** @type {any} */
    const draft = {
      collection: {
        name: 'posts',
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'content/posts' },
      },
      collectionName: 'posts',
      collectionFile: undefined,
      isIndexFile: false,
    };

    /** @type {any} */
    const folder = {
      collectionName: 'posts',
      entryRelative: false,
      internalPath: 'static/uploads',
      publicPath: '/uploads',
    };

    const defaultLocaleSlug = 'my-post';

    mockGetAssetsByDirName.mockReturnValue([{ name: 'existing1.jpg' }, { name: 'existing2.png' }]);

    mockGetFillSlugOptions.mockReturnValue({
      collection: draft.collection,
      content: {},
    });

    mockCreateEntryPath.mockReturnValue('content/posts/my-post.md');

    const result = getAssetSavingInfo({ draft, defaultLocaleSlug, folder });

    expect(result.assetFolderPaths).toEqual({
      resolvedInternalPath: 'static/uploads',
      resolvedPublicPath: '/uploads',
    });

    expect(result.assetNamesInSameFolder).toEqual(['existing1.jpg', 'existing2.png']);

    expect(result.savingAssetProps).toEqual({
      collectionName: 'posts',
      folder,
    });

    expect(mockGetAssetsByDirName).toHaveBeenCalledWith('static/uploads');
  });

  test('should return asset saving info for entry-relative folder with multiple_folders', async () => {
    /** @type {any} */
    const draft = {
      collection: {
        name: 'blog',
        _type: 'entry',
        _i18n: {
          defaultLocale: 'en',
          structure: 'multiple_folders',
        },
        _file: {
          basePath: 'src/content/blog',
          subPath: '{{slug}}',
        },
        media_folder: 'images',
      },
      collectionName: 'blog',
      collectionFile: undefined,
      isIndexFile: false,
    };

    /** @type {any} */
    const folder = {
      collectionName: 'blog',
      entryRelative: true,
      internalPath: 'src/content/blog',
      publicPath: '',
    };

    const defaultLocaleSlug = 'hello-world';

    mockGetAssetsByDirName.mockReturnValue([]);

    mockGetFillSlugOptions.mockReturnValue({
      collection: draft.collection,
      content: {},
      currentSlug: defaultLocaleSlug,
      entryFilePath: 'src/content/blog/hello-world',
    });

    mockCreateEntryPath.mockReturnValue('src/content/blog/hello-world.md');

    const result = getAssetSavingInfo({ draft, defaultLocaleSlug, folder });

    expect(result.assetFolderPaths.resolvedInternalPath).toContain('hello-world');
    expect(result.assetNamesInSameFolder).toEqual([]);
    expect(result.savingAssetProps.collectionName).toBe('blog');
  });

  test('should normalize asset names', async () => {
    /** @type {any} */
    const draft = {
      collection: {
        name: 'posts',
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'content/posts' },
      },
      collectionName: 'posts',
      collectionFile: undefined,
      isIndexFile: false,
    };

    /** @type {any} */
    const folder = {
      collectionName: 'posts',
      entryRelative: false,
      internalPath: 'static/uploads',
      publicPath: '/uploads',
    };

    const defaultLocaleSlug = 'test';

    // Asset names with different normalizations (e.g., composed vs decomposed Unicode)
    mockGetAssetsByDirName.mockReturnValue([
      { name: 'café.jpg' }, // May have different Unicode representations
      { name: 'naïve.png' },
    ]);

    mockGetFillSlugOptions.mockReturnValue({
      collection: draft.collection,
      content: {},
    });

    mockCreateEntryPath.mockReturnValue('content/posts/test.md');

    const result = getAssetSavingInfo({ draft, defaultLocaleSlug, folder });

    // Names should be normalized
    expect(result.assetNamesInSameFolder).toHaveLength(2);
    expect(result.assetNamesInSameFolder[0]).toBe('café.jpg'.normalize());
    expect(result.assetNamesInSameFolder[1]).toBe('naïve.png'.normalize());
  });

  test('should handle collection file i18n configuration', async () => {
    const collectionFile = {
      name: 'about',
      _i18n: { defaultLocale: 'fr' },
    };

    /** @type {any} */
    const draft = {
      collection: {
        name: 'pages',
        _type: 'file',
        _i18n: { defaultLocale: 'en' },
      },
      collectionName: 'pages',
      collectionFile,
      isIndexFile: false,
    };

    /** @type {any} */
    const folder = {
      collectionName: 'pages',
      entryRelative: false,
      internalPath: 'static/pages',
      publicPath: '/pages',
    };

    const defaultLocaleSlug = 'about';

    mockGetAssetsByDirName.mockReturnValue([]);
    mockGetFillSlugOptions.mockReturnValue({
      collection: draft.collection,
      content: {},
    });
    mockCreateEntryPath.mockReturnValue('content/pages/about.md');

    const result = getAssetSavingInfo({ draft, defaultLocaleSlug, folder });

    expect(mockCreateEntryPath).toHaveBeenCalledWith({
      draft,
      locale: 'fr', // Should use collection file's default locale
      slug: 'about',
    });

    expect(result.savingAssetProps.collectionName).toBe('pages');
  });

  test('should pass correct parameters to getFillSlugOptions', async () => {
    /** @type {any} */
    const draft = {
      collection: {
        name: 'posts',
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'content/posts' },
      },
      collectionName: 'posts',
      collectionFile: undefined,
      isIndexFile: true,
    };

    /** @type {any} */
    const folder = {
      collectionName: 'posts',
      entryRelative: false,
      internalPath: 'static/uploads',
      publicPath: '/uploads',
    };

    const defaultLocaleSlug = 'my-post';

    mockGetAssetsByDirName.mockReturnValue([]);
    mockGetFillSlugOptions.mockReturnValue({
      collection: draft.collection,
      content: {},
    });
    mockCreateEntryPath.mockReturnValue('content/posts/my-post/index.md');

    getAssetSavingInfo({ draft, defaultLocaleSlug, folder });

    expect(mockGetFillSlugOptions).toHaveBeenCalledWith({ draft });
  });

  test('should handle empty asset directory', async () => {
    /** @type {any} */
    const draft = {
      collection: {
        name: 'posts',
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'content/posts' },
      },
      collectionName: 'posts',
      collectionFile: undefined,
      isIndexFile: false,
    };

    /** @type {any} */
    const folder = {
      collectionName: 'posts',
      entryRelative: false,
      internalPath: 'static/new-folder',
      publicPath: '/new-folder',
    };

    const defaultLocaleSlug = 'first-post';

    mockGetAssetsByDirName.mockReturnValue([]);
    mockGetFillSlugOptions.mockReturnValue({
      collection: draft.collection,
      content: {},
    });
    mockCreateEntryPath.mockReturnValue('content/posts/first-post.md');

    const result = getAssetSavingInfo({ draft, defaultLocaleSlug, folder });

    expect(result.assetNamesInSameFolder).toEqual([]);
    expect(result.assetFolderPaths.resolvedInternalPath).toBe('static/new-folder');
  });

  test('should use resolveAssetFolderPaths with correct parameters', async () => {
    /** @type {any} */
    const draft = {
      collection: {
        name: 'posts',
        _type: 'entry',
        _i18n: { defaultLocale: 'en' },
        _file: { basePath: 'content/posts' },
      },
      collectionName: 'posts',
      collectionFile: undefined,
      isIndexFile: false,
    };

    /** @type {any} */
    const folder = {
      collectionName: 'posts',
      entryRelative: false,
      internalPath: 'static/uploads/{{slug}}',
      publicPath: '/uploads/{{slug}}',
    };

    const defaultLocaleSlug = 'template-test';

    mockGetAssetsByDirName.mockReturnValue([]);
    mockGetFillSlugOptions.mockReturnValue({
      collection: draft.collection,
      content: {},
      currentSlug: defaultLocaleSlug,
    });
    mockCreateEntryPath.mockReturnValue('content/posts/template-test.md');

    const result = getAssetSavingInfo({ draft, defaultLocaleSlug, folder });

    // The resolved paths should have the template tags replaced
    expect(result.assetFolderPaths.resolvedInternalPath).toBe('static/uploads/template-test');
    expect(result.assetFolderPaths.resolvedPublicPath).toBe('/uploads/template-test');
  });
});
