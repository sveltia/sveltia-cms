import { assetUpdatesToast } from '$lib/services/assets/data';
import {
  externalAssetCounts,
  externalAssets,
  externalAssetsError,
  externalFolders,
  focusedExternalAsset,
  focusedExternalSubfolder,
  getFetchOptions,
  selectedCloudService,
  selectedExternalAssets,
  selectedExternalDirPath,
} from '$lib/services/assets/external';
import { partitionProcessedFiles, processFile } from '$lib/services/assets/process';
import { cmsConfig } from '$lib/services/config';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { createDeepState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { AssetSubfolder, ExternalAsset, MediaLibraryService } from '$lib/types/private';
 * @import { SharedMediaLibraryOptions } from '$lib/types/public';
 */

/**
 * State of the toast reporting the progress or failure of an operation on a cloud storage service.
 * Successful operations are reported through {@link assetUpdatesToast}, like repository assets.
 * @type {{ current: { show: boolean, status: 'info' | 'error', message: string } }}
 */
export const externalAssetsToast = createDeepState({ show: false, status: 'info', message: '' });

/**
 * Files to be uploaded to the selected cloud storage service. The Asset Library processes these
 * once set, so that files dropped on the list, picked with the Upload button or chosen to replace
 * an existing asset are all handled the same way.
 * @type {{ current: { files: File[], originalAsset?: ExternalAsset } }}
 */
export const uploadingExternalAssets = createRawState({ files: [] });

/**
 * Get the options shared by all the media libraries, which include the file size limit and
 * transformations applied before uploading.
 * @returns {SharedMediaLibraryOptions} Options.
 */
export const getSharedMediaLibraryOptions = () => cmsConfig.current?.media_libraries?.all ?? {};

/**
 * Show the toast reporting an error.
 * @param {string} message Message key.
 * @param {unknown} ex Exception, logged to the console.
 */
const reportError = (message, ex) => {
  externalAssetsToast.current = { show: true, status: 'error', message };
  // eslint-disable-next-line no-console
  console.error(ex);
};

/**
 * Show the toast reporting a successful operation.
 * @param {'saved' | 'renamed' | 'deleted' | 'folderCreated' | 'folderRenamed' | 'folderDeleted'}
 * action Action.
 * @param {number} [count] Number of assets.
 */
const reportSuccess = (action, count = 1) => {
  externalAssetsToast.current.show = false;
  assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, [action]: true, count };
};

/**
 * Replace the asset list and record the number of assets for the sidebar.
 * @param {ExternalAsset[] | undefined} assets Assets, or `undefined` while being fetched.
 */
const setAssets = (assets) => {
  const service = selectedCloudService.current;

  externalAssets.current = assets;

  if (assets && service) {
    externalAssetCounts.current = {
      ...externalAssetCounts.current,
      [service.serviceId]: assets.length,
    };
  }
};

/**
 * Drop the given assets from the list, the selection and the focus, once a deletion has removed
 * them from the service.
 * @param {ExternalAsset[]} assets Assets that no longer exist.
 */
const forgetDeletedAssets = (assets) => {
  const deletedIds = new Set(assets.map(({ id }) => id));

  setAssets(externalAssets.current?.filter(({ id }) => !deletedIds.has(id)));
  selectedExternalAssets.current = selectedExternalAssets.current.filter(
    ({ id }) => !deletedIds.has(id),
  );

  if (focusedExternalAsset.current && deletedIds.has(focusedExternalAsset.current.id)) {
    focusedExternalAsset.current = undefined;
  }
};

/**
 * Replace an asset in the list with an updated one, e.g. after renaming or replacing the file. The
 * focus and selection are updated as well.
 * @param {ExternalAsset} oldAsset Asset to be replaced.
 * @param {ExternalAsset} newAsset Updated asset.
 */
const updateAsset = (oldAsset, newAsset) => {
  /**
   * Swap the asset.
   * @param {ExternalAsset} asset Asset in the list.
   * @returns {ExternalAsset} Updated or unchanged asset.
   */
  const swap = (asset) => (asset.id === oldAsset.id ? newAsset : asset);

  setAssets(externalAssets.current?.map(swap));
  selectedExternalAssets.current = selectedExternalAssets.current.map(swap);

  if (focusedExternalAsset.current?.id === oldAsset.id) {
    focusedExternalAsset.current = newAsset;
  }
};

/**
 * Drop the selected and focused assets, and the focused subfolder, that are no longer in the list,
 * e.g. after the list has been reloaded from the service.
 * @param {ExternalAsset[]} assets Assets in the list.
 * @param {string[]} [folders] Paths of the empty folders in the list.
 */
const pruneSelection = (assets, folders = []) => {
  const ids = new Set(assets.map(({ id }) => id));

  selectedExternalAssets.current = selectedExternalAssets.current.filter(({ id }) => ids.has(id));

  if (focusedExternalAsset.current && !ids.has(focusedExternalAsset.current.id)) {
    focusedExternalAsset.current = undefined;
  }

  const focusedPath = focusedExternalSubfolder.current?.path;

  // A folder exists as long as a file or a placeholder sits below it
  if (
    focusedPath !== undefined &&
    !assets.some(({ description }) => description.startsWith(`${focusedPath}/`)) &&
    !folders.some((path) => path === focusedPath || path.startsWith(`${focusedPath}/`))
  ) {
    focusedExternalSubfolder.current = undefined;
  }
};

/**
 * Sequence number of the latest {@link loadExternalAssets} call, used to ignore the result of an
 * earlier call that is still in flight. A load can be started again while one is pending, e.g. when
 * the API key is saved on every keystroke that matches the service’s key pattern.
 */
let latestLoadId = 0;

/**
 * Fetch the content of an asset on a cloud storage service. Unlike a repository asset, the file is
 * only available at its public URL, so this works only if the service allows cross-origin requests.
 * @param {ExternalAsset} asset Asset.
 * @returns {Promise<Blob>} File content.
 * @throws {Error} If the file could not be fetched.
 */
export const fetchExternalAssetBlob = async ({ downloadURL }) => {
  const response = await fetch(downloadURL);

  if (!response.ok) {
    throw new Error(`The response returned with HTTP status ${response.status}.`);
  }

  return response.blob();
};

/**
 * Fetch the assets on the given cloud storage service and populate the list.
 * @param {MediaLibraryService} service Service.
 */
export const loadExternalAssets = async (service) => {
  latestLoadId += 1;

  const loadId = latestLoadId;

  setAssets(undefined);
  externalAssetsError.current = undefined;

  try {
    const fetchOptions = getFetchOptions(service);

    // A service with folder support lists its empty folders along with the files
    const { assets, folders } = service.browse
      ? await service.browse(fetchOptions)
      : { assets: (await service.list?.(fetchOptions)) ?? [], folders: [] };

    // Ignore the result if a different service has been selected or a newer load has been started
    // in the meantime
    if (selectedCloudService.current === service && loadId === latestLoadId) {
      setAssets(assets);
      externalFolders.current = folders;
      pruneSelection(assets, folders);
    }
  } catch (ex) {
    if (selectedCloudService.current === service && loadId === latestLoadId) {
      setAssets([]);
      externalFolders.current = [];
      externalAssetsError.current = 'search_fetch_failed';
      pruneSelection([]);
    }

    // eslint-disable-next-line no-console
    console.error(ex);
  }
};

/**
 * Upload files to the selected cloud storage service, or replace an existing asset with a file.
 * Files are validated and transformed according to the shared media library options first, and
 * any rejected file is reported back so the caller can tell the user.
 * @param {File[]} files Files to be uploaded.
 * @param {object} [options] Options.
 * @param {ExternalAsset} [options.originalAsset] Asset to be replaced by the first file.
 * @returns {Promise<{ oversizedFileNames: string[], invalidFileNames: string[] }>} Names of the
 * files that were rejected.
 */
export const uploadExternalAssets = async (files, { originalAsset } = {}) => {
  const service = selectedCloudService.current;
  const sharedOptions = getSharedMediaLibraryOptions();
  const processed = await Promise.all(files.map((file) => processFile(file, sharedOptions)));
  const { validFiles, oversizedFiles, invalidFiles } = partitionProcessedFiles(processed);
  const oversizedFileNames = oversizedFiles.map(({ name }) => name);
  const invalidFileNames = invalidFiles.map(({ name }) => name);

  if (service && validFiles.length) {
    externalAssetsToast.current = {
      show: true,
      status: 'info',
      message: 'uploading_files_progress',
    };

    try {
      // A new file goes to the folder being browsed; a replacement keeps the asset’s own path
      const fetchOptions = {
        ...getFetchOptions(service),
        dirPath: selectedExternalDirPath.current,
      };

      if (originalAsset) {
        if (service.replace) {
          updateAsset(
            originalAsset,
            await service.replace(originalAsset, validFiles[0], fetchOptions),
          );
          reportSuccess('saved', 1);
        }
      } else if (service.upload) {
        const uploaded = await service.upload(validFiles, fetchOptions);
        const uploadedIds = new Set(uploaded.map(({ id }) => id));

        // A file uploaded under an existing name overwrites the asset on most services
        setAssets([
          ...uploaded,
          ...(externalAssets.current ?? []).filter(({ id }) => !uploadedIds.has(id)),
        ]);
        reportSuccess('saved', uploaded.length);
      }
    } catch (ex) {
      reportError('uploading_files_failed', ex);
    }
  }

  return { oversizedFileNames, invalidFileNames };
};

/**
 * Delete the given assets from the selected cloud storage service and remove them from the list.
 * @param {ExternalAsset[]} assets Assets to be deleted.
 * @returns {Promise<boolean>} Whether the assets have been deleted.
 */
export const deleteExternalAssets = async (assets) => {
  const service = selectedCloudService.current;

  if (!service?.delete || !assets.length) {
    return false;
  }

  try {
    await service.delete(assets, getFetchOptions(service));
  } catch (ex) {
    reportError('deleting_assets_failed', ex);
    // Some of the assets may have been deleted before the failure, so reload the list rather than
    // keep showing files that no longer exist
    await loadExternalAssets(service);

    return false;
  }

  forgetDeletedAssets(assets);
  reportSuccess('deleted', assets.length);

  return true;
};

/**
 * Rename the given asset on the selected cloud storage service and update the list.
 * @param {ExternalAsset} asset Asset to be renamed.
 * @param {string} newName New file name.
 * @returns {Promise<ExternalAsset | undefined>} Renamed asset, or `undefined` if the asset could
 * not be renamed.
 */
export const renameExternalAsset = async (asset, newName) => {
  const service = selectedCloudService.current;

  if (!service?.rename) {
    return undefined;
  }

  try {
    const renamedAsset = await service.rename(asset, newName, getFetchOptions(service));

    updateAsset(asset, renamedAsset);
    reportSuccess('renamed', 1);

    return renamedAsset;
  } catch (ex) {
    reportError('renaming_asset_failed', ex);

    return undefined;
  }
};

/**
 * Get the assets below a folder on the selected cloud storage service, at any depth, which are
 * what a rename moves along and a deletion removes.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @returns {ExternalAsset[]} Assets.
 */
export const getExternalSubfolderAssets = (dirPath) =>
  (externalAssets.current ?? []).filter(({ description }) => description.startsWith(`${dirPath}/`));

/**
 * Get a folder on the selected cloud storage service and every folder below it, which are what a
 * rename rebases and a deletion removes.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @returns {string[]} Folder paths.
 */
const getExternalFolderTree = (dirPath) =>
  externalFolders.current.filter((path) => path === dirPath || path.startsWith(`${dirPath}/`));

/**
 * Create an empty folder in the folder being browsed on the selected cloud storage service. The
 * service keeps a placeholder object for it, which is what the folder is listed from.
 * @param {string} name Folder name.
 * @returns {Promise<boolean>} Whether the folder has been created.
 */
export const createExternalFolder = async (name) => {
  const service = selectedCloudService.current;

  if (!service?.createFolder) {
    return false;
  }

  const dirPath = [selectedExternalDirPath.current, name].filter(Boolean).join('/');

  try {
    await service.createFolder(dirPath, getFetchOptions(service));
  } catch (ex) {
    reportError('creating_folder_failed', ex);

    return false;
  }

  externalFolders.current = [...externalFolders.current, dirPath];
  reportSuccess('folderCreated');

  return true;
};

/**
 * Rename a folder on the selected cloud storage service, which moves every asset below it, one by
 * one, along with the placeholder of any empty folder below it. The list is reloaded from the
 * service afterwards, whether or not every move went through, so it never shows a file at a path
 * it no longer has.
 * @param {AssetSubfolder} subfolder Folder to be renamed.
 * @param {string} newName New folder name.
 * @returns {Promise<boolean>} Whether the folder has been renamed.
 */
export const renameExternalFolder = async ({ path: dirPath }, newName) => {
  const service = selectedCloudService.current;

  if (!service?.move || !service.createFolder || !service.deleteFolder) {
    return false;
  }

  const newDirPath = [...dirPath.split('/').slice(0, -1), newName].join('/');
  /**
   * Get the path of a file or folder once the folder has been renamed.
   * @param {string} path Current path.
   * @returns {string} New path.
   */
  const rebase = (path) => `${newDirPath}${path.slice(dirPath.length)}`;
  const fetchOptions = getFetchOptions(service);
  const assets = getExternalSubfolderAssets(dirPath);
  const folders = getExternalFolderTree(dirPath);

  externalAssetsToast.current = { show: true, status: 'info', message: 'renaming_folder' };

  try {
    // Move the files one at a time, as the services do
    // eslint-disable-next-line no-restricted-syntax
    for (const asset of assets) {
      // eslint-disable-next-line no-await-in-loop
      await service.move(asset, rebase(asset.description), fetchOptions);
    }

    // A placeholder can’t be moved, so a new one is made and the old one removed. The renamed
    // folder itself gets one only if it had one, i.e. it held no file
    // eslint-disable-next-line no-restricted-syntax
    for (const path of folders) {
      // eslint-disable-next-line no-await-in-loop
      await service.createFolder(rebase(path), fetchOptions);
      // eslint-disable-next-line no-await-in-loop
      await service.deleteFolder(path, fetchOptions);
    }
  } catch (ex) {
    reportError('renaming_folder_failed', ex);
    await loadExternalAssets(service);

    return false;
  }

  await loadExternalAssets(service);

  // Keep the Info pane on the folder under its new name
  if (focusedExternalSubfolder.current?.path === dirPath) {
    focusedExternalSubfolder.current = { name: newName, path: newDirPath };
  }

  reportSuccess('folderRenamed');

  return true;
};

/**
 * Delete a folder on the selected cloud storage service along with every asset below it, and the
 * placeholder of any empty folder below it, including its own.
 * @param {AssetSubfolder} subfolder Folder to be deleted.
 * @returns {Promise<boolean>} Whether the folder has been deleted.
 */
export const deleteExternalFolder = async ({ path: dirPath }) => {
  const service = selectedCloudService.current;

  if (!service?.delete || !service.deleteFolder) {
    return false;
  }

  const fetchOptions = getFetchOptions(service);
  const assets = getExternalSubfolderAssets(dirPath);
  const folders = getExternalFolderTree(dirPath);

  externalAssetsToast.current = { show: true, status: 'info', message: 'deleting_folder' };

  try {
    await service.delete(assets, fetchOptions);

    // eslint-disable-next-line no-restricted-syntax
    for (const path of folders) {
      // eslint-disable-next-line no-await-in-loop
      await service.deleteFolder(path, fetchOptions);
    }
  } catch (ex) {
    reportError('deleting_folder_failed', ex);
    // Some of the files may have been deleted before the failure, so reload the list rather than
    // keep showing files that no longer exist
    await loadExternalAssets(service);

    return false;
  }

  forgetDeletedAssets(assets);
  externalFolders.current = externalFolders.current.filter((path) => !folders.includes(path));

  // The Info pane has nothing to describe once the folder is gone
  if (focusedExternalSubfolder.current?.path === dirPath) {
    focusedExternalSubfolder.current = undefined;
  }

  reportSuccess('folderDeleted');

  return true;
};
