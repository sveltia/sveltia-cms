import equal from 'fast-deep-equal';
import { derived, get, writable } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { allAssets, selectedAssets, uploadingAssets } from '$lib/services/assets';
import { selectedAssetFolder } from '$lib/services/assets/folders';
import { filterAssets } from '$lib/services/assets/view/filter';
import { groupAssets } from '$lib/services/assets/view/group';
import { sortAssets } from '$lib/services/assets/view/sort';
import { getCollection, getCollectionLabel } from '$lib/services/contents/collection';
import { getCollectionFile, getCollectionFileLabel } from '$lib/services/contents/collection/files';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { Asset, AssetFolderInfo, AssetListView } from '$lib/types/private';
 */

/**
 * Whether the asset details overlay is shown.
 * @type {Writable<boolean>}
 */
export const showAssetOverlay = writable(false);

/**
 * Whether to show the Upload Assets dialog.
 */
export const showUploadAssetsDialog = writable(false);

/**
 * @type {Readable<boolean>}
 */
export const showUploadAssetsConfirmDialog = derived(
  [uploadingAssets],
  ([_uploadingAssets], set) => {
    set(!!_uploadingAssets.files.length);
  },
);

/**
 * Get the label for the given collection. It can be a category name if the folder is a
 * collection-specific asset folder.
 * @param {AssetFolderInfo} folder Folder info.
 * @returns {string} Human-readable label.
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 * @see https://sveltiacms.app/en/docs/media/internal
 */
export const getFolderLabelByCollection = ({ collectionName, fileName, internalPath }) => {
  if (collectionName === undefined) {
    return get(_)(internalPath === undefined ? 'all_assets' : 'global_assets');
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
 * @type {Writable<AssetListView>}
 */
export const currentView = writable({ type: 'grid', showInfo: true });

/**
 * List of all the assets for the selected asset collection.
 * @type {Readable<Asset[]>}
 */
export const listedAssets = derived(
  [allAssets, selectedAssetFolder],
  ([_allAssets, _selectedAssetFolder], set) => {
    if (_allAssets && _selectedAssetFolder && _selectedAssetFolder.internalPath !== undefined) {
      set(_allAssets.filter(({ folder }) => equal(folder, _selectedAssetFolder)));
    } else {
      set(_allAssets ? [..._allAssets] : []);
    }
  },
);

/**
 * Sorted, filtered and grouped assets for the selected asset collection.
 * @type {Readable<Record<string, Asset[]>>}
 */
export const assetGroups = derived(
  [listedAssets, currentView],
  ([_listedAssets, _currentView], set) => {
    /** @type {Asset[]} */
    let assets = [..._listedAssets];

    assets = sortAssets(assets, _currentView.sort);
    assets = filterAssets(assets, _currentView.filter);

    const groups = groupAssets(assets, _currentView.group);

    if (!equal(get(assetGroups), groups)) {
      set(groups);
    }
  },
);

listedAssets.subscribe((assets) => {
  selectedAssets.set([]);

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('listedAssets', assets);
  }
});
