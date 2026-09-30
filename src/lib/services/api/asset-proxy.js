import { encodeBase64 } from '@sveltia/utils/file';

import { getAssetBlob, getAssetBlobURL, getAssetPublicURL } from '$lib/services/assets/info';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { Asset } from '$lib/types/private';
 */

/**
 * Number of times an {@link AssetProxy} has had its URL replaced with a blob URL. A React
 * component reads the `url` property when it renders, and isn’t told when it changes, so the
 * components that pass `getAsset` to one depend on this to render it again with the blob URL.
 * Otherwise a preview would keep the public path, which doesn’t point to the file on the CMS site,
 * nor at all for a file that hasn’t been published yet.
 */
export const assetURLUpdates = createRawState(0);

/**
 * Implement the `ApiAsset` interface for assets returned by the API.
 */
export class AssetProxy {
  #asset;

  /**
   * Initialize an `AssetProxy` instance with the provided asset data.
   * @param {Asset} asset Cached asset object.
   */
  constructor(asset) {
    this.#asset = asset;
    this.path = getAssetPublicURL(asset, { pathOnly: true }) ?? '';
    this.url = asset.blobURL ?? this.path;
    this.field = undefined;
    this.fileObj = asset.file;

    (async () => {
      try {
        // Replace the URL with the blob URL if available, otherwise keep the existing URL
        const blobURL = await getAssetBlobURL(asset);

        if (blobURL && blobURL !== this.url) {
          this.url = blobURL;
          assetURLUpdates.current += 1;
        }
      } catch {
        // The blob can’t be retrieved, e.g. offline or the file is gone; keep the existing URL
      }
    })();
  }

  /**
   * Return the URL of the asset as a string.
   * @returns {string} The URL of the asset.
   */
  toString() {
    return this.url;
  }

  /**
   * Return a Promise that resolves to a base64-encoded string of the asset’s content.
   * @returns {Promise<string>} A Promise that resolves to a base64-encoded string of the asset’s
   * content.
   * @throws {Error} If the asset blob cannot be retrieved or encoded.
   */
  async toBase64() {
    try {
      const blob = await getAssetBlob(this.#asset);

      return encodeBase64(blob);
    } catch (/** @type {any} */ error) {
      throw new Error(`Failed to encode asset as base64: ${error.message}`);
    }
  }
}
