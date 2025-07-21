import { getMediaLibraryOptions } from '$lib/services/integrations/media-libraries';
import pexels from './pexels';
import pixabay from './pixabay';
import unsplash from './unsplash';

/**
 * @import { MediaLibraryService } from '$lib/types/private';
 * @import {
 * FileField,
 * ImageField,
 * StockAssetMediaLibrary,
 * StockAssetProviderName,
 * } from '$lib/types/public';
 */

/**
 * List of all the supported stock asset providers.
 * @type {Record<StockAssetProviderName, MediaLibraryService>}
 */
export const allStockAssetProviders = {
  pexels,
  pixabay,
  unsplash,
};

/**
 * Get normalized stock photo/video media library options.
 * @param {object} [options] Options.
 * @param {FileField | ImageField} [options.fieldConfig] Field configuration.
 * @returns {StockAssetMediaLibrary} Options.
 */
export const getStockAssetMediaLibraryOptions = ({ fieldConfig } = {}) => {
  const options = getMediaLibraryOptions({ libraryName: 'stock_assets', fieldConfig });

  const allProviderNames = /** @type {StockAssetProviderName[]} */ (
    Object.keys(allStockAssetProviders)
  );

  const { providers } = options;

  return {
    providers: Array.isArray(providers) ? providers : allProviderNames,
  };
};
