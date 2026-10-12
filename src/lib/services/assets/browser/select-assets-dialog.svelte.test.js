import { describe, expect, test, vi } from 'vitest';

import { getFolderPublicPath } from '$lib/services/assets/info';
import { getStockAssetMediaLibraryOptions } from '$lib/services/integrations/media-libraries/stock';
import { createMockAssetFolder } from '$lib/test/factories';

import {
  getFirstDefaultLibraryName,
  getInitialLibraryName,
  getInsertedResources,
  getLocationResources,
  getPickedFolderPublicPaths,
  getSelectionWithResource,
  getStockAssetProviderEntries,
  getUnsavedAssetSubfolderPath,
  isFolderOffered,
  sortServicesByName,
  trackInsertedExternalAssets,
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
 * @import {
 * Asset,
 * AssetFolderInfo,
 * AssetLibraryFolderMap,
 * MediaLibraryService,
 * } from '$lib/types/private';
 */

/** @type {AssetFolderInfo} */
const browsableFolder = createMockAssetFolder({
  internalPath: 'static/images',
  publicPath: '/images',
});

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

describe('getInitialLibraryName()', () => {
  /** @type {AssetLibraryFolderMap} */
  const assetLibraryFolderMap = {
    field: { folder: undefined, enabled: false },
    entry: { folder: undefined, enabled: false },
    global: { folder: browsableFolder, enabled: true },
  };

  const cloud = /** @type {[string, MediaLibraryService]} */ (['cloudinary', {}]);
  const stock = /** @type {[string, MediaLibraryService]} */ (['pexels', {}]);

  const args = {
    assetLibraryFolderMap,
    isDefaultLibraryEnabled: true,
    selectFolder: false,
    hasPendingFiles: false,
    cloudServiceEntries: [cloud],
    externalServiceEntries: [cloud, stock].reverse(),
  };

  test('selects the first repository folder offered', () => {
    expect(getInitialLibraryName({ ...args, hasPendingFiles: true })).toBe('default-global');
  });

  test('selects the first cloud storage service for pending files', () => {
    expect(
      getInitialLibraryName({ ...args, isDefaultLibraryEnabled: false, hasPendingFiles: true }),
    ).toBe('cloudinary');
    // Without a cloud storage service, the first external service is selected
    expect(
      getInitialLibraryName({
        ...args,
        isDefaultLibraryEnabled: false,
        hasPendingFiles: true,
        cloudServiceEntries: [],
      }),
    ).toBe('pexels');
  });

  test('selects the first external service otherwise', () => {
    expect(getInitialLibraryName({ ...args, isDefaultLibraryEnabled: false })).toBe('pexels');
  });

  test('selects nothing without any location', () => {
    expect(
      getInitialLibraryName({
        ...args,
        isDefaultLibraryEnabled: false,
        cloudServiceEntries: [],
        externalServiceEntries: [],
      }),
    ).toBe('');
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

describe('getSelectionWithResource()', () => {
  const a = { url: 'https://example.com/a.jpg' };
  const b = { url: 'https://example.com/b.jpg' };
  const c = { url: 'https://example.com/c.jpg' };
  /**
   * Check if a resource is the same as `b`.
   * @param {{ url?: string }} r Resource.
   * @returns {boolean} Result.
   */
  const isSameAsB = (r) => r.url === b.url;

  test('replaces a single selection, including picks no longer listed', () => {
    expect(getSelectionWithResource({ resources: [a], resource: b, isSame: isSameAsB })).toEqual([
      b,
    ]);
    expect(
      getSelectionWithResource({
        resources: [a, c],
        resource: b,
        isSame: isSameAsB,
        multiple: false,
      }),
    ).toEqual([b]);
  });

  test('adds to a multiple selection without listing the resource twice', () => {
    expect(
      getSelectionWithResource({
        resources: [a, b, c],
        resource: b,
        isSame: isSameAsB,
        multiple: true,
      }),
    ).toEqual([a, c, b]);
    expect(
      getSelectionWithResource({ resources: [], resource: b, isSame: isSameAsB, multiple: true }),
    ).toEqual([b]);
  });
});

describe('getLocationResources()', () => {
  test('selects the URL entered earlier on coming back to Enter URL', () => {
    expect(
      getLocationResources({ libraryName: 'enter-url', enteredURL: ' https://example.com/a.png ' }),
    ).toEqual([{ url: 'https://example.com/a.png' }]);
  });

  test('selects nothing without a URL', () => {
    expect(getLocationResources({ libraryName: 'enter-url', enteredURL: ' ' })).toEqual([]);
  });

  test('selects nothing on another location', () => {
    expect(
      getLocationResources({ libraryName: 'default-global', enteredURL: 'https://example.com/' }),
    ).toEqual([]);
  });
});

describe('trackInsertedExternalAssets()', () => {
  const asset = /** @type {any} */ ({ id: '1', downloadURL: 'https://example.com/1.jpg' });
  const assets = new Map([[asset.downloadURL, asset]]);
  const options = /** @type {any} */ ({ apiKey: 'key' });

  test('reports the inserted assets the service has listed', () => {
    const trackDownload = vi.fn().mockResolvedValue(undefined);

    trackInsertedExternalAssets({
      trackDownload,
      resources: [{ url: asset.downloadURL }, { url: 'https://example.com/other.jpg' }, {}],
      assets,
      options,
    });

    expect(trackDownload).toHaveBeenCalledTimes(1);
    expect(trackDownload).toHaveBeenCalledWith(asset, options);
  });

  test('ignores a failure', async () => {
    const trackDownload = vi.fn().mockRejectedValue(new Error('Boom'));

    expect(() =>
      trackInsertedExternalAssets({
        trackDownload,
        resources: [{ url: asset.downloadURL }],
        assets,
        options,
      }),
    ).not.toThrow();
    await Promise.resolve();
    expect(trackDownload).toHaveBeenCalledTimes(1);
  });

  test('does nothing for a service that doesn’t track downloads', () => {
    expect(() =>
      trackInsertedExternalAssets({
        trackDownload: undefined,
        resources: [{ url: asset.downloadURL }],
        assets,
        options,
      }),
    ).not.toThrow();
  });
});
