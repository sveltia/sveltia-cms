import { allAssets } from '$lib/services/assets/state';
import { getOrCreate, memoizeOnSource } from '$lib/services/utils/cache';

/**
 * @import { Asset } from '$lib/types/private';
 */

/**
 * Get a Map from asset path to Asset, used for O(1) path lookups. Rebuilt only when `allAssets` is
 * replaced.
 * @type {() => Map<string, Asset>}
 */
export const getAssetPathMap = memoizeOnSource(
  () => allAssets.current,
  (_allAssets) => new Map(_allAssets.map((asset) => [asset.path, asset])),
);

/**
 * Get a Map from Git object ID to the assets with that content, in the order of `allAssets`, used
 * to find an existing copy of a file. Rebuilt only when `allAssets` is replaced.
 * @type {() => Map<string, Asset[]>}
 */
export const getAssetsBySha = memoizeOnSource(
  () => allAssets.current,
  (_allAssets) => {
    /** @type {Map<string, Asset[]>} */
    const map = new Map();

    _allAssets.forEach((asset) => {
      getOrCreate(map, asset.sha, () => /** @type {Asset[]} */ ([])).push(asset);
    });

    return map;
  },
);
