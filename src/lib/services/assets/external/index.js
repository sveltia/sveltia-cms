import { isTextFileType } from '@sveltia/utils/file';
import mime from 'mime';

import { isMediaKind } from '$lib/services/assets/kinds';
import { cmsConfig } from '$lib/services/config';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
 */

/**
 * Prefix of the folder path segment in the Asset Library URL that selects a cloud storage service
 * rather than a repository folder, e.g. `#/assets/-/uploadcare`. The same prefix is used for the
 * All Assets folder (`-/all`), which is why a service ID can never be `all`.
 */
export const EXTERNAL_LOCATION_PATH_PREFIX = '-/';

/**
 * Cloud storage services enabled in the site configuration, in the order they are defined in
 * {@link allCloudStorageServices}. These are listed as External Locations in the Asset Library.
 * @type {{ readonly current: MediaLibraryService[] }}
 */
export const enabledCloudServices = createDerivedState(() => {
  // Each service reads the config through `isEnabled()`, but a service that doesn’t have the
  // method is considered enabled, so read the config here to always track it
  void cmsConfig.current;

  return Object.values(allCloudStorageServices).filter(({ isEnabled }) => isEnabled?.() ?? true);
});

/**
 * Get an enabled cloud storage service by its ID.
 * @param {string} serviceId Service ID, e.g. `uploadcare`.
 * @returns {MediaLibraryService | undefined} Service, or `undefined` if the service is unknown or
 * not enabled.
 */
export const getCloudService = (serviceId) =>
  enabledCloudServices.current.find((service) => service.serviceId === serviceId);

/**
 * Get the Asset Library path for the given cloud storage service.
 * @param {MediaLibraryService} service Service.
 * @returns {string} Path, e.g. `/assets/-/uploadcare`.
 */
export const getCloudServicePath = ({ serviceId }) =>
  `/assets/${EXTERNAL_LOCATION_PATH_PREFIX}${serviceId}`;

/**
 * Get the Asset Library path of the given asset on a cloud storage service, whose details are shown
 * in an overlay. The asset ID, e.g. an object key that may contain slashes and special characters,
 * is percent-encoded per path segment.
 * @param {MediaLibraryService} service Service.
 * @param {ExternalAsset} asset Asset.
 * @returns {string} Path, e.g. `/assets/-/aws_s3/images/photo.jpg`.
 */
export const getExternalAssetPath = (service, { id }) =>
  `${getCloudServicePath(service)}/${id.split('/').map(encodeURIComponent).join('/')}`;

/**
 * Whether the given asset can be previewed in the details overlay: a media file, a PDF document
 * or a plaintext file.
 * @param {ExternalAsset} asset Asset.
 * @returns {boolean} Result.
 */
export const canPreviewExternalAsset = ({ kind, fileName }) => {
  const type = mime.getType(fileName);

  return isMediaKind(kind) || type === 'application/pdf' || (!!type && isTextFileType(type));
};

/**
 * Cloud storage service currently selected in the Asset Library, or `undefined` when a repository
 * folder is selected instead.
 * @type {{ current: MediaLibraryService | undefined }}
 */
export const selectedCloudService = createRawState();

/**
 * Assets on the selected cloud storage service. It’s `undefined` while the assets are being
 * fetched, and reset when a different service is selected.
 * @type {{ current: ExternalAsset[] | undefined }}
 */
export const externalAssets = createRawState();

/**
 * Number of assets on each cloud storage service whose list has been fetched so far, keyed by
 * service ID. Shown in the Asset Library sidebar; a service that hasn’t been visited yet has no
 * count, as listing it would require the user’s credentials and an extra API call.
 * @type {{ current: Record<string, number> }}
 */
export const externalAssetCounts = createRawState({});

/**
 * Key of the error message to be shown when the assets could not be fetched.
 * @type {{ current: string | undefined }}
 */
export const externalAssetsError = createRawState();

/**
 * Assets selected in the list.
 * @type {{ current: ExternalAsset[] }}
 */
export const selectedExternalAssets = createRawState([]);

/**
 * Asset that has focus in the list, whose details are shown in the Info pane.
 * @type {{ current: ExternalAsset | undefined }}
 */
export const focusedExternalAsset = createRawState();

/**
 * ID of the asset whose details are shown in the overlay, taken from the URL. The asset itself is
 * looked up in {@link externalAssets} once the list is loaded.
 * @type {{ current: string | undefined }}
 */
export const overlaidExternalAssetId = createRawState();

/**
 * Asset being renamed, shown in the Rename Asset dialog.
 * @type {{ current: ExternalAsset | undefined }}
 */
export const renamingExternalAsset = createRawState();

/**
 * Search terms entered in the list’s search bar, used to narrow down the assets by file name.
 * @type {{ current: string }}
 */
export const externalAssetSearchTerms = createRawState('');

/**
 * Get the credentials needed to call the given service’s API, which the user has entered in the
 * Asset Library, the asset picker or the Settings dialog.
 * @param {MediaLibraryService} service Service.
 * @returns {MediaLibraryFetchOptions} Fetch options.
 */
export const getFetchOptions = ({ serviceId }) => {
  const apiKey = prefs.apiKeys?.[serviceId] ?? '';
  const [userName = '', password = ''] = (prefs.logins?.[serviceId] ?? '').split(' ');

  return { apiKey, userName, password };
};

/**
 * Whether the user has provided the credentials needed to call the given service’s API.
 * @param {MediaLibraryService} service Service.
 * @returns {boolean} Result.
 */
export const hasAuthInfo = (service) => {
  const { apiKey, password } = getFetchOptions(service);

  return service.authType === 'none' || !!apiKey || !!password;
};

/**
 * Reset the list state. Called when a different service is selected.
 */
export const resetExternalAssets = () => {
  externalAssets.current = undefined;
  externalAssetsError.current = undefined;
  selectedExternalAssets.current = [];
  focusedExternalAsset.current = undefined;
  overlaidExternalAssetId.current = undefined;
  renamingExternalAsset.current = undefined;
  externalAssetSearchTerms.current = '';
};
