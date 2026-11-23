import { compare } from '@sveltia/utils/string';

import {
  enabledCloudServices,
  externalAssets,
  externalFolders,
  getFetchOptions,
  selectedCloudService,
} from '$lib/services/assets/external';
import { canMoveToService } from '$lib/services/assets/movable';
import { getBaseName, getDirName } from '$lib/services/utils/file';

/**
 * @import {
 * AssetMoveDestination,
 * ExternalFolderListing,
 * MediaLibraryService,
 * } from '$lib/types/private';
 */

/**
 * Get the cloud storage services files can be moved to, as {@link canMoveToService} tells.
 * @returns {MediaLibraryService[]} Services.
 */
export const getMoveTargetServices = () => enabledCloudServices.current.filter(canMoveToService);

/**
 * Build the folder tree of a service from the paths of its files and its empty folders.
 * @param {MediaLibraryService} service Service.
 * @param {ExternalFolderListing} listing Files and empty folders on the service.
 * @returns {AssetMoveDestination} Destination for the service root, with the folders below it.
 */
export const buildServiceFolderTree = (service, { assets, folders }) => {
  /** @type {Set<string>} */
  const dirPaths = new Set(['']);

  /**
   * Register a folder and every folder above it.
   * @param {string} dirPath Folder path.
   */
  const addFolder = (dirPath) => {
    if (!dirPaths.has(dirPath)) {
      dirPaths.add(dirPath);
      addFolder(getDirName(dirPath));
    }
  };

  // The path of a file on a service with folder support is its description
  assets.forEach(({ description }) => addFolder(getDirName(description)));
  folders.forEach(addFolder);

  /**
   * Create the destination for a folder, with its subfolders.
   * @param {string} dirPath Folder path.
   * @returns {AssetMoveDestination} Destination.
   */
  const createDestination = (dirPath) => ({
    service,
    dirPath,
    label: dirPath ? getBaseName(dirPath) : service.serviceLabel,
    children: [...dirPaths]
      .filter((path) => path && getDirName(path) === dirPath)
      .sort(compare)
      .map(createDestination),
  });

  return createDestination('');
};

/**
 * Get the listing of a service to build its folder tree from. The listing of the service being
 * browsed is at hand; any other service is listed now. A service without folder support has its
 * root only, and so does one that can’t be listed, as the files can still be uploaded there.
 * @param {MediaLibraryService} service Service.
 * @returns {Promise<ExternalFolderListing>} Files and empty folders.
 */
const getListing = async (service) => {
  if (!service.browse) {
    return { assets: [], folders: [] };
  }

  if (selectedCloudService.current === service && externalAssets.current) {
    return { assets: externalAssets.current, folders: externalFolders.current };
  }

  try {
    return await service.browse(getFetchOptions(service));
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return { assets: [], folders: [] };
  }
};

/**
 * Get the cloud storage services files can be moved to, each with its folders as a tree.
 * @returns {Promise<AssetMoveDestination[]>} Destinations, one per service.
 */
export const getExternalMoveDestinations = async () =>
  Promise.all(
    getMoveTargetServices().map(async (service) =>
      buildServiceFolderTree(service, await getListing(service)),
    ),
  );
