import { _ } from '@sveltia/i18n';
import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

import { publishedAssets, selectedAssets, uploadingAssets } from '$lib/services/assets';
import { selectedAssetFolder } from '$lib/services/assets/folders';
import { filterAssets } from '$lib/services/assets/view/filter';
import { groupAssets } from '$lib/services/assets/view/group';
import { assetListSettings, initSettings } from '$lib/services/assets/view/settings';
import { sortAssets } from '$lib/services/assets/view/sort';
import { backend } from '$lib/services/backends';
import { getCollection, getCollectionLabel } from '$lib/services/contents/collection';
import { getCollectionFile, getCollectionFileLabel } from '$lib/services/contents/collection/files';
import { prefs } from '$lib/services/user/prefs.svelte';
import {
  createDerivedState,
  createRawState,
  createRootEffect,
} from '$lib/services/utils/state.svelte';

/**
 * @import { Asset, AssetFolderInfo, AssetListView } from '$lib/types/private';
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
 * Default view settings for the selected asset collection.
 * @type {AssetListView}
 */
export const defaultView = {
  type: 'grid',
  showInfo: true,
  sort: {
    key: 'name',
    order: 'ascending',
  },
};

/**
 * View settings for the selected asset collection.
 * @type {{ current: AssetListView }}
 */
export const currentView = createRawState({ type: 'grid', showInfo: true });

/**
 * List of all the assets for the selected asset collection.
 */
export const listedAssets = createDerivedState(() => {
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
 * Map from asset path to the asset’s index in {@link listedAssets}, used by list rows to resolve
 * their `aria-rowindex` in O(1). Rows are appended by an infinite scroller and never unmounted, so
 * once a large folder has been scrolled through, an `indexOf()` per row would make every subsequent
 * list update O(n²).
 */
export const listedAssetIndexMap = createDerivedState(
  () => new Map(listedAssets.current.map((asset, index) => [asset.path, index])),
);

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
 * Sorted, filtered and grouped assets for the selected asset collection.
 * @type {{ readonly current: Record<string, Asset[]> }}
 */
export const assetGroups = createDerivedState(() => {
  const { current: _currentView } = currentView;
  /** @type {Asset[]} */
  let assets = [...listedAssets.current];

  assets = sortAssets(assets, _currentView.sort);
  assets = filterAssets(assets, _currentView.filter);

  const groups = groupAssets(assets, _currentView.group);

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
