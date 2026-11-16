import { hasAuthInfo, selectedExternalAssets } from '$lib/services/assets/external';
import { assetsLocked, canCreateAsset, hasReadonlyAsset } from '$lib/services/assets/folders';
import { isCmsFolderPath } from '$lib/services/assets/reserved';
import { selectedAssets } from '$lib/services/assets/state';
import { getDirName } from '$lib/services/utils/file';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * AssetMoveRequest,
 * ExternalAsset,
 * MediaLibraryService,
 * } from '$lib/types/private';
 */

/**
 * Get the assets that moving to the given directory would actually move, leaving out those that
 * are already there.
 * @param {object} args Arguments.
 * @param {Asset[]} args.assets Assets to be moved.
 * @param {string} args.dirPath Destination directory path.
 * @returns {Asset[]} Assets.
 */
export const getMovableAssets = ({ assets, dirPath }) =>
  assets.filter(({ path }) => getDirName(path) !== dirPath);

/**
 * Whether the given assets can be moved at all: the media library can be changed, and none of the
 * assets is read-only or in a folder the CMS is served from.
 * @param {Asset[]} assets Assets.
 * @returns {boolean} Result.
 */
export const canMoveAssets = (assets) =>
  !!assets.length && !assetsLocked.current && !hasReadonlyAsset(assets);

/**
 * Whether files can be moved to the given cloud storage service: it takes uploads, and the user has
 * entered the credentials for it. The Cloudinary widget handles uploads on its own, so Cloudinary
 * can’t take the files.
 * @param {MediaLibraryService} service Service.
 * @returns {boolean} Result.
 */
export const canMoveToService = (service) => !!service.upload && hasAuthInfo(service);

/**
 * Whether files can be moved to a repository directory: one files can be added to, outside the
 * folders the CMS is served from.
 * @param {AssetFolderInfo | undefined} folder Asset folder the directory belongs to.
 * @param {string} dirPath Directory path.
 * @returns {boolean} Result.
 */
const canMoveToFolder = (folder, dirPath) =>
  !!folder && canCreateAsset(folder) && !isCmsFolderPath(dirPath);

/**
 * Whether the given assets can be moved to a directory, as when they’re dropped on it: they can be
 * moved at all, and the directory can take them. A repository directory has to be one files can be
 * added to, and at least one of the assets mustn’t be there already; a name conflict doesn’t count
 * here, as the Move dialog reports it. A cloud storage service has to take uploads, and the user
 * has to have entered the credentials for it.
 * @param {object} args Arguments.
 * @param {Asset[]} args.assets Assets.
 * @param {AssetFolderInfo} [args.folder] Asset folder the directory belongs to, for a repository
 * directory.
 * @param {MediaLibraryService} [args.service] Cloud storage service, for a folder on it.
 * @param {string} args.dirPath Directory path.
 * @returns {boolean} Result.
 */
export const canMoveAssetsTo = ({ assets, folder, service, dirPath }) => {
  if (!canMoveAssets(assets)) {
    return false;
  }

  if (service) {
    return canMoveToService(service);
  }

  return canMoveToFolder(folder, dirPath) && !!getMovableAssets({ assets, dirPath }).length;
};

/**
 * Whether the given files on a cloud storage service can be moved elsewhere: the service can delete
 * them once they have been copied, and the media library can be changed, as the entries using them
 * are updated.
 * @param {MediaLibraryService} service Service the files are on.
 * @param {ExternalAsset[]} assets Files.
 * @returns {boolean} Result.
 */
export const canMoveExternalAssets = (service, assets) =>
  !!assets.length && !assetsLocked.current && !!service.delete;

/**
 * Get the files on a cloud storage service that moving to the given destination would actually
 * move. On the same service, the files already in the folder stay where they are, and nothing is
 * moved if the service can’t move a file, as one without folders can’t, or list a folder in full,
 * which tells the names taken there.
 * @param {object} args Arguments.
 * @param {ExternalAsset[]} args.assets Files.
 * @param {MediaLibraryService} args.service Service the files are on.
 * @param {{ service?: MediaLibraryService, dirPath: string }} args.destination Destination: a
 * folder on a service, or a repository directory, which has no service.
 * @returns {ExternalAsset[]} Files.
 */
export const getMovableExternalAssets = ({ assets, service, destination }) => {
  if (destination.service?.serviceId !== service.serviceId) {
    return assets;
  }

  return service.move && service.listFolder
    ? assets.filter(({ description }) => getDirName(description) !== destination.dirPath)
    : [];
};

/**
 * Get the files dragged along with the given one from the asset list: every selected file if the
 * file is part of the selection, or the file alone otherwise.
 * @template {{ path?: string, id?: string }} T
 * @param {T} file File whose row the drag starts from.
 * @param {T[]} selectedFiles Selected files.
 * @param {(file: T) => string | undefined} getKey Function telling the files apart.
 * @returns {T[]} Files.
 */
const getDraggedFiles = (file, selectedFiles, getKey) =>
  selectedFiles.some((selected) => getKey(selected) === getKey(file)) ? [...selectedFiles] : [file];

/**
 * Get the request to move the repository assets dragged along with the given one from the asset
 * list: every selected asset if the asset is part of the selection, or the asset alone otherwise.
 * @param {Asset} asset Asset whose row the drag starts from.
 * @returns {AssetMoveRequest | undefined} Request, or `undefined` if the assets can’t be moved.
 */
export const getDraggedAssets = (asset) => {
  const assets = getDraggedFiles(asset, selectedAssets.current, ({ path }) => path);

  return canMoveAssets(assets) ? { assets } : undefined;
};

/**
 * Get the request to move the files on a cloud storage service dragged along with the given one
 * from the asset list: every selected file if the file is part of the selection, or the file alone
 * otherwise.
 * @param {ExternalAsset} asset File whose row the drag starts from.
 * @param {MediaLibraryService} service Service the file is on.
 * @returns {AssetMoveRequest | undefined} Request, or `undefined` if the files can’t be moved.
 */
export const getDraggedExternalAssets = (asset, service) => {
  const externalAssets = getDraggedFiles(asset, selectedExternalAssets.current, ({ id }) => id);

  return canMoveExternalAssets(service, externalAssets) ? { externalAssets, service } : undefined;
};

/**
 * Whether the dragged files can be moved to a directory, as when they’re dropped on it. Repository
 * assets are checked as {@link canMoveAssetsTo} does. Files on a cloud storage service can go to a
 * repository directory files can be added to, or to a service that takes uploads and that the user
 * has entered the credentials for; on their own service, at least one of them mustn’t be in the
 * folder already.
 * @param {object} args Arguments.
 * @param {AssetMoveRequest | undefined} args.request Dragged files, if any.
 * @param {AssetFolderInfo} [args.folder] Asset folder the directory belongs to, for a repository
 * directory.
 * @param {MediaLibraryService} [args.service] Cloud storage service, for a folder on it.
 * @param {string} args.dirPath Directory path.
 * @returns {boolean} Result.
 */
export const canMoveRequestTo = ({ request, folder, service, dirPath }) => {
  if (!request) {
    return false;
  }

  const { assets = [], externalAssets = [], service: sourceService } = request;

  if (!sourceService) {
    return canMoveAssetsTo({ assets, folder, service, dirPath });
  }

  if (!canMoveExternalAssets(sourceService, externalAssets)) {
    return false;
  }

  if (service) {
    return (
      canMoveToService(service) &&
      !!getMovableExternalAssets({
        assets: externalAssets,
        service: sourceService,
        destination: { service, dirPath },
      }).length
    );
  }

  return canMoveToFolder(folder, dirPath);
};
