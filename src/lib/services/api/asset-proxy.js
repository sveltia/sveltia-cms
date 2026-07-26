import { encodeBase64 } from '@sveltia/utils/file';

import { getAssetBlob, getAssetBlobURL, getAssetPublicURL } from '$lib/services/assets/info';

/**
 * @import { Asset } from '$lib/types/private';
 */

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
      // Replace the URL with the blob URL if available, otherwise keep the existing URL
      this.url = (await getAssetBlobURL(asset)) ?? this.url;
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
