import { _ } from '@sveltia/i18n';
import { untrack } from 'svelte';

import {
  externalAssets,
  externalAssetSearchTerms,
  externalFolders,
  focusedExternalSubfolder,
  hasFolderSupport,
  pruneExternalAssetSelection,
  selectedCloudService,
  selectedExternalDirPath,
} from '$lib/services/assets/external';
import { LINKED_FILES_SERVICE_ID } from '$lib/services/assets/external/linked';
import { getDirName, listSubfolders } from '$lib/services/assets/subfolders';
import { currentView } from '$lib/services/assets/view/settings';
import { groupItems, sortItemsByKey } from '$lib/services/common/view';
import { getNormalizedValueCache, hasMatch, normalize } from '$lib/services/search/util';
import {
  createDerivedState,
  createRootEffect,
  createStableDerivedState,
} from '$lib/services/utils/state.svelte';

/**
 * @import {
 * AssetFolderSummary,
 * AssetSubfolder,
 * ExternalAsset,
 * FilteringConditions,
 * GroupingConditions,
 * SortingConditions,
 * SortKey,
 * } from '$lib/types/private';
 * @import { ViewGroup } from '$lib/types/public';
 */

/**
 * Keys the assets on a cloud storage service can be sorted by, and the value types that determine
 * the wording of the sort order labels. Unlike repository assets, these don’t have commit info, but
 * the services report when a file was last modified and its size.
 * @type {Record<string, 'date' | 'number' | undefined>}
 */
const EXTERNAL_ASSET_SORT_KEY_TYPES = {
  name: undefined,
  last_modified: 'date',
  size: 'number',
};

/**
 * Keys the assets on a cloud storage service can be sorted by.
 */
export const EXTERNAL_ASSET_SORT_KEYS = Object.keys(EXTERNAL_ASSET_SORT_KEY_TYPES);

/**
 * List of available sort keys with localized labels. `_()` reads the current app locale, so the
 * list is recomputed when the locale changes.
 * @type {{ readonly current: SortKey[] }}
 */
export const externalAssetSortKeys = createDerivedState(() =>
  Object.entries(EXTERNAL_ASSET_SORT_KEY_TYPES).map(([key, type]) => ({
    key,
    label: _(`sort_keys.${key}`),
    type,
  })),
);

/**
 * Get an asset’s property value for sorting.
 * @param {ExternalAsset} asset Asset.
 * @param {string} key Sort key.
 * @returns {string | number} Value.
 */
export const getSortValue = (asset, key) => {
  if (key === 'last_modified') {
    return asset.lastModified?.getTime() ?? 0;
  }

  if (key === 'size') {
    return asset.size ?? 0;
  }

  // Exclude the file extension when sorting by name to sort numbered files properly, e.g.
  // `hero.png`, `hero-1.png`, `hero-2.png` instead of `hero-1.png`, `hero-2.png`, `hero.png`
  return asset.fileName.split('.')[0];
};

/**
 * Sort the given assets.
 * @param {ExternalAsset[]} assets Asset list.
 * @param {SortingConditions} [conditions] Sorting conditions.
 * @returns {ExternalAsset[]} Sorted asset list.
 */
export const sortExternalAssets = (assets, { key, order } = {}) => {
  if (!key || !order || !EXTERNAL_ASSET_SORT_KEYS.includes(key)) {
    return assets;
  }

  return sortItemsByKey([...assets], (asset) => getSortValue(asset, key), key === 'name', order);
};

/**
 * Filter the given assets. Only the `fileType` filter shown in the Asset Library is supported.
 * @param {ExternalAsset[]} assets Asset list.
 * @param {FilteringConditions} [conditions] Filtering conditions.
 * @returns {ExternalAsset[]} Filtered asset list.
 */
export const filterExternalAssets = (assets, { field, pattern } = { field: '', pattern: '' }) => {
  if (field !== 'fileType') {
    return assets;
  }

  return assets.filter(({ kind }) => kind === pattern);
};

/**
 * Get an asset’s property value for grouping. Only the `domain` of the file’s URL is supported: the
 * files linked from entries can be hosted anywhere, and a long list is easier to go through host by
 * host.
 * @param {ExternalAsset} asset Asset.
 * @param {string} field Group field.
 * @returns {string | undefined} Value, or `undefined` if the field is unknown or the URL can’t be
 * parsed, so that the asset goes to the Other group.
 */
export const getGroupValue = (asset, field) => {
  if (field !== 'domain') {
    return undefined;
  }

  try {
    return new URL(asset.downloadURL).hostname;
  } catch {
    return undefined;
  }
};

/**
 * Group the given assets.
 * @param {ExternalAsset[]} assets Asset list.
 * @param {GroupingConditions | null} [conditions] Grouping conditions.
 * @returns {Record<string, ExternalAsset[]>} Grouped assets, where key is a group name, displayed
 * with `getGroupLabel()`, and value is an asset list. Without conditions, all the assets are in a
 * single group named `*`.
 */
export const groupExternalAssets = (assets, conditions) =>
  groupItems(assets, conditions, getGroupValue);

/**
 * Grouping options offered for the selected location. The files linked from entries can be grouped
 * by domain; the files on a cloud storage service are all on the same host, so they have none.
 * `_()` reads the current app locale, so the list is recomputed when the locale changes.
 * @type {{ readonly current: ViewGroup[] }}
 */
export const externalAssetViewGroups = createDerivedState(() =>
  selectedCloudService.current?.serviceId === LINKED_FILES_SERVICE_ID
    ? [{ label: _('domain'), field: 'domain' }]
    : [],
);

/**
 * Narrow down the given assets by the search terms. The file name and description, which is the
 * path of the file on the service, are matched.
 * @param {ExternalAsset[]} assets Asset list.
 * @param {string} terms Search terms.
 * @returns {ExternalAsset[]} Matching asset list.
 */
export const searchExternalAssets = (assets, terms) => {
  const normalizedTerms = normalize(terms);

  if (!normalizedTerms) {
    return assets;
  }

  // The normalized names are kept with each asset, as the search runs on every keystroke
  return assets.filter((asset) => {
    const normalizedValueCache = getNormalizedValueCache(asset);

    return (
      hasMatch({ value: asset.fileName, terms: normalizedTerms, normalizedValueCache }) ||
      hasMatch({ value: asset.description, terms: normalizedTerms, normalizedValueCache })
    );
  });
};

/**
 * List the immediate subfolders of a folder on a cloud storage service with folder support, read
 * off the paths of the files below it and the empty folders kept by a placeholder.
 * @param {object} args Arguments.
 * @param {string} args.dirPath Folder path relative to the configured prefix. An empty string for
 * the root.
 * @param {ExternalAsset[]} args.assets Assets on the service, whose `description` is the file path.
 * @param {string[]} args.folders Paths of the empty folders on the service.
 * @returns {AssetSubfolder[]} Subfolders, sorted by name.
 */
export const getExternalSubfolders = ({ dirPath, assets, folders }) =>
  listSubfolders({
    dirPath,
    paths: [
      ...assets.map(({ description }) => description),
      // An empty folder is given with a trailing slash, as it has no file to be read off
      ...folders.map((path) => `${path}/`),
    ],
  });

/**
 * Get the assets right in a folder on a cloud storage service with folder support, leaving out the
 * ones in its subfolders.
 * @param {object} args Arguments.
 * @param {string} args.dirPath Folder path relative to the configured prefix. An empty string for
 * the root.
 * @param {ExternalAsset[]} args.assets Assets on the service, whose `description` is the file path.
 * @returns {ExternalAsset[]} Assets in the folder.
 */
export const getExternalAssetsInDir = ({ dirPath, assets }) =>
  assets.filter(({ description }) => getDirName(description) === dirPath);

/**
 * Get the label of a folder on a cloud storage service, which is the folder path, or the service
 * name at the root.
 * @param {object} args Arguments.
 * @param {string} args.dirPath Folder path relative to the configured prefix. An empty string for
 * the root.
 * @param {string} args.serviceLabel Service name.
 * @returns {string} Label, e.g. `/images/2024` or `Amazon S3`.
 */
export const getExternalFolderLabel = ({ dirPath, serviceLabel }) =>
  dirPath ? `/${dirPath}` : serviceLabel;

/**
 * Whether the selected cloud storage service is being browsed folder by folder: it has folder
 * support, and nothing is being searched for. A search looks through the whole service instead,
 * listing the matches with their paths.
 * @type {{ readonly current: boolean }}
 */
export const browsingExternalFolders = createDerivedState(
  () => hasFolderSupport(selectedCloudService.current) && !externalAssetSearchTerms.current,
);

/**
 * Subfolders of the folder being browsed on the selected cloud storage service, listed ahead of
 * the assets. Empty unless the service is browsed folder by folder.
 * @type {{ readonly current: AssetSubfolder[] }}
 */
export const listedExternalSubfolders = createDerivedState(() => {
  if (!browsingExternalFolders.current) {
    return [];
  }

  return getExternalSubfolders({
    dirPath: selectedExternalDirPath.current,
    assets: externalAssets.current ?? [],
    folders: externalFolders.current,
  });
});

/**
 * Sorting conditions of the current view. This and the filtering conditions below are picked out
 * of {@link currentView} one by one, so replacing the view to switch between list and grid, or to
 * group the assets, doesn’t sort and filter them all over again.
 */
const sortConditions = createStableDerivedState(() => currentView.current.sort);
/**
 * Filtering conditions of the current view. See {@link sortConditions}.
 */
const filterConditions = createStableDerivedState(() => currentView.current.filter);

/**
 * Sorted and filtered assets on the selected cloud storage service. While the service is browsed
 * folder by folder, only the assets right in the folder being browsed are listed. Sorting is the
 * costliest step, so it’s done here rather than after the search, which runs on every keystroke.
 * @type {{ readonly current: ExternalAsset[] }}
 */
const sortedExternalAssets = createDerivedState(() => {
  let assets = externalAssets.current ?? [];

  if (browsingExternalFolders.current) {
    assets = getExternalAssetsInDir({ dirPath: selectedExternalDirPath.current, assets });
  }

  return filterExternalAssets(
    sortExternalAssets(assets, sortConditions.current),
    filterConditions.current,
  );
});

/**
 * Sorted, filtered and searched assets on the selected cloud storage service. The Asset Library’s
 * {@link currentView} is shared with repository folders, so the view type, sort order and file
 * type filter are remembered per service just like per folder.
 * @type {{ readonly current: ExternalAsset[] }}
 */
export const listedExternalAssets = createDerivedState(() =>
  searchExternalAssets(sortedExternalAssets.current, externalAssetSearchTerms.current),
);

/**
 * What the folder info panel describes: the focused subfolder, or the folder being browsed on the
 * selected cloud storage service — the service itself at the root.
 * @type {{ readonly current: AssetFolderSummary | undefined }}
 */
export const externalFolderSummary = createDerivedState(() => {
  const subfolder = focusedExternalSubfolder.current;

  if (subfolder) {
    const { name, path } = subfolder;
    const assets = externalAssets.current ?? [];

    return {
      name,
      path,
      folderCount: getExternalSubfolders({
        dirPath: path,
        assets,
        folders: externalFolders.current,
      }).length,
      assetCount: getExternalAssetsInDir({ dirPath: path, assets }).length,
    };
  }

  const service = selectedCloudService.current;

  // The panel is only shown with a service selected
  if (!service) {
    return undefined;
  }

  // A search looks through the whole service rather than the folder being browsed
  const browsing = browsingExternalFolders.current;
  const dirPath = browsing ? selectedExternalDirPath.current : '';

  return {
    name: dirPath.split('/').at(-1) || service.serviceLabel,
    // The service root has no path of its own
    path: dirPath || undefined,
    folderCount: browsing ? listedExternalSubfolders.current.length : undefined,
    assetCount: listedExternalAssets.current.length,
  };
});

/**
 * {@link listedExternalAssets} grouped as the list shows them.
 * @type {{ readonly current: Record<string, ExternalAsset[]> }}
 */
export const externalAssetGroups = createDerivedState(() =>
  groupExternalAssets(listedExternalAssets.current, currentView.current.group),
);

/**
 * Drop the selected and focused assets that are no longer listed, so that the toolbar actions
 * never operate on an asset the user can’t see, e.g. one hidden by the search terms or the file
 * type filter. The selection survives a change of the sort order, as the assets stay listed.
 */
export const pruneHiddenAssets = () => {
  const listedIds = new Set(listedExternalAssets.current.map(({ id }) => id));

  untrack(() => pruneExternalAssetSelection((id) => listedIds.has(id)));
};

createRootEffect(pruneHiddenAssets);
