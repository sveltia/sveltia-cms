import { get } from 'svelte/store';

import { getAssetFolder, globalAssetFolder } from '$lib/services/assets/folders';

/**
 * @import { AssetLibraryFolderMap, TypedFieldKeyPath } from '$lib/types/private';
 */

/**
 * Get the default library folder map for a File/Image field.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] File name.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Key path to the field.
 * @param {boolean} [args.isIndexFile] Whether the asset folder is for the special index file used
 * specifically in Hugo. It works only for field-level media folders in an entry collection.
 * @returns {AssetLibraryFolderMap} Default asset library folder map.
 */
export const getAssetLibraryFolderMap = ({
  collectionName,
  fileName,
  typedKeyPath,
  isIndexFile,
}) => {
  const fieldAssetFolder = getAssetFolder({ collectionName, fileName, typedKeyPath, isIndexFile });
  const fileAssetFolder = fileName ? getAssetFolder({ collectionName, fileName }) : undefined;
  const collectionAssetFolder = getAssetFolder({ collectionName });
  const entryAssetFolder = fileAssetFolder ?? collectionAssetFolder;
  const globalFolder = get(globalAssetFolder);

  return {
    field: {
      folder: fieldAssetFolder,
      enabled: fieldAssetFolder !== undefined,
    },
    entry: {
      folder: entryAssetFolder,
      enabled:
        !!entryAssetFolder && (entryAssetFolder.entryRelative || entryAssetFolder.hasTemplateTags),
    },
    file: {
      folder: fileAssetFolder,
      enabled:
        !!fileAssetFolder && !fileAssetFolder.entryRelative && !fileAssetFolder.hasTemplateTags,
    },
    collection: {
      folder: collectionAssetFolder,
      enabled:
        !!collectionAssetFolder &&
        !collectionAssetFolder.entryRelative &&
        !collectionAssetFolder.hasTemplateTags,
    },
    global: {
      folder: globalFolder,
      enabled: globalFolder !== undefined,
    },
  };
};
