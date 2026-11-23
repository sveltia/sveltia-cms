import { allAssets } from '$lib/services/assets/state';
import { memoizeOnSource } from '$lib/services/utils/cache';

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
