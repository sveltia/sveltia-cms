import { encodeBase64 } from '@sveltia/utils/file';

/**
 * Implement the `ApiAsset` interface for a file added to the entry draft but not saved yet. A field
 * value refers to such a file with its temporary blob URL until the entry is saved, so the URL
 * serves as both the `url` and the `path`.
 */
export class UnsavedAssetProxy {
  #file;

  /**
   * Initialize an `UnsavedAssetProxy` instance.
   * @param {string} blobURL Blob URL the field value refers to the file with.
   * @param {File} file File to be uploaded.
   */
  constructor(blobURL, file) {
    this.#file = file;
    this.path = blobURL;
    this.url = blobURL;
    this.field = undefined;
    this.fileObj = file;
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
   */
  async toBase64() {
    return encodeBase64(this.#file);
  }
}
