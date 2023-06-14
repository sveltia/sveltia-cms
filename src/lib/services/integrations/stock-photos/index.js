import pexels from './pexels';
import pixabay from './pixabay';
import unsplash from './unsplash';

/**
 * List of all the supported stock photo services.
 * @type {{ [name: string]: StockPhotoService }}
 */
export const allStockPhotoServices = {
  pexels,
  pixabay,
  unsplash,
};
