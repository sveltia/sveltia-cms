import { derived, get, writable } from 'svelte/store';

export const assetKinds = ['image', 'video', 'audio', 'document', 'other'];

/**
 * Common file extension regex list that can be used for filtering.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
 */
export const assetExtensions = {
  image: /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff|webp)$/i,
  video: /\.(?:avi|mp4|mpeg|ogv|ts|webm|3gp|3g2)$/i,
  audio: /\.(?:aac|midi?|mp3|opus|wav|weba)$/i,
  document: /\.(?:csv|docx?|odp|ods|odt|pdf|pptx?|rtf|xslx?)$/i,
};

/**
 * @type {import('svelte/store').Writable<Asset[]>}
 */
export const allAssets = writable([]);

/**
 * @type {import('svelte/store').Writable<CollectionAssetPaths[]>}
 */
export const allAssetPaths = writable([]);

/**
 * @type {import('svelte/store').Writable<string?>}
 */
export const selectedAssetFolderPath = writable();

/**
 * @type {import('svelte/store').Writable<Asset[]>}
 */
export const selectedAssets = writable([]);

/**
 * @type {import('svelte/store').Writable<Asset?>}
 */
export const selectedAsset = writable();

export const uploadingAssets = writable({ folder: null, files: [] });

/**
 * @type {import('svelte/store').Readable<boolean>}
 */
export const showUploadAssetsDialog = derived([uploadingAssets], ([_uploadingAssets], set) => {
  set(!!_uploadingAssets.files?.length);
});

/**
 * Get an asset internal/public paths by collection name.
 * @param {string} collectionName Collection name.
 * @returns {CollectionAssetPaths} Path config.
 */
export const getAssetFolder = (collectionName) =>
  get(allAssetPaths).findLast((p) => [null, collectionName].includes(p.collectionName));

/**
 * Determine the asset’s kind from the file extension.
 * @param {string} name File name or path.
 * @returns {string} One of {@link assetKinds}.
 */
export const getAssetKind = (name) =>
  Object.entries(assetExtensions).find(([, regex]) => name.match(regex))?.[0] || 'other';

/**
 * Get an asset by a public URL path (stored as an image field value.)
 * @param {string} path Path starting with `/`.
 * @returns {?Asset} Corresponding asset.
 */
export const getAssetByPublicPath = (path) => {
  const [, publicPath, fileName] = path.match(/(.+?)\/([^/]+)$/) || [];

  if (!publicPath) {
    return null;
  }

  const { internalPath } =
    get(allAssetPaths).findLast((config) => config.publicPath === publicPath) || {};

  if (!internalPath) {
    return null;
  }

  return get(allAssets).find((asset) => asset.path === `${internalPath}/${fileName}`);
};
