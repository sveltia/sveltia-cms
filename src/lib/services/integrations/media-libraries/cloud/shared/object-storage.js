/* eslint-disable no-await-in-loop */

import { sleep } from '@sveltia/utils/misc';

import { getAssetKind } from '$lib/services/assets/kinds';
import { filterAssetsByQuery } from '$lib/services/integrations/media-libraries/cloud/search';
import {
  getFileKey,
  getPrefix,
  getRelativeKey,
} from '$lib/services/integrations/media-libraries/cloud/shared/keys';

/**
 * @import {
 * ExternalAsset,
 * ExternalFolderListing,
 * MediaLibraryFetchOptions,
 * } from '$lib/types/private';
 * @import {
 * CloudStorageConfig,
 * } from '$lib/services/integrations/media-libraries/cloud/shared/keys';
 */

/**
 * Operations that differ between object storage services, such as Azure Blob Storage and the
 * S3-compatible services, which otherwise list, upload and delete files the same way. Each
 * operation handles the transport, including authorization, of a single request.
 * @template T Object type returned by the service’s list operation.
 * @template {CloudStorageConfig} C Service configuration type.
 * @typedef {object} ObjectStorageProvider
 * @property {(options: MediaLibraryFetchOptions) => string} requireCredential Function to get the
 * credential, such as a SAS token or a secret access key, from the fetch options. It throws when no
 * credential was provided.
 * @property {(params: { config: C, credential: string, prefix: string, cursor?: string }) =>
 * Promise<{ items: T[], cursor?: string }>} listPage Function to fetch a page of objects under the
 * given prefix, starting at the given continuation cursor. The returned cursor is `undefined` on
 * the last page.
 * @property {(item: T) => string} getKey Function to get the key of a listed object.
 * @property {(items: T[], config: C, credential: string) => ExternalAsset[]} parseResults Function
 * to convert objects into the `ExternalAsset` format.
 * @property {(params: { key: string, file: File, config: C, credential: string }) => Promise<T>}
 * putObject Function to upload a file under the given key, overwriting any existing object.
 * @property {(params: { key: string, config: C, credential: string }) => Promise<void>}
 * deleteObject Function to delete the object with the given key.
 */

/**
 * Fetch the objects under the configured prefix, page by page.
 * @template T
 * @template {CloudStorageConfig} C
 * @param {ObjectStorageProvider<T, C>} provider Service provider.
 * @param {C} config Service configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the credential).
 * @param {object} [params] Additional parameters.
 * @param {number} [params.maxPages] Maximum number of pages to fetch. Default: 10.
 * @returns {Promise<{ files: T[], folders: string[] }>} Objects, split into the files and the
 * folder placeholders, the latter given as folder paths relative to the prefix.
 */
export const fetchListing = async (provider, config, options, { maxPages = 10 } = {}) => {
  const credential = provider.requireCredential(options);
  const prefix = getPrefix(config);
  /** @type {T[]} */
  const files = [];
  /** @type {string[]} */
  const folders = [];
  /** @type {string | undefined} */
  let cursor;

  // Fetch up to maxPages pages
  for (let page = 0; page < maxPages; page += 1) {
    const result = await provider.listPage({ config, credential, prefix, cursor });

    result.items.forEach((item) => {
      const key = provider.getKey(item);

      // A key ending with a slash is a folder placeholder — one the CMS created for an empty
      // folder, or one a hierarchical namespace account returns — rather than a file
      if (key.endsWith('/')) {
        const dirPath = getRelativeKey(config, key).replace(/\/$/, '');

        // The placeholder of the prefix itself isn’t a folder below it
        if (dirPath) {
          folders.push(dirPath);
        }
      } else {
        files.push(item);
      }
    });

    ({ cursor } = result);

    if (!cursor) {
      break;
    }

    // Wait for a bit before requesting the next page
    await sleep(50);
  }

  return { files, folders };
};

/**
 * Filter the given objects by the asset kind in the fetch options, if any.
 * @template T
 * @template {CloudStorageConfig} C
 * @param {ObjectStorageProvider<T, C>} provider Service provider.
 * @param {T[]} files Objects.
 * @param {MediaLibraryFetchOptions} options Fetch options.
 * @returns {T[]} Filtered objects.
 */
const filterByKind = (provider, files, { kind }) =>
  kind ? files.filter((item) => getAssetKind(provider.getKey(item)) === kind) : files;

/**
 * List the files under the configured prefix.
 * @template T
 * @template {CloudStorageConfig} C
 * @param {ObjectStorageProvider<T, C>} provider Service provider.
 * @param {C} config Service configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the credential).
 * @param {object} [params] Additional parameters.
 * @param {number} [params.maxPages] Maximum number of pages to fetch. Default: 10.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const listObjects = async (provider, config, options, params = {}) => {
  const { files } = await fetchListing(provider, config, options, params);

  return provider.parseResults(filterByKind(provider, files, options), config, options.apiKey);
};

/**
 * List the files and the empty folders under the configured prefix.
 * @template T
 * @template {CloudStorageConfig} C
 * @param {ObjectStorageProvider<T, C>} provider Service provider.
 * @param {C} config Service configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the credential).
 * @returns {Promise<ExternalFolderListing>} Files and folders.
 */
export const browseObjects = async (provider, config, options) => {
  const { files, folders } = await fetchListing(provider, config, options);

  return {
    assets: provider.parseResults(filterByKind(provider, files, options), config, options.apiKey),
    folders,
  };
};

/**
 * Search the files under the configured prefix. Object storage doesn’t have a native search, so
 * the files are listed and filtered client-side.
 * @template T
 * @template {CloudStorageConfig} C
 * @param {ObjectStorageProvider<T, C>} provider Service provider.
 * @param {string} query Search query.
 * @param {C} config Service configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the credential).
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const searchObjects = async (provider, query, config, options) => {
  const allAssets = await listObjects(provider, config, options, { maxPages: 5 });

  return filterAssetsByQuery(allAssets, query);
};

/**
 * Upload files one by one to the folder given in the fetch options.
 * @template T
 * @template {CloudStorageConfig} C
 * @param {ObjectStorageProvider<T, C>} provider Service provider.
 * @param {File[]} files Files to upload.
 * @param {C} config Service configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the credential).
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const uploadObjects = async (provider, files, config, options) => {
  if (files.length === 0) {
    return [];
  }

  const credential = provider.requireCredential(options);
  const { dirPath = '' } = options;
  /** @type {T[]} */
  const uploadedObjects = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    // Extract only the filename to prevent path traversal via crafted File objects
    const sanitizedName = file.name.split(/[/\\]/).filter(Boolean).at(-1) ?? file.name;
    const key = getFileKey(config, dirPath ? `${dirPath}/${sanitizedName}` : sanitizedName);

    uploadedObjects.push(await provider.putObject({ key, file, config, credential }));

    // Wait a bit between uploads
    if (files.length > 1) {
      await sleep(50);
    }
  }

  return provider.parseResults(uploadedObjects, config, credential);
};

/**
 * Delete objects one by one.
 * @template T
 * @template {CloudStorageConfig} C
 * @param {ObjectStorageProvider<T, C>} provider Service provider.
 * @param {ExternalAsset[]} assets Assets to delete. The `id` of each asset is the object key.
 * @param {C} config Service configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the credential).
 * @returns {Promise<void>}
 */
export const deleteObjects = async (provider, assets, config, options) => {
  const credential = provider.requireCredential(options);

  // eslint-disable-next-line no-restricted-syntax
  for (const { id: key } of assets) {
    await provider.deleteObject({ key, config, credential });

    // Wait a bit between requests
    if (assets.length > 1) {
      await sleep(50);
    }
  }

  return undefined;
};

/**
 * Replace an object with a new file, keeping the object key so that the URL stays the same.
 * @template T
 * @template {CloudStorageConfig} C
 * @param {ObjectStorageProvider<T, C>} provider Service provider.
 * @param {ExternalAsset} asset Asset to replace. Its `id` is the object key.
 * @param {File} file New file.
 * @param {C} config Service configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (`apiKey` contains the credential).
 * @returns {Promise<ExternalAsset>} Replaced asset.
 */
export const replaceObject = async (provider, asset, file, config, options) => {
  const credential = provider.requireCredential(options);
  const object = await provider.putObject({ key: asset.id, file, config, credential });

  return provider.parseResults([object], config, credential)[0];
};

/**
 * Get the path an object is moved to when it’s renamed, keeping it in its folder.
 * @param {CloudStorageConfig} config Service configuration.
 * @param {ExternalAsset} asset Asset to rename. Its `id` is the object key.
 * @param {string} newName New file name, without a directory.
 * @returns {string} New path relative to the configured prefix.
 */
export const getRenamedPath = (config, asset, newName) => {
  const dirName = getRelativeKey(config, asset.id).split('/').slice(0, -1).join('/');

  return dirName ? `${dirName}/${newName}` : newName;
};
