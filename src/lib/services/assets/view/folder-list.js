import { allAssetFolders } from '$lib/services/assets/folders';
import { getCollection, getCollectionIndex } from '$lib/services/contents/collection';
import { getCollectionFile, getCollectionFileIndex } from '$lib/services/contents/collection/files';

/**
 * @import { AssetFolderInfo } from '$lib/types/private';
 */

/**
 * Get the asset folders listed in the Asset Library sidebar, in the order they appear there: All
 * Assets and Global Assets, then the collection-level and file-level folders in the order of the
 * collections and files in the configuration, then the asset collections. Field-level folders
 * aren’t listed.
 * @returns {AssetFolderInfo[]} Folders.
 */
export const getListedAssetFolders = () => [
  ...allAssetFolders.current
    .filter(
      ({ typedKeyPath, isAssetCollection }) => !isAssetCollection && typedKeyPath === undefined,
    )
    .sort(
      (a, b) =>
        getCollectionFileIndex(a.collectionName, a.fileName) -
        getCollectionFileIndex(b.collectionName, b.fileName),
    )
    .sort((a, b) => getCollectionIndex(a.collectionName) - getCollectionIndex(b.collectionName)),
  ...allAssetFolders.current.filter(({ isAssetCollection }) => isAssetCollection),
];

/**
 * Get the icon of an asset folder: its own, or else that of the collection file or collection it
 * belongs to, or a plain folder.
 * @param {AssetFolderInfo} folder Folder.
 * @returns {string} Material Symbols icon name.
 */
export const getAssetFolderIcon = (folder) => {
  const { icon, collectionName, fileName } = folder;
  const collection = collectionName ? getCollection(collectionName) : undefined;

  const collectionFile =
    collection && fileName ? getCollectionFile(collection, fileName) : undefined;

  return icon || collectionFile?.icon || collection?.icon || 'folder';
};
