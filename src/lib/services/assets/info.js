import { getPathInfo } from '@sveltia/utils/file';
import { sleep } from '@sveltia/utils/misc';
import { IndexedDB } from '@sveltia/utils/storage';
import { escapeRegExp } from '@sveltia/utils/string';
import mime from 'mime';
import { get } from 'svelte/store';

import { allAssets, getAssetByPath, isRelativePath } from '$lib/services/assets';
import { getAssetFoldersByPath, globalAssetFolder } from '$lib/services/assets/folders';
import { backend } from '$lib/services/backends';
import {
  TEMPLATE_TAG_REGEX,
  TEMPLATE_TAG_REPLACE_REGEX,
} from '$lib/services/common/template/constants';
import { cmsConfig } from '$lib/services/config';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { getMergedLibraryOptions } from '$lib/services/integrations/media-libraries/cloud/cloudinary';
import { createPath, createPathRegEx, encodeFilePath } from '$lib/services/utils/file';
import {
  THUMBNAIL_TRANSFORM_OPTIONS,
  transformImage,
} from '$lib/services/utils/media/image/transform';
import { renderPDF } from '$lib/services/utils/media/pdf';

/**
 * @import { Asset, Entry, InternalCmsConfig, TypedFieldKeyPath } from '$lib/types/private';
 * @import { MediaField } from '$lib/types/public';
 */

const URL_REGEX = /^(?:https?|data|blob):/;
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
 * Thumbnail blob resolutions currently in flight, keyed by asset SHA. Generating a thumbnail means
 * a database read and, on a miss, decoding and transforming the full-size image, so concurrent
 * requests for the same asset — several components showing it at once, or one component asking for
 * both a preview and a blurred backdrop — share a single resolution instead of repeating the work.
 * @type {Map<string, Promise<Blob | undefined>>}
 */
const pendingThumbnailBlobs = new Map();

/* v8 ignore next */
/**
 * Reset the thumbnail database. This is used in tests to reset the state of the thumbnail database
 * between tests.
 * @internal
 */
export const _resetThumbnailDB = () => {
  thumbnailDB = undefined;
  pendingThumbnailBlobs.clear();
};

/**
 * Initialize {@link thumbnailDB} if it hasn’t been initialized yet.
 */
const initThumbnailDB = () => {
  if (thumbnailDB === undefined) {
    const { databaseName } = get(backend)?.repository ?? {};

    thumbnailDB = databaseName ? new IndexedDB(databaseName, 'asset-thumbnails') : null;
  }
};

/**
 * Get a thumbnail blob for the given asset, generating it from the original file if it’s not in the
 * cache database yet.
 * @param {Asset} asset Asset.
 * @param {boolean} isPDF Whether the asset is a PDF file.
 * @returns {Promise<Blob | undefined>} Thumbnail blob.
 */
const resolveThumbnailBlob = async (asset, isPDF) => {
  /** @type {Blob | undefined} */
  let thumbnailBlob = await thumbnailDB?.get(asset.sha);

  if (!thumbnailBlob) {
    const blob = await getAssetBlob(asset);
    const transform = isPDF ? renderPDF : transformImage;

    thumbnailBlob = await transform(blob, THUMBNAIL_TRANSFORM_OPTIONS);

    await thumbnailDB?.set(asset.sha, thumbnailBlob);
  }

  return thumbnailBlob;
};

/**
 * Get a thumbnail image for the given asset.
 * @param {Asset} asset Asset.
 * @param {object} [options] Options.
 * @param {boolean} [options.cacheOnly] Whether to search a thumbnail in the cache database only.
 * @returns {Promise<string | undefined>} Thumbnail blob URL. Each caller gets its own object URL,
 * so it can be revoked independently.
 */
export const getAssetThumbnailURL = async (asset, { cacheOnly = false } = {}) => {
  const isPDF = asset.name.endsWith('.pdf');

  if (!(['image', 'video'].includes(asset.kind) || isPDF)) {
    return undefined;
  }

  initThumbnailDB();

  const { sha } = asset;
  let pending = pendingThumbnailBlobs.get(sha);

  if (!pending) {
    if (cacheOnly) {
      // Nothing is being generated for this asset, so stick to a cache lookup as requested
      const cachedBlob = await thumbnailDB?.get(sha);

      return cachedBlob ? URL.createObjectURL(cachedBlob) : undefined;
    }

    pending = resolveThumbnailBlob(asset, isPDF).finally(() => {
      pendingThumbnailBlobs.delete(sha);
    });

    pendingThumbnailBlobs.set(sha, pending);
  }

  // A `cacheOnly` caller joins an in-flight resolution rather than reading the database again: the
  // work is already happening, so waiting for it costs nothing extra
  const thumbnailBlob = await pending;

  return thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : undefined;
};

/**
 * Blob URLs awaiting revocation, collected until the next animation frame.
 * @type {Set<string>}
 */
const pendingRevocations = new Set();

/* v8 ignore next */
/**
 * Discard the queued blob URL revocations. This is used in tests, where the animation frame that
 * would drain the queue is mocked out.
 * @internal
 */
export const _resetRevocationQueue = () => {
  pendingRevocations.clear();
};

/**
 * Revoke every queued blob URL that no element is displaying any more.
 */
const flushRevocations = () => {
  const urls = new Set(pendingRevocations);

  pendingRevocations.clear();

  // One query for every blob URL on the page, rather than one per asset
  document.querySelectorAll('[src^="blob:"]').forEach((element) => {
    urls.delete(/** @type {string} */ (element.getAttribute('src')));
  });

  if (!urls.size) {
    return;
  }

  urls.forEach((url) => URL.revokeObjectURL(url));

  // Update the store directly because the passed `asset` can be a proxy
  get(allAssets).forEach((asset) => {
    if (asset.blobURL !== undefined && urls.has(asset.blobURL)) {
      delete asset.blobURL;
    }
  });
};

/**
 * Revoke the blob URL for the given asset if it’s not being used in any elements.
 *
 * The revocations are batched, because every asset preview asks for one as it unmounts: leaving an
 * asset grid would otherwise run a document-wide query and a scan of every asset once per preview,
 * which is O(assets²) in the frame the page navigates away.
 * @param {Asset} asset Asset.
 */
export const revokeAssetBlobURLIfNeeded = ({ blobURL }) => {
  if (!blobURL) {
    return;
  }

  const isFirst = !pendingRevocations.size;

  // Queue before scheduling, so the flush can never observe an empty queue
  pendingRevocations.add(blobURL);

  if (isFirst) {
    window.requestAnimationFrame(flushRevocations);
  }
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
    if (pathOnly) {
      const assetFolderPath = getPathInfo(asset.path).dirname;

      const entryFolderPath = entry
        ? getPathInfo(Object.values(entry.locales)[0].path).dirname
        : undefined;

      if (assetFolderPath !== undefined && entryFolderPath !== undefined) {
        // If the asset is in the same folder as the entry, return the file name only
        if (assetFolderPath === entryFolderPath) {
          return asset.name;
        }

        // Return the path relative to the entry’s folder, e.g. `images/photo.jpg`, or `undefined`
        // if the path cannot be determined
        const prefix = `${entryFolderPath}/`;

        return asset.path.startsWith(prefix) ? asset.path.slice(prefix.length) : undefined;
      }

      const { internalPath, internalSubPath } = asset.folder;

      // Resolve simple entry-relative paths like `images/photo.jpg` if the asset is in the same
      // folder as the entry
      if (asset.path === createPath([internalPath, internalSubPath, asset.name])) {
        return asset.path.slice(/** @type {string} */ (internalPath).length + 1);
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
          const tag = segment.match(TEMPLATE_TAG_REGEX)?.[1];

          return tag ? `(?<${tag}>[^/]+)` : escapeRegExp(segment);
        }),
        publicPath?.replaceAll(TEMPLATE_TAG_REPLACE_REGEX, '$<$1>') ?? '',
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
 * @param {string} [args.componentName] Custom editor component name for a field-level asset folder.
 * @param {MediaField} [args.fieldConfig] Field configuration.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @param {boolean} [args.thumbnail] Whether to use a thumbnail of the image.
 * @returns {Promise<string | undefined>} Blob URL or public URL that can be used in the app UI.
 */
export const getMediaFieldURL = async ({
  value,
  entry,
  collectionName,
  fileName,
  componentName,
  fieldConfig,
  typedKeyPath,
  thumbnail = false,
}) => {
  if (!value) {
    return undefined;
  }

  if (URL_REGEX.test(value)) {
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

  const asset = getAssetByPath({
    value,
    entry,
    collectionName,
    fileName,
    componentName,
    typedKeyPath,
  });

  if (!asset) {
    return undefined;
  }

  return (
    (thumbnail ? await getAssetThumbnailURL(asset) : await getAssetBlobURL(asset)) ??
    getAssetPublicURL(asset)
  );
};
