import { describe, expect, test, vi } from 'vitest';

import { getFolderPublicPath } from '$lib/services/assets/info';
import { getStockAssetMediaLibraryOptions } from '$lib/services/integrations/media-libraries/stock';

import {
  getFirstDefaultLibraryName,
  getInsertedResources,
  getPickedFolderPublicPaths,
  getStockAssetProviderEntries,
  getUnsavedAssetSubfolderPath,
  isFolderOffered,
  sortServicesByName,
} from './select-assets-dialog.svelte';

vi.mock('$lib/services/assets/info', () => ({
  getFolderPublicPath: vi.fn(
    ({ folder, subfolderPath }) =>
      `${folder.publicPath}${subfolderPath ? `/${subfolderPath}` : ''}`,
  ),
}));

vi.mock('$lib/services/integrations/media-libraries/stock', () => ({
  allStockAssetProviders: {
    pexels: { serviceLabel: 'Pexels', hotlinking: false },
    picsum: { serviceLabel: 'Lorem Picsum', hotlinking: true },
    pixabay: { serviceLabel: 'Pixabay', hotlinking: false },
    unsplash: { serviceLabel: 'Unsplash', hotlinking: true },
  },
  getStockAssetMediaLibraryOptions: vi.fn(() => ({ providers: [] })),
}));

/**
 * @import { Asset, AssetFolderInfo, AssetLibraryFolderMap } from '$lib/types/private';
 */

/** @type {AssetFolderInfo} */
const browsableFolder = {
  collectionName: undefined,
  internalPath: 'static/images',
  publicPath: '/images',
  entryRelative: false,
  hasTemplateTags: false,
};

/** @type {AssetFolderInfo} */
const entryRelativeFolder = { ...browsableFolder, collectionName: 'posts', entryRelative: true };

describe('sortServicesByName()', () => {
  test('sorts service entries by label, ignoring case', () => {
    const entries = /** @type {[string, { serviceLabel: string }][]} */ ([
      ['b', { serviceLabel: 'unsplash' }],
      ['a', { serviceLabel: 'Pexels' }],
      ['c', { serviceLabel: 'Cloudinary' }],
    ]);

    expect(entries.sort(sortServicesByName).map(([id]) => id)).toEqual(['c', 'a', 'b']);
  });
});

describe('isFolderOffered()', () => {
  test('offers an enabled folder', () => {
    expect(isFolderOffered({ folder: entryRelativeFolder, enabled: true }, false)).toBe(true);
    expect(isFolderOffered({ folder: entryRelativeFolder, enabled: false }, false)).toBe(false);
  });

  test('only offers a folder that can be browsed for folder selection', () => {
    expect(isFolderOffered({ folder: browsableFolder, enabled: true }, true)).toBe(true);
    expect(isFolderOffered({ folder: entryRelativeFolder, enabled: true }, true)).toBe(false);
    expect(isFolderOffered({ folder: undefined, enabled: true }, true)).toBe(false);
  });
});

describe('getFirstDefaultLibraryName()', () => {
  /** @type {AssetLibraryFolderMap} */
  const assetLibraryFolderMap = {
    field: { folder: undefined, enabled: false },
    entry: { folder: entryRelativeFolder, enabled: true },
    global: { folder: browsableFolder, enabled: true },
  };

  test('returns the first offered folder', () => {
    expect(
      getFirstDefaultLibraryName({
        assetLibraryFolderMap,
        isDefaultLibraryEnabled: true,
        selectFolder: false,
      }),
    ).toBe('default-entry');
    expect(
      getFirstDefaultLibraryName({
        assetLibraryFolderMap,
        isDefaultLibraryEnabled: true,
        selectFolder: true,
      }),
    ).toBe('default-global');
  });

  test('returns `undefined` without an offered folder', () => {
    expect(
      getFirstDefaultLibraryName({
        assetLibraryFolderMap,
        isDefaultLibraryEnabled: false,
        selectFolder: false,
      }),
    ).toBeUndefined();
    expect(
      getFirstDefaultLibraryName({
        assetLibraryFolderMap: { field: { folder: undefined, enabled: false } },
        isDefaultLibraryEnabled: true,
        selectFolder: false,
      }),
    ).toBeUndefined();
  });
});

describe('getStockAssetProviderEntries()', () => {
  test('returns nothing for folder selection', () => {
    vi.mocked(getStockAssetMediaLibraryOptions).mockReturnValue({ providers: ['picsum'] });

    expect(
      getStockAssetProviderEntries({ selectFolder: true, isDefaultLibraryEnabled: true }),
    ).toEqual([]);
    expect(getStockAssetMediaLibraryOptions).not.toHaveBeenCalled();
  });

  test('returns the configured providers, sorted by name', () => {
    const fieldConfig = /** @type {any} */ ({ name: 'image', widget: 'image' });

    vi.mocked(getStockAssetMediaLibraryOptions).mockReturnValue({
      providers: ['unsplash', 'pexels', 'picsum'],
    });

    expect(
      getStockAssetProviderEntries({
        fieldConfig,
        selectFolder: false,
        isDefaultLibraryEnabled: true,
      }).map(([id]) => id),
    ).toEqual(['picsum', 'pexels', 'unsplash']);
    expect(getStockAssetMediaLibraryOptions).toHaveBeenCalledWith({ fieldConfig });
  });

  test('requires the default library for a provider without hotlinking', () => {
    vi.mocked(getStockAssetMediaLibraryOptions).mockReturnValue({
      providers: ['unsplash', 'pexels', 'picsum'],
    });

    expect(
      getStockAssetProviderEntries({ selectFolder: false, isDefaultLibraryEnabled: false }).map(
        ([id]) => id,
      ),
    ).toEqual(['picsum', 'unsplash']);
  });

  test('defaults to no providers', () => {
    vi.mocked(getStockAssetMediaLibraryOptions).mockReturnValue(/** @type {any} */ ({}));

    expect(
      getStockAssetProviderEntries({ selectFolder: false, isDefaultLibraryEnabled: true }),
    ).toEqual([]);
  });
});

describe('getPickedFolderPublicPaths()', () => {
  const args = {
    selectFolder: true,
    browsingSubfolders: true,
    folder: browsableFolder,
    basePath: 'static/images',
    subfolderPath: '',
    selectedSubfolderPaths: [],
  };

  test('returns nothing unless a folder is picked from a folder being browsed', () => {
    expect(getPickedFolderPublicPaths({ ...args, selectFolder: false })).toEqual([]);
    expect(getPickedFolderPublicPaths({ ...args, browsingSubfolders: false })).toEqual([]);
    expect(getFolderPublicPath).not.toHaveBeenCalled();
  });

  test('returns the directory being browsed without a selection', () => {
    expect(getPickedFolderPublicPaths(args)).toEqual(['/images']);
    expect(getPickedFolderPublicPaths({ ...args, subfolderPath: '2024/summer' })).toEqual([
      '/images/2024/summer',
    ]);
  });

  test('returns the selected subfolders', () => {
    expect(
      getPickedFolderPublicPaths({
        ...args,
        subfolderPath: '2024',
        selectedSubfolderPaths: ['static/images/2024/summer', 'static/images/2025'],
      }),
    ).toEqual(['/images/2024/summer', '/images/2025']);
    expect(getFolderPublicPath).toHaveBeenCalledWith({
      folder: browsableFolder,
      subfolderPath: '2024/summer',
    });
  });
});

describe('getUnsavedAssetSubfolderPath()', () => {
  const asset = /** @type {Asset} */ ({ path: 'static/images/2024/summer/photo.jpg' });

  test('returns the subfolder below the target folder', () => {
    expect(getUnsavedAssetSubfolderPath(asset, 'static/images')).toBe('2024/summer');
    expect(getUnsavedAssetSubfolderPath(asset, 'static/images/2024/summer')).toBe('');
  });

  test('returns an empty string without a target folder', () => {
    expect(getUnsavedAssetSubfolderPath(asset, undefined)).toBe('');
  });
});

describe('getInsertedResources()', () => {
  test('copies the resources other than unsaved assets', () => {
    const savedAsset = /** @type {Asset} */ ({
      path: 'static/images/a.jpg',
      folder: browsableFolder,
    });

    const resources = [{ asset: savedAsset }, { url: 'https://example.com/b.jpg' }];
    const result = getInsertedResources({ resources, targetFolderPath: 'static/images' });

    expect(result).toEqual(resources);
    expect(result[0]).not.toBe(resources[0]);
  });

  test('turns an unsaved asset into the file to be saved', () => {
    const file = new File(['x'], 'photo.jpg');

    const unsavedAsset = /** @type {Asset} */ ({
      path: 'static/images/2024/photo.jpg',
      folder: browsableFolder,
      file,
      unsaved: true,
    });

    const [result] = getInsertedResources({
      resources: [{ asset: unsavedAsset, replace: true }],
      targetFolderPath: 'static/images',
    });

    expect(result).toEqual({
      file,
      folder: browsableFolder,
      subfolderPath: '2024',
      replace: true,
    });
    // The file is passed as is rather than cloned
    expect(result.file).toBe(file);
    expect(result.folder).not.toBe(browsableFolder);
  });
});
