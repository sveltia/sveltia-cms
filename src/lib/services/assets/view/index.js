import { _ } from '@sveltia/i18n';
import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

import { publishedAssets, selectedAssets, uploadingAssets } from '$lib/services/assets';
import { selectedAssetFolder } from '$lib/services/assets/folders';
import { browsedDirPath, getDirName, getSubfolders } from '$lib/services/assets/subfolders';
import { filterAssets } from '$lib/services/assets/view/filter';
import { groupAssets } from '$lib/services/assets/view/group';
import { assetListSettings, currentView, initSettings } from '$lib/services/assets/view/settings';
import { sortAssets } from '$lib/services/assets/view/sort';
import { backend } from '$lib/services/backends';
import { getCollection, getCollectionLabel } from '$lib/services/contents/collection';
import { getCollectionFile, getCollectionFileLabel } from '$lib/services/contents/collection/files';
import { prefs } from '$lib/services/user/prefs.svelte';
import {
  createDerivedState,
  createRawState,
  createRootEffect,
  createStableDerivedState,
} from '$lib/services/utils/state.svelte';

/**
 * @import { Asset, AssetFolderInfo } from '$lib/types/private';
 */

/**
 * Whether the asset details overlay is shown.
 */
export const showAssetOverlay = createRawState(false);

/**
 * Whether to show the Upload Assets dialog.
 */
export const showUploadAssetsDialog = createRawState(false);

/**
 * Whether to show the New Folder dialog.
 */
export const showNewSubfolderDialog = createRawState(false);

/**
 * Whether to show the Upload Assets confirmation dialog.
 */
export const showUploadAssetsConfirmDialog = createDerivedState(
  () => !!uploadingAssets.current.files.length,
);

/**
 * Get the label for the given collection. It can be a category name if the folder is a
 * collection-specific asset folder.
 * @param {AssetFolderInfo} folder Folder info.
 * @returns {string} Human-readable label.
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 * @see https://sveltiacms.app/en/docs/media/internal
 */
export const getFolderLabelByCollection = ({ label, collectionName, fileName, internalPath }) => {
  if (label) {
    return label;
  }

  if (collectionName === undefined) {
    return _(internalPath === undefined ? 'all_assets' : 'global_assets');
  }

  const collection = getCollection(collectionName);
  const collectionLabel = collection ? getCollectionLabel(collection) : collectionName;

  if (!fileName) {
    return collectionLabel;
  }

  const file = collection ? getCollectionFile(collection, fileName) : undefined;
  const fileLabel = file ? getCollectionFileLabel(file) : fileName;

  return `${collectionLabel} › ${fileLabel}`;
};

/**
 * List of all the assets in the selected asset folder, including those in its subfolders.
 */
export const selectedFolderAssets = createDerivedState(() => {
  const { current: _allAssets } = publishedAssets;
  const { current: _selectedAssetFolder } = selectedAssetFolder;

  if (_allAssets && _selectedAssetFolder && _selectedAssetFolder.internalPath !== undefined) {
    // An asset’s folder is usually the very object the selection was made from, so identity
    // settles it without walking the folder; the deep comparison is the fallback for a folder
    // restored from `window.history.state`, which is an equal but separate object.
    return _allAssets.filter(
      ({ folder }) => folder === _selectedAssetFolder || equal(folder, _selectedAssetFolder),
    );
  }

  return _allAssets ? [..._allAssets] : [];
});

/**
 * List of the assets shown for the selected asset folder: the assets right in the directory being
 * browsed, the ones in its subfolders being reached through {@link listedSubfolders}. Every asset
 * below the folder is listed at once when the folder can’t be browsed by subfolder.
 */
export const listedAssets = createDerivedState(() => {
  const assets = selectedFolderAssets.current;
  const dirPath = browsedDirPath.current;

  if (dirPath === undefined) {
    return assets;
  }

  return assets.filter(({ path }) => getDirName(path) === dirPath);
});

/**
 * Subfolders of the directory being browsed, listed ahead of the assets. Empty unless the selected
 * asset folder is browsed by subfolder.
 */
export const listedSubfolders = createDerivedState(() => {
  const dirPath = browsedDirPath.current;

  return dirPath === undefined
    ? []
    : getSubfolders({ dirPath, assets: selectedFolderAssets.current });
});

/**
 * Map from asset path to the asset’s row index in the list, used by list rows to resolve their
 * `aria-rowindex` in O(1). The subfolders come first, so the index of an asset in
 * {@link listedAssets} is offset by their count. Rows are appended by an infinite scroller and
 * never unmounted, so once a large folder has been scrolled through, an `indexOf()` per row would
 * make every subsequent list update O(n²).
 */
export const listedAssetIndexMap = createDerivedState(() => {
  const offset = listedSubfolders.current.length;

  return new Map(listedAssets.current.map((asset, index) => [asset.path, index + offset]));
});

/**
 * Find the assets listed right before and after the given one, for the previous/next navigation in
 * the details overlay. The list is the one the user sees, so the neighbors follow the current
 * sorting, filtering and grouping.
 * @template T
 * @param {T[]} assets Listed assets.
 * @param {(asset: T) => boolean} isCurrent Whether an asset is the one shown in the overlay.
 * @returns {{ previous?: T, next?: T }} Neighbors, each omitted when the current asset is the first
 * or last one, or when it isn’t listed at all.
 */
export const getAdjacentAssets = (assets, isCurrent) => {
  const index = assets.findIndex(isCurrent);

  if (index === -1) {
    return {};
  }

  return { previous: assets[index - 1], next: assets[index + 1] };
};

/**
 * Last computed value of {@link assetGroups}, reused when the new value is deeply equal, so that
 * the list is not re-rendered needlessly.
 * @type {Record<string, Asset[]>}
 */
let previousAssetGroups = {};
/**
 * Sorting conditions of the current view. This and the other view conditions below are picked out
 * of {@link currentView} one by one, so replacing the view to switch between list and grid, or to
 * collapse a group, doesn’t sort, filter and group the assets all over again: each step only
 * reruns when the conditions it uses have actually changed.
 */
const sortConditions = createStableDerivedState(() => currentView.current.sort);
/**
 * Filtering conditions of the current view. See {@link sortConditions}.
 */
const filterConditions = createStableDerivedState(() => currentView.current.filter);
/**
 * Grouping conditions of the current view. See {@link sortConditions}.
 */
const groupConditions = createStableDerivedState(() => currentView.current.group);

/**
 * {@link listedAssets} sorted with the current view’s conditions. Sorting is the costliest step, so
 * it comes first: changing a filter then only reruns the cheaper steps below.
 * @type {{ readonly current: Asset[] }}
 */
const sortedAssets = createDerivedState(() =>
  sortAssets(listedAssets.current, sortConditions.current),
);

/**
 * {@link sortedAssets} filtered with the current view’s conditions.
 * @type {{ readonly current: Asset[] }}
 */
const filteredAssets = createDerivedState(() =>
  filterAssets(sortedAssets.current, filterConditions.current),
);

/**
 * Sorted, filtered and grouped assets for the selected asset collection.
 * @type {{ readonly current: Record<string, Asset[]> }}
 */
export const assetGroups = createDerivedState(() => {
  const groups = groupAssets(filteredAssets.current, groupConditions.current);

  if (!equal(previousAssetGroups, groups)) {
    previousAssetGroups = groups;
  }

  return previousAssetGroups;
});

createRootEffect(() => {
  const { current: _backend } = backend;

  if (_backend && !untrack(() => assetListSettings.current)) {
    initSettings(_backend);
  }
});

createRootEffect(() => {
  const assets = listedAssets.current;

  selectedAssets.current = [];

  if (untrack(() => prefs.devModeEnabled)) {
    // eslint-disable-next-line no-console
    console.info('listedAssets', assets);
  }
});
