import { getPathInfo } from '@sveltia/utils/file';
import { sleep } from '@sveltia/utils/misc';
import { IndexedDB } from '@sveltia/utils/storage';
import { escapeRegExp } from '@sveltia/utils/string';
import mime from 'mime';
import { get } from 'svelte/store';

import { getAssetByPath, isRelativePath } from '$lib/services/assets';
import { getAssetFoldersByPath, globalAssetFolder } from '$lib/services/assets/folders';
import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { getEntriesByAssetURL } from '$lib/services/contents/collection/entries';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { getMergedLibraryOptions } from '$lib/services/integrations/media-libraries/cloud/cloudinary';
import { createPathRegEx, encodeFilePath } from '$lib/services/utils/file';
import { getMediaMetadata } from '$lib/services/utils/media';
import { transformImage } from '$lib/services/utils/media/image/transform';
import { renderPDF } from '$lib/services/utils/media/pdf';

/**
 * @import {
 * Asset,
 * AssetDetails,
 * Entry,
 * InternalCmsConfig,
 * InternalImageTransformationOptions,
 * } from '$lib/types/private';
 * @import { MediaField } from '$lib/types/public';
 */

/**
 * Set of asset paths that are currently being requested. This is used to prevent multiple requests
 * for the same asset when the same asset is used in multiple places.
 */
const requestedAssetPaths = new Set();

/**
 * Get the blob for the given asset.
 * @param {Asset} asset Asset.
 * @param {number} [retryCount] Retry count.
 * @returns {Promise<Blob>} Blob.
 */
export const getAssetBlob = async (asset, retryCount = 0) => {
  const { file, handle, blobURL, name, path } = asset;

  if (blobURL) {
    return fetch(blobURL).then((r) => r.blob());
  }

  /** @type {Blob} */
  let blob;

  if (file) {
    blob = file;
  } else if (handle) {
    try {
      blob = await handle.getFile();
    } catch {
      throw new Error('Failed to retrieve blob from file handle');
    }
  } else {
    // If the blob is already being requested, wait for it to prevent multiple requests. If the
    // `blobURL` is still not available after 25 retries, or 5 seconds, fetch the file directly.
    if (requestedAssetPaths.has(path) && retryCount <= 25) {
      await sleep(200);
      return getAssetBlob(asset, retryCount + 1);
    }

    requestedAssetPaths.add(path);

    const _blob = await get(backend)?.fetchBlob?.(asset);

    if (!_blob) {
      throw new Error('Failed to retrieve blob');
    }

    // Override the MIME type as it can be `application/octet-stream`
    blob = new Blob([_blob], { type: mime.getType(name) ?? _blob.type });
  }

  // Cache the URL
  asset.blobURL = URL.createObjectURL(blob);

  requestedAssetPaths.delete(path);

  return blob;
};

/**
 * Get the blob URL for the given asset.
 * @param {Asset} asset Asset.
 * @returns {Promise<string | undefined>} URL or `undefined` if the blob is not available.
 */
export const getAssetBlobURL = async (asset) => {
  if (!asset.blobURL) {
    await getAssetBlob(asset);
  }

  return asset.blobURL;
};

/** @type {IndexedDB | null | undefined} */
let thumbnailDB = undefined;

/**
 * Get a thumbnail image for the given asset.
 * @param {Asset} asset Asset.
 * @param {object} [options] Options.
 * @param {boolean} [options.cacheOnly] Whether to search a thumbnail in the cache database only.
 * @returns {Promise<string | undefined>} Thumbnail blob URL.
 */
export const getAssetThumbnailURL = async (asset, { cacheOnly = false } = {}) => {
  const isPDF = asset.name.endsWith('.pdf');

  if (!(['image', 'video'].includes(asset.kind) || isPDF)) {
    return undefined;
  }

  // Initialize the thumbnail DB
  if (thumbnailDB === undefined) {
    const { databaseName } = get(backend)?.repository ?? {};

    thumbnailDB = databaseName ? new IndexedDB(databaseName, 'asset-thumbnails') : null;
  }

  /** @type {Blob | undefined} */
  let thumbnailBlob = await thumbnailDB?.get(asset.sha);

  if (!thumbnailBlob) {
    if (cacheOnly) {
      return undefined;
    }

    const blob = await getAssetBlob(asset);
    /** @type {InternalImageTransformationOptions} */
    const options = { format: 'webp', quality: 85, width: 512, height: 512, fit: 'contain' };

    thumbnailBlob = isPDF ? await renderPDF(blob, options) : await transformImage(blob, options);

    await thumbnailDB?.set(asset.sha, thumbnailBlob);
  }

  return URL.createObjectURL(thumbnailBlob);
};

/**
 * Get the public URL for the given asset.
 * @param {Asset} asset Asset file, such as an image.
 * @param {object} [options] Options.
 * @param {boolean} [options.pathOnly] Whether to use the absolute path starting with `/` instead of
 * the complete URL starting with `https`.
 * @param {boolean} [options.allowSpecial] Whether to allow returning a special, unlinkable path
 * starting with `@`, etc.
 * @param {Entry} [options.entry] Associated entry to be used to help locate an asset from a
 * relative path. Can be `undefined` when editing a new draft.
 * @returns {string | undefined} URL or `undefined` if it cannot be determined.
 */
export const getAssetPublicURL = (
  asset,
  { pathOnly = false, allowSpecial = false, entry = undefined } = {},
) => {
  const { publicPath, entryRelative, hasTemplateTags } =
    asset.folder.collectionName === undefined
      ? // Use the global asset folder
        asset.folder
      : // Search for the asset folder instead of using `asset.folder` directly, as an asset can be
        // used for multiple collections, and the public path can be different for each
        (getAssetFoldersByPath(asset.path).find(
          ({ collectionName }) => collectionName !== undefined,
        ) ?? get(globalAssetFolder));

  // Try to determine an entry-relative path if the asset is in the same folder as the entry, or a
  // sub-folder of it
  if (entryRelative) {
    if (pathOnly && entry) {
      const assetFolderPath = getPathInfo(asset.path).dirname;
      const entryFolderPath = getPathInfo(Object.values(entry.locales)[0].path).dirname;

      if (assetFolderPath !== undefined && entryFolderPath !== undefined) {
        // If the asset is in the same folder as the entry, return the file name only
        if (assetFolderPath === entryFolderPath) {
          return asset.name;
        }

        // Return the path relative to the entry’s folder, e.g. `images/photo.jpg`, or `undefined`
        // if the path cannot be determined
        return asset.path.match(new RegExp(`^(?:${escapeRegExp(entryFolderPath)})/(.+)$`))?.[1];
      }
    }

    return undefined;
  }

  const { _baseURL: baseURL = '', output: { encode_file_path: encodingEnabled = false } = {} } =
    /** @type {InternalCmsConfig} */ (get(cmsConfig));

  let path = hasTemplateTags
    ? asset.path.replace(
        // Deal with template tags like `/assets/images/{{slug}}`
        createPathRegEx(asset.folder.internalPath ?? '', (segment) => {
          const tag = segment.match(/{{(?<tag>.+?)}}/)?.groups?.tag;

          return tag ? `(?<${tag}>[^/]+)` : escapeRegExp(segment);
        }),
        publicPath?.replaceAll(/{{(.+?)}}/g, '$<$1>') ?? '',
      )
    : asset.path.replace(
        asset.folder.internalPath ?? '',
        publicPath === '/' ? '' : (publicPath ?? ''),
      );

  if (encodingEnabled) {
    path = encodeFilePath(path);
  }

  // Path starting with `@`, etc. cannot be linked
  if (!path.startsWith('/') && !allowSpecial) {
    return undefined;
  }

  if (pathOnly) {
    return path;
  }

  return `${baseURL}${path}`;
};

/**
 * Get the base URL for assets stored in Cloudinary.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {string | undefined} Base URL or undefined if not applicable.
 */
export const getAssetBaseURL = (fieldConfig) => {
  if (allCloudStorageServices.cloudinary?.isEnabled?.()) {
    const options = getMergedLibraryOptions(fieldConfig);

    if (options.output_filename_only && options.config?.cloud_name) {
      return `https://res.cloudinary.com/${options.config.cloud_name}`;
    }
  }

  return undefined;
};

/**
 * Get the blob or public URL from the given image/file entry field value.
 * @param {object} args Arguments.
 * @param {string} args.value Saved field value. It can be an absolute path, entry-relative path, or
 * a complete/external URL.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {MediaField} [args.fieldConfig] Field configuration.
 * @param {boolean} [args.thumbnail] Whether to use a thumbnail of the image.
 * @returns {Promise<string | undefined>} Blob URL or public URL that can be used in the app UI.
 */
export const getMediaFieldURL = async ({
  value,
  entry,
  collectionName,
  fileName,
  fieldConfig,
  thumbnail = false,
}) => {
  if (!value) {
    return undefined;
  }

  if (/^(?:https?|data|blob):/.test(value)) {
    return value;
  }

  // If the value is a relative path, try to get the asset base URL from the field config. This is a
  // special case for Cloudinary assets.
  if (isRelativePath(value)) {
    const assetBaseURL = getAssetBaseURL(fieldConfig);

    if (assetBaseURL) {
      return `${assetBaseURL}/${value}`;
    }
  }

  const asset = getAssetByPath({ value, entry, collectionName, fileName });

  if (!asset) {
    return undefined;
  }

  return (
    (thumbnail ? await getAssetThumbnailURL(asset) : await getAssetBlobURL(asset)) ??
    getAssetPublicURL(asset)
  );
};

/** @type {AssetDetails} */
export const defaultAssetDetails = {
  publicURL: undefined,
  repoBlobURL: undefined,
  dimensions: undefined,
  duration: undefined,
  usedEntries: [],
};

/**
 * Get the given asset’s extra info.
 * @param {Asset} asset Asset.
 * @returns {Promise<AssetDetails>} Details.
 */
export const getAssetDetails = async (asset) => {
  const { kind, path } = asset;
  const { blobBaseURL } = get(backend)?.repository ?? {};
  const blobURL = await getAssetBlobURL(asset);
  const url = getAssetPublicURL(asset, { allowSpecial: true, pathOnly: true }) ?? blobURL;
  let metaData = {};

  if (['image', 'video', 'audio'].includes(kind) && blobURL) {
    metaData = await getMediaMetadata(asset, blobURL, kind);
  }

  return {
    ...metaData,
    publicURL: getAssetPublicURL(asset),
    repoBlobURL: blobBaseURL ? `${blobBaseURL}/${path}` : undefined,
    usedEntries: url ? await getEntriesByAssetURL(url) : [],
  };
};
