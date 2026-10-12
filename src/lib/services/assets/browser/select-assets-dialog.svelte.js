import { getFolderPublicPath } from '$lib/services/assets/info';
import { canBrowseSubfolders, getRelativePath } from '$lib/services/assets/subfolders';
import {
  allStockAssetProviders,
  getStockAssetMediaLibraryOptions,
} from '$lib/services/integrations/media-libraries/stock';
import { getDirName } from '$lib/services/utils/file';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * AssetLibraryFolderMap,
 * ExternalAsset,
 * MediaLibraryFetchOptions,
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
 * Get the name of the location selected when the dialog opens: the first repository folder
 * offered, or else the first cloud storage service if there are files to be uploaded to it, or else
 * the first external service.
 * @param {object} args Arguments.
 * @param {AssetLibraryFolderMap} args.assetLibraryFolderMap Asset library folder map.
 * @param {boolean} args.isDefaultLibraryEnabled Whether the default media library is enabled.
 * @param {boolean} args.selectFolder Whether a folder is to be selected instead of files.
 * @param {boolean} args.hasPendingFiles Whether files dropped on the field are waiting to be
 * uploaded to a cloud storage service.
 * @param {[string, MediaLibraryService][]} args.cloudServiceEntries Cloud storage services offered.
 * @param {[string, MediaLibraryService][]} args.externalServiceEntries Cloud storage services and
 * stock asset providers offered, sorted by name.
 * @returns {string} Library name. Empty if no location is offered, which is the case when a folder
 * is to be selected but the field has no folder that can be browsed.
 */
export const getInitialLibraryName = ({
  assetLibraryFolderMap,
  isDefaultLibraryEnabled,
  selectFolder,
  hasPendingFiles,
  cloudServiceEntries,
  externalServiceEntries,
}) => {
  const firstDefaultLibraryName = getFirstDefaultLibraryName({
    assetLibraryFolderMap,
    isDefaultLibraryEnabled,
    selectFolder,
  });

  if (firstDefaultLibraryName) {
    return firstDefaultLibraryName;
  }

  // A cloud storage service can take the files to be uploaded
  const [serviceId] = (hasPendingFiles ? cloudServiceEntries[0] : undefined) ??
    externalServiceEntries[0] ?? [''];

  return serviceId;
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

/**
 * Get the selection with a newly selected resource. A single selection is replaced as a whole: the
 * list box only deselects the options it shows, so an earlier pick hidden by a search or left in
 * another folder would otherwise stay selected.
 * @param {object} args Arguments.
 * @param {SelectedResource[]} args.resources Currently selected resources.
 * @param {SelectedResource} args.resource Newly selected resource.
 * @param {(resource: SelectedResource) => boolean} args.isSame Function telling whether a selected
 * resource is the same as the new one, so that it is not listed twice.
 * @param {boolean} [args.multiple] Whether multiple resources can be selected.
 * @returns {SelectedResource[]} New selection.
 */
export const getSelectionWithResource = ({ resources, resource, isSame, multiple = false }) =>
  multiple ? [...resources.filter((r) => !isSame(r)), resource] : [resource];

/**
 * Get the resources selected on a location the user has just switched to. The URL entered under
 * Enter URL is kept while another location is browsed, so it’s selected again on coming back, while
 * the selection made on any other location starts afresh.
 * @param {object} args Arguments.
 * @param {string} args.libraryName Name of the location switched to.
 * @param {string} args.enteredURL URL entered under Enter URL, if any.
 * @returns {SelectedResource[]} Resources.
 */
export const getLocationResources = ({ libraryName, enteredURL }) => {
  const url = libraryName === 'enter-url' ? enteredURL.trim() : '';

  return url ? [{ url }] : [];
};

/**
 * Let a stock asset service know its assets have been inserted, if its API guidelines require it,
 * like Unsplash’s. The requests are not awaited, so they never hold up the insertion.
 * @param {object} args Arguments.
 * @param {MediaLibraryService['trackDownload']} args.trackDownload Service’s function to report a
 * used asset, if any.
 * @param {SelectedResource[]} args.resources Inserted resources.
 * @param {Map<string, ExternalAsset>} args.assets Selected assets, keyed by download URL.
 * @param {MediaLibraryFetchOptions} args.options Options, including the API key.
 */
export const trackInsertedExternalAssets = ({ trackDownload, resources, assets, options }) => {
  if (!trackDownload) {
    return;
  }

  resources.forEach(({ url }) => {
    const asset = url ? assets.get(url) : undefined;

    if (asset) {
      // The service never rejects, but an unexpected error mustn’t surface either
      trackDownload(asset, options).catch(() => {});
    }
  });
};
