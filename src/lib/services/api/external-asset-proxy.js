import { encodeBase64 } from '@sveltia/utils/file';

/**
 * Implement the `ApiAsset` interface for a file on an external location, referred to with a
 * complete URL, e.g. `https://example.com/photo.jpg`, or a URL derived from a cloud storage
 * service’s base URL. The URL serves as both the `url` and the `path`, like Netlify/Decap CMS.
 */
export class ExternalAssetProxy {
  /**
   * Initialize an `ExternalAssetProxy` instance.
   * @param {string} url URL of the file.
   */
  constructor(url) {
    this.path = url;
    this.url = url;
    this.field = undefined;
    this.fileObj = undefined;
  }

  /**
   * Return the URL of the asset as a string.
   * @returns {string} The URL of the asset.
   */
  toString() {
    return this.url;
  }

  /**
   * Return a Promise that resolves to a base64-encoded string of the file’s content.
   * @returns {Promise<string>} A Promise that resolves to a base64-encoded string of the file’s
   * content.
   * @throws {Error} If the file cannot be retrieved, e.g. because the server doesn’t allow
   * cross-origin requests, or encoded.
   */
  async toBase64() {
    try {
      const response = await fetch(this.url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return encodeBase64(await response.blob());
    } catch (/** @type {any} */ error) {
      throw new Error(`Failed to encode asset as base64: ${error.message}`);
    }
  }
}
