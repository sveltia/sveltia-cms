import pexels from './pexels';
import pixabay from './pixabay';
import unsplash from './unsplash';

/**
 * List of all the supported cloud storage services.
 * @type {Record<string,  import('$lib/typedefs').MediaLibraryService>}
 */
export const allCloudStorageServices = {
  //
};
/**
 * List of all the external media libraries.
 * @type {Record<string, import('$lib/typedefs').MediaLibraryService>}
 */
export const allStockPhotoServices = {
  pexels,
  pixabay,
  unsplash,
};
