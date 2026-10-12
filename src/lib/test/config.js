import { allAssets } from '$lib/services/assets/state';
import { initCmsConfig } from '$lib/services/config/init';
import { allEntries } from '$lib/services/contents';
import { collectionCacheMap } from '$lib/services/contents/collection';
import { fieldConfigCacheMap } from '$lib/services/contents/entry/fields';

export {
  createMockAsset,
  createMockAssetFolder,
  createMockCloudService,
  createMockEntry,
  createMockExternalAsset,
  createMockWorkflowEntry,
  TEST_IMAGE_URL,
} from '$lib/test/factories';

/**
 * @import { Asset, Entry } from '$lib/types/private';
 * @import { CmsConfig } from '$lib/types/public';
 */

/**
 * Load a site configuration into the app the way `CMS.init()` does, so the collections, entry
 * folders and asset folders are all set up from it. The `test-repo` backend needs no network.
 * @param {Partial<CmsConfig>} [config] Configuration. The `backend`, `media_folder` and
 * `collections` options have defaults: the collections are a `posts` entry collection with a
 * `title` field, which entries from `createMockEntry()` belong to.
 * @returns {Promise<void>}
 * @throws {Error} If the configuration is invalid.
 */
export const initTestConfig = async (config = {}) => {
  // The app loads its configuration once, so the collections and fields it resolves are cached for
  // good. A test file loading another configuration has to start over
  collectionCacheMap.clear();
  fieldConfigCacheMap.clear();

  await initCmsConfig(
    /** @type {CmsConfig} */ ({
      load_config_file: false,
      backend: { name: 'test-repo' },
      media_folder: 'static/uploads',
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
      ...config,
    }),
  );
};

/**
 * Replace the entries loaded in the app.
 * @param {Entry[]} entries Entries.
 */
export const setEntries = (entries) => {
  allEntries.current = entries;
};

/**
 * Replace the assets loaded in the app.
 * @param {Asset[]} assets Assets.
 */
export const setAssets = (assets) => {
  allAssets.current = assets;
};

/**
 * Build a real, tiny PNG file, for a component that reads the image’s dimensions or shows it.
 * @param {object} [args] Arguments.
 * @param {string} [args.name] File name.
 * @param {number} [args.width] Width in pixels.
 * @param {number} [args.height] Height in pixels.
 * @returns {Promise<File>} File.
 */
export const createMockImageFile = async ({ name = 'photo.png', width = 4, height = 3 } = {}) => {
  const canvas = new OffscreenCanvas(width, height);

  // A context has to exist before the canvas can be encoded
  canvas.getContext('2d');

  return new File([await canvas.convertToBlob({ type: 'image/png' })], name, {
    type: 'image/png',
  });
};
