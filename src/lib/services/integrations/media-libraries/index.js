import pexels from './pexels';
import pixabay from './pixabay';
import unsplash from './unsplash';

/**
 * @import { MediaLibraryService } from '$lib/types/private';
 * @import { StockAssetProviderName } from '$lib/types/public';
 */

/**
 * List of all the supported cloud storage services.
 * @type {Record<string, MediaLibraryService>}
 */
export const allCloudStorageServices = {
  //
};
/**
 * List of all the supported stock asset providers.
 * @type {Record<StockAssetProviderName, MediaLibraryService>}
 */
export const allStockAssetProviders = {
  pexels,
  pixabay,
  unsplash,
};
