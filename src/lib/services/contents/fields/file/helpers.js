import { getHash } from '@sveltia/utils/crypto';
import { getPathInfo } from '@sveltia/utils/file';
import equal from 'fast-deep-equal';
import { get } from 'svelte/store';

import { allAssets, fillInternalPathTemplate } from '$lib/services/assets';
import { allAssetFolders, getAssetFolder, globalAssetFolder } from '$lib/services/assets/folders';
import { hasTemplateTags } from '$lib/services/common/template';
import { TEMPLATE_TAG_REPLACE_REGEX } from '$lib/services/common/template/constants';
import { createPublicURL, getAssetFolderPaths } from '$lib/services/contents/draft/save/assets';
import { getSlugs } from '$lib/services/contents/draft/slugs';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * AssetLibraryFolderMap,
 * Entry,
 * EntryDraft,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 */

/**
 * Regular expression to match empty path segments, which are left when a template tag in a public
 * path cannot be resolved, typically because a field used in the entry slug is still empty.
 * @type {RegExp}
 */
const EMPTY_PATH_SEGMENT_REGEX = /(?<=.)\/(?=\/|$)/g;

/**
 * Get the default library folder map for a File/Image field.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] File name.
 * @param {string} [args.componentName] Custom editor component name for a field-level asset folder.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Key path to the field.
 * @param {boolean} [args.isIndexFile] Whether the asset folder is for the special index file used
 * specifically in Hugo. It works only for field-level media folders in an entry collection.
 * @returns {AssetLibraryFolderMap} Default asset library folder map.
 */
export const getAssetLibraryFolderMap = ({
  collectionName,
  fileName,
  componentName,
  typedKeyPath,
  isIndexFile,
}) => {
  const fieldAssetFolder = getAssetFolder({
    collectionName,
    fileName,
    componentName,
    typedKeyPath,
    isIndexFile,
  });

  const fileAssetFolder = fileName ? getAssetFolder({ collectionName, fileName }) : undefined;
  const collectionAssetFolder = getAssetFolder({ collectionName });
  const entryAssetFolder = fileAssetFolder ?? collectionAssetFolder;
  const globalFolder = get(globalAssetFolder);

  /** @type {AssetLibraryFolderMap} */
  const map = {
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

  // Add asset collection folders
  get(allAssetFolders).forEach((folder) => {
    if (folder.isAssetCollection && folder.collectionName) {
      map[folder.collectionName] = { folder, enabled: true };
    }
  });

  return map;
};

/**
 * Get the default asset library folder for a File/Image field.
 * @param {AssetLibraryFolderMap} folderMap Asset library folder map.
 * @returns {AssetFolderInfo} Default asset library folder.
 */
export const getDefaultAssetFolder = (folderMap) =>
  // There is always at least one enabled folder in the map, so this will never be undefined
  /** @type {AssetFolderInfo} */ (Object.values(folderMap).find(({ enabled }) => enabled)?.folder);

/**
 * Get the target folder path for a File/Image field.
 * @param {object} args Arguments.
 * @param {Entry | undefined} args.entry Original entry.
 * @param {AssetFolderInfo | undefined} args.folder Selected folder.
 * @returns {string | undefined} Target folder path.
 */
export const getTargetFolderPath = ({ entry, folder }) => {
  const { collectionName, entryRelative, internalPath, internalSubPath } = folder ?? {};

  if (!entryRelative) {
    if (internalPath === undefined) {
      return undefined;
    }

    return (
      fillInternalPathTemplate({ internalPath, collectionName, entry }) ??
      // Replace the tags with a placeholder because the complete path is not determined until the
      // entry is saved
      internalPath.replaceAll(TEMPLATE_TAG_REPLACE_REGEX, '-')
    );
  }

  // A non-empty `internalSubPath` means the field has its own `media_folder` subfolder (e.g.
  // `media_folder: "images1"`). Append it so that only assets in that specific subfolder are shown,
  // not assets from sibling field folders (e.g. `images2`).
  const subPath = internalSubPath || undefined;

  if (entry) {
    const entryDir = getPathInfo(Object.values(entry.locales)[0].path).dirname;

    return subPath ? `${entryDir}/${subPath}` : entryDir;
  }

  // Append a placeholder because the complete path is not determined until the entry is saved
  return subPath ? `${internalPath}/${subPath}/-` : `${internalPath}/-`;
};

/**
 * Get the public path to be displayed for a file that has not been saved to the repository yet. An
 * unsaved file is a pending upload cached in the draft and referenced with a temporary blob URL, so
 * the path has to be resolved the same way as it will be when the entry is saved, including any
 * template tags like `{{slug}}` and entry-relative paths.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft holding the file.
 * @param {string} args.blobURL Blob URL of the file, which is the current field value.
 * @param {string} args.fileName File name to be appended to the resolved folder path.
 * @returns {string} Path to be displayed. It’s the file name alone if the target folder is unknown
 * or the public path is empty.
 */
export const getUnsavedFileDisplayPath = ({ draft, blobURL, fileName }) => {
  const { folder } = draft.files[blobURL] ?? {};
  const { entryRelative, publicPath = '' } = folder ?? {};

  // Nothing has to be resolved if the path is absolute and has no template tags
  if (!folder || (!entryRelative && !hasTemplateTags(publicPath))) {
    return createPublicURL(publicPath, fileName);
  }

  const { defaultLocaleSlug } = getSlugs({ draft });
  const { resolvedPublicPath } = getAssetFolderPaths({ draft, defaultLocaleSlug, folder });

  return createPublicURL(resolvedPublicPath.replace(EMPTY_PATH_SEGMENT_REGEX, ''), fileName);
};

/**
 * Check if a given path is in the target folder or its subfolders.
 * @param {object} args Arguments.
 * @param {string} args.path Path to check.
 * @param {string | undefined} args.folderPath Target folder path.
 * @returns {boolean} `true` if the path is in the target folder.
 */
const isInTargetFolder = ({ path, folderPath }) =>
  folderPath !== undefined &&
  (path === folderPath ||
    // Handle the case where the target folder is a template with an unresolved placeholder
    `${path}/-` === folderPath ||
    path.startsWith(`${folderPath}/`));

/**
 * Check if an asset is in the selected folder.
 * @param {object} args Arguments.
 * @param {Asset} args.asset Asset to check.
 * @param {AssetFolderInfo | undefined} args.folder Selected folder.
 * @param {string | undefined} args.folderPath Target folder path.
 * @returns {boolean} `true` if the asset is in the selected folder.
 */
export const isAssetInSelectedFolder = ({ asset, folder, folderPath }) => {
  if (
    folder === undefined ||
    asset.folder?.internalPath !== folder.internalPath ||
    asset.folder?.entryRelative !== folder.entryRelative
  ) {
    return false;
  }

  if (!folder.entryRelative) {
    return isInTargetFolder({ path: asset.path, folderPath });
  }

  const { dirname } = getPathInfo(asset.path);

  if (dirname === undefined) {
    return false;
  }

  return isInTargetFolder({ path: dirname, folderPath });
};

/**
 * Get the list of assets to show in the asset library, filtered by the selected folder and kind.
 * @param {object} args Arguments.
 * @param {'image' | undefined} args.kind Asset kind.
 * @param {AssetFolderInfo | undefined} args.folder Selected folder.
 * @param {string | undefined} args.folderPath Target folder path.
 * @param {Asset[]} args.unsavedAssets Unsaved assets.
 * @returns {Asset[]} List of assets to show in the asset library.
 */
export const listAssets = ({ kind, folder, folderPath, unsavedAssets }) => {
  const availableAssets = [...get(allAssets), ...unsavedAssets]
    .filter((asset) => !kind || kind === asset.kind)
    .sort((a, b) => a.name.localeCompare(b.name))
    // Unsaved assets should go first
    .sort((a, b) => Number(!!b.unsaved) - Number(!!a.unsaved));

  return availableAssets.filter((asset) => isAssetInSelectedFolder({ asset, folder, folderPath }));
};

/**
 * Check if an asset with the same hash and folder already exists in the unsaved assets.
 * @param {object} args Arguments.
 * @param {string} args.hash Hash of the file.
 * @param {AssetFolderInfo | undefined} args.folder Asset folder.
 * @param {Asset[]} args.unsavedAssets Unsaved assets.
 * @returns {Promise<boolean>} `true` if the asset already exists.
 */
export const hasSameAsset = async ({ hash, folder, unsavedAssets }) => {
  const results = await Promise.all(
    unsavedAssets.map(
      async (asset) =>
        !!asset.file && equal(asset.folder, folder) && (await getHash(asset.file)) === hash,
    ),
  );

  return results.includes(true);
};
