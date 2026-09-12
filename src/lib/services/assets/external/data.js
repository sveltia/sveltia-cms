import { assetUpdatesToast } from '$lib/services/assets/data';
import {
  externalAssetCounts,
  externalAssets,
  externalAssetsError,
  focusedExternalAsset,
  getFetchOptions,
  selectedCloudService,
  selectedExternalAssets,
} from '$lib/services/assets/external';
import { processFile } from '$lib/services/assets/process';
import { cmsConfig } from '$lib/services/config';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { createDeepState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { ExternalAsset, MediaLibraryService } from '$lib/types/private';
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
 * @param {'saved' | 'renamed' | 'deleted'} action Action.
 * @param {number} count Number of assets.
 */
const reportSuccess = (action, count) => {
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
 * Drop the selected and focused assets that are no longer in the list, e.g. after the list has
 * been reloaded from the service.
 * @param {ExternalAsset[]} assets Assets in the list.
 */
const pruneSelection = (assets) => {
  const ids = new Set(assets.map(({ id }) => id));

  selectedExternalAssets.current = selectedExternalAssets.current.filter(({ id }) => ids.has(id));

  if (focusedExternalAsset.current && !ids.has(focusedExternalAsset.current.id)) {
    focusedExternalAsset.current = undefined;
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
    const assets = (await service.list?.(getFetchOptions(service))) ?? [];

    // Ignore the result if a different service has been selected or a newer load has been started
    // in the meantime
    if (selectedCloudService.current === service && loadId === latestLoadId) {
      setAssets(assets);
      pruneSelection(assets);
    }
  } catch (ex) {
    if (selectedCloudService.current === service && loadId === latestLoadId) {
      setAssets([]);
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

  const validFiles = processed
    .filter(({ oversized, invalid }) => !oversized && !invalid)
    .map(({ file }) => file);

  const oversizedFileNames = processed
    .filter(({ oversized, invalid }) => oversized && !invalid)
    .map(({ file }) => file.name);

  const invalidFileNames = processed.filter(({ invalid }) => invalid).map(({ file }) => file.name);

  if (service && validFiles.length) {
    externalAssetsToast.current = {
      show: true,
      status: 'info',
      message: 'uploading_files_progress',
    };

    try {
      const fetchOptions = getFetchOptions(service);

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

  const deletedIds = new Set(assets.map(({ id }) => id));

  setAssets(externalAssets.current?.filter(({ id }) => !deletedIds.has(id)));
  selectedExternalAssets.current = selectedExternalAssets.current.filter(
    ({ id }) => !deletedIds.has(id),
  );

  if (focusedExternalAsset.current && deletedIds.has(focusedExternalAsset.current.id)) {
    focusedExternalAsset.current = undefined;
  }

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
