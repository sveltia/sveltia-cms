import cloudinary from './cloudinary';
import uploadcare from './uploadcare';

/**
 * @import { MediaLibraryService } from '$lib/types/private';
 */

/**
 * List of all the supported cloud storage services.
 * @type {Record<string, MediaLibraryService>}
 */
export const allCloudStorageServices = {
  // cloudinary,
  // uploadcare,
};

// UI is not ready yet
void [cloudinary, uploadcare];
