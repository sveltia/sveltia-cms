import cloudinary from './cloudinary';
import uploadcare from './uploadcare';

/**
 * @import { MediaLibraryService } from '$lib/types/private';
 * @import { CloudMediaLibraryName } from '$lib/types/public';
 */

/**
 * List of all the supported cloud storage services.
 * @type {Record<string, MediaLibraryService>}
 */
export const allCloudStorageServices = {
  cloudinary,
  uploadcare,
};

/**
 * List of all supported cloud media library names.
 * @type {CloudMediaLibraryName[]}
 */
export const CLOUD_MEDIA_LIBRARY_NAMES = /** @type {any} */ (Object.keys(allCloudStorageServices));
