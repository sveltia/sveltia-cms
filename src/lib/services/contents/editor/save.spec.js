import { describe, expect, test } from 'vitest';
import { getEntryAssetFolderPaths } from '$lib/services/contents/editor/save';

describe('Test getEntryAssetFolderPaths()', () => {
  const currentSlug = 'foo';

  test('simple path, multiple folders, entry relative', () => {
    const collection = {
      path: '{{slug}}',
      _i18n: { structure: 'multiple_folders' },
      _assetFolder: {
        entryRelative: true,
        internalPath: 'src/content/blog',
        publicPath: '',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'src/content/blog/foo',
      publicAssetFolder: '../foo',
    });
  });

  test('nested path, multiple folders, entry relative', () => {
    const collection = {
      path: '{{slug}}/index',
      _i18n: { structure: 'multiple_folders' },
      _assetFolder: {
        entryRelative: true,
        internalPath: 'src/content/blog',
        publicPath: '',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'src/content/blog/foo',
      publicAssetFolder: '../../foo',
    });
  });

  test('simple path, multiple files, entry relative', () => {
    const collection = {
      path: '{{slug}}',
      _i18n: { structure: 'multiple_files' },
      _assetFolder: {
        entryRelative: true,
        internalPath: 'src/content/blog',
        publicPath: '',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'src/content/blog',
      publicAssetFolder: '',
    });
  });

  test('nested path, multiple files, entry relative', () => {
    const collection = {
      path: '{{slug}}/index',
      _i18n: { structure: 'multiple_files' },
      _assetFolder: {
        entryRelative: true,
        internalPath: 'src/content/blog',
        publicPath: '',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'src/content/blog/foo',
      publicAssetFolder: '',
    });
  });

  test('simple path, single file, entry relative', () => {
    const collection = {
      path: '{{slug}}',
      _i18n: { structure: 'single_file' },
      _assetFolder: {
        entryRelative: true,
        internalPath: 'src/content/blog',
        publicPath: '',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'src/content/blog',
      publicAssetFolder: '',
    });
  });

  test('nested path, single file, entry relative', () => {
    const collection = {
      path: '{{slug}}/index',
      _i18n: { structure: 'single_file' },
      _assetFolder: {
        entryRelative: true,
        internalPath: 'src/content/blog',
        publicPath: '',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'src/content/blog/foo',
      publicAssetFolder: '',
    });
  });

  test('simple path, multiple folders, entry absolute', () => {
    const collection = {
      path: '{{slug}}',
      _i18n: { structure: 'multiple_folders' },
      _assetFolder: {
        entryRelative: false,
        internalPath: 'static/uploads/blog',
        publicPath: '/uploads/blog',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('nested path, multiple folders, entry absolute', () => {
    const collection = {
      path: '{{slug}}/index',
      _i18n: { structure: 'multiple_folders' },
      _assetFolder: {
        entryRelative: false,
        internalPath: 'static/uploads/blog',
        publicPath: '/uploads/blog',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('simple path, multiple files, entry absolute', () => {
    const collection = {
      path: '{{slug}}',
      _i18n: { structure: 'multiple_files' },
      _assetFolder: {
        entryRelative: false,
        internalPath: 'static/uploads/blog',
        publicPath: '/uploads/blog',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('nested path, multiple files, entry absolute', () => {
    const collection = {
      path: '{{slug}}/index',
      _i18n: { structure: 'multiple_files' },
      _assetFolder: {
        entryRelative: false,
        internalPath: 'static/uploads/blog',
        publicPath: '/uploads/blog',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('simple path, single file, entry absolute', () => {
    const collection = {
      path: '{{slug}}',
      _i18n: { structure: 'single_file' },
      _assetFolder: {
        entryRelative: false,
        internalPath: 'static/uploads/blog',
        publicPath: '/uploads/blog',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });

  test('nested path, single file, entry absolute', () => {
    const collection = {
      path: '{{slug}}/index',
      _i18n: { structure: 'single_file' },
      _assetFolder: {
        entryRelative: false,
        internalPath: 'static/uploads/blog',
        publicPath: '/uploads/blog',
      },
    };

    expect(getEntryAssetFolderPaths({ collection, currentSlug })).toEqual({
      internalAssetFolder: 'static/uploads/blog',
      publicAssetFolder: '/uploads/blog',
    });
  });
});
