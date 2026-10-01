import { _, locale as appLocale } from '@sveltia/i18n';
import { sleep } from '@sveltia/utils/misc';
import equal from 'fast-deep-equal';

import { announcedPageStatus, goto, parseLocation } from '$lib/services/app/navigation';
import {
  enabledCloudServices,
  EXTERNAL_LOCATION_PATH_PREFIX,
  getCloudService,
  getCloudServicePath,
  overlaidExternalAssetId,
  resetExternalAssets,
  selectedCloudService,
} from '$lib/services/assets/external';
import { linkedFilesService } from '$lib/services/assets/external/linked';
import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets/folders';
import { allAssets, overlaidAsset } from '$lib/services/assets/state';
import { resolveAssetFolderPath, selectedSubfolderPath } from '$lib/services/assets/subfolders';
import {
  getFolderLabelByCollection,
  listedAssets,
  showAssetOverlay,
} from '$lib/services/assets/view';
import { isSearchRoute } from '$lib/services/search/navigation';
import { env } from '$lib/services/user/env.svelte';

/**
 * @import { AssetFolderInfo } from '$lib/types/private';
 */

/**
 * What the Asset Library page shows for the current route.
 * @typedef {object} AssetsRouteState
 * @property {boolean} isIndexPage Whether the page shows the asset folder list only, on a small
 * screen.
 * @property {boolean} isSearchPage Whether the page shows the search results.
 * @property {boolean} notFound Whether the page shows the Not Found view, because the route
 * doesn’t address an asset folder or a cloud storage service.
 */

/**
 * Regular expression matching the routes of the Asset Library page.
 */
export const ASSETS_ROUTE_REGEX =
  /^\/assets(?:\/(?<folderPath>.+?)(?:\/(?<fileName>[^/]+\.[A-Za-z0-9]+))?)?$/;

/**
 * Counter to ignore an outdated navigation once a newer one has started.
 */
let navigationCount = 0;

/**
 * Get the label of the selected asset folder. The label is only used for a repository folder, as a
 * cloud storage service has an area of its own. `appLocale.current` is read first, so a derived
 * state calling this is updated once the locale changes, because `getFolderLabelByCollection` can
 * return a localized label.
 * @returns {string} Label, or an empty string if no folder is selected.
 */
export const getSelectedAssetFolderLabel = () =>
  appLocale.current && selectedAssetFolder.current
    ? getFolderLabelByCollection(selectedAssetFolder.current)
    : '';

/**
 * Discard the navigation still in flight, if any, so its delayed announcement is not made. Call
 * this when the Asset Library page is unmounted.
 */
export const discardAssetsNavigation = () => {
  navigationCount += 1;
};

/**
 * Select a cloud storage service listed under External Locations, whose assets are shown in place
 * of a repository folder, and optionally show the details of an asset on the service.
 * @param {AssetsRouteState} state Initial page state.
 * @param {string} serviceId Service ID.
 * @param {string} assetId ID of the asset to be shown in the details overlay, or an empty string.
 * @returns {AssetsRouteState} What the page shows.
 */
const selectCloudService = (state, serviceId, assetId) => {
  const service = getCloudService(serviceId);

  selectedAssetFolder.current = undefined;

  if (!service) {
    selectedCloudService.current = undefined;
    showAssetOverlay.current = false;
    announcedPageStatus.current = _('asset_folder_not_found');

    return { ...state, notFound: true };
  }

  if (selectedCloudService.current !== service) {
    resetExternalAssets();
    selectedCloudService.current = service;
  }

  if (assetId) {
    overlaidExternalAssetId.current = assetId;
    showAssetOverlay.current = true;
    announcedPageStatus.current = _('viewing_x_asset_details', {
      values: { name: assetId.split('/').pop() },
    });
  } else {
    overlaidExternalAssetId.current = undefined;
    showAssetOverlay.current = false;
    announcedPageStatus.current = _('viewing_x_external_location', {
      values: { service: service.serviceLabel },
    });
  }

  return state;
};

/**
 * Resolve the index route, `/assets`, which has no folder path.
 * @param {AssetsRouteState} state Initial page state.
 * @returns {AssetsRouteState} What the page shows.
 */
const resolveIndexRoute = (state) => {
  if (env.isSmallScreen) {
    // Show the asset folder list only
    selectedAssetFolder.current = undefined;
    showAssetOverlay.current = false;
    announcedPageStatus.current = _('viewing_asset_folder_list');

    return { ...state, isIndexPage: true };
  }

  if (allAssetFolders.current.length) {
    // Select All Assets right away, because the redirect below takes effect asynchronously in a
    // view transition, and the folder info panel would be rendered with no folder until then
    selectedAssetFolder.current = /** @type {{ folder: AssetFolderInfo }} */ (
      resolveAssetFolderPath('-/all')
    ).folder;
    selectedSubfolderPath.current = '';
    // Redirect to All Assets
    goto('/assets/-/all');
  } else {
    // No asset folder is configured, so redirect to the first external location, or to the files
    // linked from entries if there is none either
    goto(getCloudServicePath(enabledCloudServices.current[0] ?? linkedFilesService));
  }

  return state;
};

/**
 * Announce the selected asset folder after a moment, unless the user has moved on in the
 * meantime.
 * @param {number} currentCount Value of the navigation counter when the folder was selected.
 */
const announceAssetFolder = async (currentCount) => {
  // Wait for the folder label and the listed assets to be updated
  await sleep(100);

  if (currentCount !== navigationCount) {
    // The user has moved on in the meantime, and the newer navigation has taken over
    return;
  }

  showAssetOverlay.current = false;
  announcedPageStatus.current = _('viewing_x_asset_folder', {
    values: {
      folder: getSelectedAssetFolderLabel(),
      count: listedAssets.current.length,
    },
  });
};

/**
 * Resolve the current URL hash to what the Asset Library page shows: the asset folder list, a
 * folder’s assets, an asset’s details, a cloud storage service, or the search results. The stores
 * that the page and its parts read are updated along the way. When a folder is selected, it’s
 * announced after a moment, unless another navigation has started or
 * {@link discardAssetsNavigation} has been called in the meantime.
 * @returns {AssetsRouteState} What the page shows.
 */
export const resolveAssetsRoute = () => {
  const { path } = parseLocation();
  const match = path.match(ASSETS_ROUTE_REGEX);
  /** @type {AssetsRouteState} */
  const state = { isIndexPage: false, isSearchPage: false, notFound: false };

  navigationCount += 1;

  const currentCount = navigationCount;

  if (!match?.groups) {
    showAssetOverlay.current = false;

    // Check if it’s the search page, which has a different URL pattern (`#/search/{query}`)
    return { ...state, isSearchPage: isSearchRoute(path) }; // Different page
  }

  const { folderPath, fileName } = match.groups;

  if (
    folderPath?.startsWith(EXTERNAL_LOCATION_PATH_PREFIX) &&
    folderPath !== `${EXTERNAL_LOCATION_PATH_PREFIX}all`
  ) {
    // The path is `-/{serviceId}` for the asset list, or `-/{serviceId}/{assetId}` for the asset
    // details. An asset ID can contain slashes, and it doesn’t have to end with a file extension,
    // so the ID is everything after the service ID, whether the regex has split it or not
    const [serviceId, ...rest] = folderPath.slice(EXTERNAL_LOCATION_PATH_PREFIX.length).split('/');

    // Only drop a missing file name: an empty segment is significant, as in `https://`
    return selectCloudService(
      state,
      serviceId,
      [...rest, ...(fileName ? [fileName] : [])].join('/'),
    );
  }

  selectedCloudService.current = undefined;

  if (!folderPath) {
    return resolveIndexRoute(state);
  }

  // The path can also point at a subfolder of a configured folder. An internal path can be shared
  // by multiple collections, files and fields, so the folder passed as history state takes
  // precedence over the lookup by path
  const { folder, subfolderPath = '' } =
    resolveAssetFolderPath(folderPath, window.history.state?.folder) ?? {};

  if (!folder && !fileName) {
    selectedAssetFolder.current = undefined;
    selectedSubfolderPath.current = '';
    showAssetOverlay.current = false;
    announcedPageStatus.current = _('asset_folder_not_found');

    return { ...state, notFound: true }; // Not Found
  }

  if (!folder) {
    // A folder path that comes with a file name doesn’t have to be a configured asset folder,
    // because an asset can live in a subfolder of one. The asset itself is looked up by its full
    // path below, so leave the resolution to that
    selectedAssetFolder.current = undefined;
    selectedSubfolderPath.current = '';
  } else {
    if (!equal(selectedAssetFolder.current, folder)) {
      selectedAssetFolder.current = folder;
    }

    selectedSubfolderPath.current = subfolderPath;
  }

  if (!fileName) {
    // Not awaited: the page shows the folder right away
    announceAssetFolder(currentCount);

    return state;
  }

  overlaidAsset.current = allAssets.current.find(
    (asset) => asset.path === `${folderPath}/${fileName}`,
  );
  announcedPageStatus.current = overlaidAsset.current
    ? _('viewing_x_asset_details', { values: { name: overlaidAsset.current.name } })
    : _('file_not_found');
  showAssetOverlay.current = true;

  return state;
};
