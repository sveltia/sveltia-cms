import pexels from './pexels';
import pixabay from './pixabay';
import unsplash from './unsplash';

/**
 * List of all the supported picture services.
 * @type {{ [name: string]: PictureService }}
 */
export const allPictureServices = {
  pexels,
  pixabay,
  unsplash,
};
