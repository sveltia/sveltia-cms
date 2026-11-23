import { isAssetInFolder } from '$lib/services/assets';
import { canCreateAsset } from '$lib/services/assets/folders';
import { isCmsFolderPath } from '$lib/services/assets/reserved';
import { publishedAssets } from '$lib/services/assets/state';
import { getSubfolderTree } from '$lib/services/assets/subfolders';
import { getFolderLabelByCollection } from '$lib/services/assets/view';
import { getAssetFolderIcon, getListedAssetFolders } from '$lib/services/assets/view/folder-list';

/**
 * @import { AssetMoveDestination } from '$lib/types/private';
 */

/**
 * Get the directories assets can be moved to: the root of every asset folder files can be uploaded
 * to, in the order the sidebar lists the folders, each with the subfolders below it as a tree.
 * A folder whose path is entry-relative or has template tags is left out, as a file’s path there
 * depends on the entry using it, and so is a read-only folder and one the CMS itself is served
 * from. Folders sharing a path, like an asset collection and the global folder, are the same
 * directory, so only the first is listed.
 * @returns {AssetMoveDestination[]} Destinations.
 */
export const getAssetMoveDestinations = () => {
  /** @type {Set<string>} */
  const seenPaths = new Set();

  return getListedAssetFolders()
    .filter((folder) => {
      const { internalPath } = folder;

      if (
        internalPath === undefined ||
        !canCreateAsset(folder) ||
        isCmsFolderPath(internalPath) ||
        seenPaths.has(internalPath)
      ) {
        return false;
      }

      seenPaths.add(internalPath);

      return true;
    })
    .map((folder) => {
      const rootPath = /** @type {string} */ (folder.internalPath);
      const assets = publishedAssets.current.filter((asset) => isAssetInFolder(asset, folder));
      const getSubfolders = getSubfolderTree({ dirPath: rootPath, assets });

      /**
       * List the subfolders of a directory, each with its own subfolders.
       * @param {string} dirPath Directory path.
       * @returns {AssetMoveDestination[]} Destinations.
       */
      const listChildren = (dirPath) =>
        getSubfolders(dirPath)
          .filter(({ path }) => !isCmsFolderPath(path))
          .map(({ name, path }) => ({
            folder,
            dirPath: path,
            label: name,
            children: listChildren(path),
          }));

      return {
        folder,
        dirPath: rootPath,
        label: getFolderLabelByCollection(folder),
        children: listChildren(rootPath),
      };
    });
};

/**
 * Find the destination for a directory in the given tree.
 * @param {AssetMoveDestination[]} destinations Destinations, as returned by
 * {@link getAssetMoveDestinations} or `getExternalMoveDestinations()`.
 * @param {string} dirPath Directory path.
 * @param {string} [serviceId] ID of the cloud storage service the directory is on, or `undefined`
 * for a repository directory.
 * @returns {AssetMoveDestination | undefined} Destination, if the directory is in the tree.
 */
export const findAssetMoveDestination = (destinations, dirPath, serviceId = undefined) =>
  destinations.reduce(
    (/** @type {AssetMoveDestination | undefined} */ found, destination) =>
      found ??
      (destination.dirPath === dirPath && destination.service?.serviceId === serviceId
        ? destination
        : findAssetMoveDestination(destination.children, dirPath, serviceId)),
    undefined,
  );

/**
 * Whether two destinations are in the same tree: the same cloud storage service, or the same
 * repository asset folder, told apart by its path, as the tree has one folder per path.
 * @param {AssetMoveDestination} a Destination.
 * @param {AssetMoveDestination} b Another destination.
 * @returns {boolean} Result.
 */
const isInSameTree = (a, b) =>
  a.service || b.service
    ? a.service?.serviceId === b.service?.serviceId
    : a.folder?.internalPath === b.folder?.internalPath;

/**
 * Whether two destinations are the same directory.
 * @param {AssetMoveDestination} a Destination.
 * @param {AssetMoveDestination | undefined} b Another destination, if any.
 * @returns {boolean} Result.
 */
export const isSameMoveDestination = (a, b) => !!b && isInSameTree(a, b) && a.dirPath === b.dirPath;

/**
 * Whether a destination is below another one in the tree, at any depth, which keeps the branch
 * holding a selected destination expanded.
 * @param {AssetMoveDestination} ancestor Destination that may hold the other.
 * @param {AssetMoveDestination | undefined} destination Destination, if any.
 * @returns {boolean} Result.
 */
export const isBelowMoveDestination = (ancestor, destination) =>
  !!destination &&
  isInSameTree(ancestor, destination) &&
  destination.dirPath !== ancestor.dirPath &&
  destination.dirPath.startsWith(ancestor.dirPath ? `${ancestor.dirPath}/` : '');

/**
 * Get the icon of a destination: a cloud for a cloud storage service, the folder’s own for the
 * root of a repository asset folder, and a plain folder otherwise.
 * @param {AssetMoveDestination} destination Destination.
 * @returns {string} Material Symbols icon name.
 */
export const getMoveDestinationIcon = (destination) => {
  const { dirPath } = destination;

  if (destination.service) {
    return dirPath ? 'folder' : 'cloud';
  }

  const { folder } = destination;

  return dirPath === folder.internalPath ? getAssetFolderIcon(folder) : 'folder';
};

/**
 * Get a key that tells destinations apart in a list, as a repository directory and a folder on a
 * service can share a path.
 * @param {AssetMoveDestination} destination Destination.
 * @returns {string} Key.
 */
export const getMoveDestinationKey = ({ service, dirPath }) =>
  `${service?.serviceId ?? ''}:${dirPath}`;
