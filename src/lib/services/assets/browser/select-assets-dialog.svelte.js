import { getFolderPublicPath } from '$lib/services/assets/info';
import { canBrowseSubfolders, getDirName, getRelativePath } from '$lib/services/assets/subfolders';
import {
  allStockAssetProviders,
  getStockAssetMediaLibraryOptions,
} from '$lib/services/integrations/media-libraries/stock';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * AssetLibraryFolderMap,
 * MediaLibraryService,
 * SelectedResource,
 * } from '$lib/types/private';
 * @import { MediaField, StockAssetProviderName } from '$lib/types/public';
 */

/**
 * Sort services by their label in alphabetical order.
 * @param {[string, { serviceLabel: string }]} a First service entry.
 * @param {[string, { serviceLabel: string }]} b Second service entry.
 * @returns {number} Sorting order value.
 */
export const sortServicesByName = (a, b) => {
  const nameA = a[1].serviceLabel.toLowerCase();
  const nameB = b[1].serviceLabel.toLowerCase();

  return nameA.localeCompare(nameB);
};

/**
 * Check if a repository folder is offered in the Select Assets dialog. Folder selection takes a
 * folder that can be browsed by subfolder.
 * @param {{ folder: AssetFolderInfo | undefined, enabled: boolean }} entry Folder map entry.
 * @param {boolean} selectFolder Whether a folder is to be selected instead of files.
 * @returns {boolean} Result.
 */
export const isFolderOffered = ({ folder, enabled }, selectFolder) =>
  enabled && (!selectFolder || canBrowseSubfolders(folder));

/**
 * Get the name of the first repository folder offered in the dialog, which is selected when the
 * dialog opens.
 * @param {object} args Arguments.
 * @param {AssetLibraryFolderMap} args.assetLibraryFolderMap Asset library folder map.
 * @param {boolean} args.isDefaultLibraryEnabled Whether the default media library is enabled.
 * @param {boolean} args.selectFolder Whether a folder is to be selected instead of files.
 * @returns {string | undefined} Library name, e.g. `default-collection`, or `undefined` if no
 * folder is offered.
 */
export const getFirstDefaultLibraryName = ({
  assetLibraryFolderMap,
  isDefaultLibraryEnabled,
  selectFolder,
}) => {
  if (!isDefaultLibraryEnabled) {
    return undefined;
  }

  const id = Object.entries(assetLibraryFolderMap).find(([, entry]) =>
    isFolderOffered(entry, selectFolder),
  )?.[0];

  return id ? `default-${id}` : undefined;
};

/**
 * Get the stock asset providers offered in the dialog, sorted by name.
 * @param {object} args Arguments.
 * @param {MediaField} [args.fieldConfig] Field configuration.
 * @param {boolean} args.selectFolder Whether a folder is to be selected instead of files. A folder
 * can only be picked from the repository, so no provider is offered then.
 * @param {boolean} args.isDefaultLibraryEnabled Whether the default media library is enabled.
 * @returns {[string, MediaLibraryService][]} Provider entries.
 */
export const getStockAssetProviderEntries = ({
  fieldConfig,
  selectFolder,
  isDefaultLibraryEnabled,
}) => {
  if (selectFolder) {
    return [];
  }

  const { providers = [] } = getStockAssetMediaLibraryOptions({ fieldConfig });

  return Object.entries(allStockAssetProviders)
    .filter(
      ([serviceId, { hotlinking }]) =>
        providers.includes(/** @type {StockAssetProviderName} */ (serviceId)) &&
        // When hotlinking is not required, files are downloaded and then uploaded to the
        // repository, so the default library has to be configured.
        (hotlinking || isDefaultLibraryEnabled),
    )
    .sort(sortServicesByName);
};

/**
 * Get the public paths of the folders to be picked: the selected subfolders, or the directory being
 * browsed.
 * @param {object} args Arguments.
 * @param {boolean} args.selectFolder Whether a folder is to be selected instead of files.
 * @param {boolean} args.browsingSubfolders Whether the selected folder is browsed by subfolder.
 * @param {AssetFolderInfo | undefined} args.folder Selected folder, which is always set while it’s
 * browsed by subfolder.
 * @param {string | undefined} args.basePath Path of the selected folder, which is always set while
 * it’s browsed by subfolder.
 * @param {string} args.subfolderPath Path of the directory being browsed, relative to the folder.
 * @param {string[]} args.selectedSubfolderPaths Paths of the selected subfolders.
 * @returns {string[]} Public paths. Empty unless a folder is to be picked from a folder that can be
 * browsed.
 */
export const getPickedFolderPublicPaths = ({
  selectFolder,
  browsingSubfolders,
  folder,
  basePath,
  subfolderPath,
  selectedSubfolderPaths,
}) => {
  if (!selectFolder || !browsingSubfolders) {
    return [];
  }

  const subfolderPaths = selectedSubfolderPaths.length
    ? selectedSubfolderPaths.map((path) => getRelativePath(path, /** @type {string} */ (basePath)))
    : [subfolderPath];

  return subfolderPaths.map((path) =>
    getFolderPublicPath({ folder: /** @type {AssetFolderInfo} */ (folder), subfolderPath: path }),
  );
};

/**
 * Get the subfolder an unsaved asset is going to be saved to, which its provisional path holds.
 * @param {Asset} asset Unsaved asset.
 * @param {string | undefined} targetFolderPath Path of the target folder.
 * @returns {string} Subfolder path relative to the target folder. Empty for the folder root.
 */
export const getUnsavedAssetSubfolderPath = ({ path }, targetFolderPath) =>
  targetFolderPath !== undefined ? getDirName(getRelativePath(path, targetFolderPath)) : '';

/**
 * Get the resources to hand over to the field once the Insert button is clicked. An unsaved asset
 * becomes the file to be saved, along with its target folder and subfolder.
 * @param {object} args Arguments.
 * @param {SelectedResource[]} args.resources Selected resources.
 * @param {string | undefined} args.targetFolderPath Path of the target folder.
 * @returns {SelectedResource[]} Resources.
 */
export const getInsertedResources = ({ resources, targetFolderPath }) =>
  resources.map((resource) => {
    const { asset, replace } = resource;

    if (!asset?.unsaved) {
      return $state.snapshot(resource);
    }

    // The `File` is taken as is: `$state.snapshot()` would clone it with `structuredClone()`, and
    // the copy would then have to be read and hashed all over again
    return {
      file: asset.file,
      folder: $state.snapshot(asset.folder),
      subfolderPath: getUnsavedAssetSubfolderPath(asset, targetFolderPath),
      replace,
    };
  });
