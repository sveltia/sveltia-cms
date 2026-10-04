import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp } from '@sveltia/utils/string';
import mime from 'mime';

import { getAssetFoldersByPath, globalAssetFolder } from '$lib/services/assets/folders';
import { canCreateThumbnail, hasPDFThumbnail } from '$lib/services/assets/kinds';
import { allAssets } from '$lib/services/assets/state';
import { backend } from '$lib/services/backends';
import {
  TEMPLATE_TAG_REGEX,
  TEMPLATE_TAG_REPLACE_REGEX,
} from '$lib/services/common/template/constants';
import { cmsConfig } from '$lib/services/config';
import { shareInFlight } from '$lib/services/utils/cache';
import { getRepositoryDatabase } from '$lib/services/utils/database';
import { createPath, createPathRegEx, encodeFilePath } from '$lib/services/utils/file';
import { createInertSVG } from '$lib/services/utils/media/image/svg';
import {
  THUMBNAIL_TRANSFORM_OPTIONS,
  transformImage,
} from '$lib/services/utils/media/image/transform';
import { renderPDF } from '$lib/services/utils/media/pdf';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import {
 * Asset,
 * AssetFolderInfo,
 * Entry,
 * InternalCmsConfig,
 * } from '$lib/types/private';
 */

/**
 * Blobs behind the object URLs cached on assets, keyed by blob URL. An object URL already keeps its
 * blob alive in memory until it’s revoked, so remembering the blob here costs nothing extra, and it
 * spares every caller after the first from reading the same URL back over the network. It’s also
 * the only way to get an SVG image back, as its URL points to a wrapper made for display rather
 * than the file itself, see {@link getDisplayBlob}.
 *
 * Only blobs the asset doesn’t hold otherwise — downloaded or just saved — belong here, and only
 * under a URL that {@link flushRevocations} is responsible for revoking, because that’s where the
 * entry is discarded. A
 * blob whose URL is revoked elsewhere — an unsaved file’s URL, released by `revokeDraftFileURLs`
 * once the draft is replaced — would otherwise stay in memory for the lifetime of the page.
 * @type {Map<string, Blob>}
 */
const cachedBlobs = new Map();
/**
 * Asset blob downloads currently in flight, keyed by the blob URL or asset path being read. Several
 * components can ask for the same asset at once — the info panel and the toolbar both request an
 * asset’s details as soon as it’s selected — so they share a single download instead of each
 * starting their own.
 * @type {Map<string, Promise<Blob>>}
 */
const pendingAssetBlobs = new Map();

/* v8 ignore next */
/**
 * Reset the asset blob caches. This is used in tests to reset the state between tests.
 */
export const _resetAssetBlobCache = () => {
  cachedBlobs.clear();
  pendingAssetBlobs.clear();
};

/**
 * Regular expression matching an XML media type, such as `application/xml`, `text/xml` or
 * `application/xhtml+xml`. A browser renders such a file as a document, which can run script
 * through XHTML elements or an XSLT style sheet.
 */
const XML_TYPE_REGEX = /[/+]xml$/;

/**
 * Get a blob that can be displayed in place of the given file without running any script. An
 * object URL has the CMS origin, so a file from the repository opened in a new tab, e.g. with the
 * browser’s “Open Image in New Tab” menu item on a preview, would otherwise run any script in it
 * with access to the user’s token. An SVG image is wrapped in an image that can’t run script, see
 * {@link createInertSVG}, and an HTML or XML document is turned into plain text, as nothing
 * displays one as a document. Any other file is returned as is.
 * @param {Blob} blob Original file.
 * @returns {Promise<Blob>} Blob to be displayed.
 */
export const getDisplayBlob = async (blob) => {
  const type = blob.type.split(';')[0].trim().toLowerCase();

  if (type === 'image/svg+xml') {
    return createInertSVG(blob);
  }

  if (type === 'text/html' || XML_TYPE_REGEX.test(type)) {
    return new Blob([blob], { type: 'text/plain' });
  }

  return blob;
};

/**
 * Create an object URL to display the given file with, see {@link getDisplayBlob}. Use this for
 * any URL made from asset or file bytes that is shown in the UI. The URL doesn’t necessarily point
 * to the given bytes, so a caller that needs the file again has to keep the original rather than
 * read the URL back.
 * @param {Blob} blob Original file.
 * @returns {Promise<string>} Object URL.
 */
export const createDisplayBlobURL = async (blob) => URL.createObjectURL(await getDisplayBlob(blob));

/**
 * Give the asset an object URL for the given blob if it doesn’t have one yet. The URL points to the
 * blob to be displayed, see {@link getDisplayBlob}; the blob itself is left untouched.
 * @param {Asset} asset Asset.
 * @param {Blob} blob Blob.
 * @returns {Promise<Blob>} The same blob.
 */
const cacheAssetBlobURL = async (asset, blob) => {
  if (!asset.blobURL) {
    const displayBlob = await getDisplayBlob(blob);

    // Another caller may have created the URL while the wrapper was being made
    asset.blobURL ??= URL.createObjectURL(displayBlob);
  }

  return blob;
};

/**
 * Give the asset an object URL for the given blob, and remember the blob so that later callers can
 * have it without reading the URL back, which may point to a wrapper rather than the file itself.
 * Use this for a blob that the asset doesn’t hold otherwise, e.g. a downloaded or saved file.
 * @param {Asset} asset Asset.
 * @param {Blob} blob Blob.
 * @returns {Promise<Blob>} The same blob.
 */
export const cacheAssetBlob = async (asset, blob) => {
  await cacheAssetBlobURL(asset, blob);

  if (asset.blobURL) {
    cachedBlobs.set(asset.blobURL, blob);
  }

  return blob;
};

/**
 * Download a blob, letting concurrent callers waiting on the same source share one request. A
 * failed download is not remembered, so a later caller can try again.
 * @param {string} key Blob URL or asset path being read.
 * @param {() => Promise<Blob>} download Function that performs the download.
 * @returns {Promise<Blob>} Blob.
 */
const downloadOnce = (key, download) => shareInFlight(pendingAssetBlobs, key, download);

/**
 * Download the given asset from the backend, without caching it.
 * @param {Asset} asset Asset.
 * @returns {Promise<Blob>} Blob.
 * @throws {Error} When the blob cannot be retrieved.
 */
const downloadAssetBlob = async (asset) => {
  const { name } = asset;
  const blob = await backend.current?.fetchBlob?.(asset);

  if (!blob) {
    throw new Error('Failed to retrieve blob');
  }

  // Override the MIME type as it can be `application/octet-stream`
  return new Blob([blob], { type: mime.getType(name) ?? blob.type });
};

/**
 * Download the given asset from the backend, and cache it on the asset.
 * @param {Asset} asset Asset.
 * @returns {Promise<Blob>} Blob.
 * @throws {Error} When the blob cannot be retrieved.
 */
const fetchAssetBlob = async (asset) => cacheAssetBlob(asset, await downloadAssetBlob(asset));

/**
 * Get the blob for the given asset, from wherever it’s available: the file it was created from, the
 * object URL already cached on it, a file system handle, or the backend.
 * @param {Asset} asset Asset.
 * @returns {Promise<Blob>} Blob.
 * @throws {Error} When the blob cannot be retrieved.
 */
export const getAssetBlob = async (asset) => {
  const { file, handle, blobURL, path } = asset;

  // An unsaved asset holds the original file, which is the same data the object URL points at, so
  // use it directly rather than reading the URL back. Nothing is cached for it: the file is already
  // here, and its URL may be revoked by the draft rather than by `flushRevocations`
  if (file) {
    return cacheAssetBlobURL(asset, file);
  }

  if (blobURL) {
    // The URL can be created elsewhere in the app, in which case the blob has to be read back. The
    // result isn’t cached, because whoever created the URL also decides when to revoke it
    return (
      cachedBlobs.get(blobURL) ?? downloadOnce(blobURL, () => fetch(blobURL).then((r) => r.blob()))
    );
  }

  if (handle) {
    try {
      return await cacheAssetBlob(asset, await handle.getFile());
    } catch {
      throw new Error('Failed to retrieve blob from file handle');
    }
  }

  return downloadOnce(path, () => fetchAssetBlob(asset));
};

/**
 * Get the blob of the given asset to generate a thumbnail from. Unlike {@link getAssetBlob}, this
 * doesn’t cache the full-size file on the asset: the thumbnail is all that’s kept, so an asset grid
 * or an entry list showing hundreds of images doesn’t hold every original in memory as well. A blob
 * that’s already at hand — the unsaved file, the one behind the asset’s object URL, or a download
 * another caller has started — is used as is.
 * @param {Asset} asset Asset.
 * @returns {Promise<Blob>} Blob.
 * @throws {Error} When the blob cannot be retrieved.
 */
const getThumbnailSourceBlob = async (asset) => {
  const { file, handle, blobURL, path } = asset;

  if (file) {
    return file;
  }

  if (blobURL) {
    return getAssetBlob(asset);
  }

  const pending = pendingAssetBlobs.get(path);

  if (pending) {
    return pending;
  }

  if (handle) {
    try {
      return await handle.getFile();
    } catch {
      throw new Error('Failed to retrieve blob from file handle');
    }
  }

  return downloadAssetBlob(asset);
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
    thumbnailDB = getRepositoryDatabase(backend.current?.repository, 'asset-thumbnails') ?? null;
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
    const blob = await getThumbnailSourceBlob(asset);
    const transform = isPDF ? renderPDF : transformImage;

    thumbnailBlob = await transform(blob, THUMBNAIL_TRANSFORM_OPTIONS);

    await thumbnailDB?.set(asset.sha, thumbnailBlob);
  }

  return thumbnailBlob;
};

/**
 * Check if a thumbnail has been generated for the given file content. A thumbnail is only ever made
 * by decoding the file, so having one proves the file is a usable image, and a caller that would
 * otherwise decode the file just to validate it can skip that.
 * @param {string} sha Git object ID (SHA-1 hash) of the file.
 * @returns {Promise<boolean>} Whether a thumbnail is cached or being generated. A generation in
 * flight is awaited, as the outcome is what matters.
 */
export const hasCachedThumbnail = async (sha) => {
  initThumbnailDB();

  const pending = pendingThumbnailBlobs.get(sha);

  if (pending) {
    return !!(await pending.catch(() => undefined));
  }

  return !!(await thumbnailDB?.get(sha));
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
  if (!canCreateThumbnail(asset)) {
    return undefined;
  }

  const isPDF = hasPDFThumbnail(asset.name);

  initThumbnailDB();

  const { sha } = asset;

  if (cacheOnly && !pendingThumbnailBlobs.has(sha)) {
    // Nothing is being generated for this asset, so stick to a cache lookup as requested
    const cachedBlob = await thumbnailDB?.get(sha);

    return cachedBlob ? URL.createObjectURL(cachedBlob) : undefined;
  }

  // A `cacheOnly` caller joins an in-flight resolution rather than reading the database again: the
  // work is already happening, so waiting for it costs nothing extra
  const thumbnailBlob = await shareInFlight(pendingThumbnailBlobs, sha, () =>
    resolveThumbnailBlob(asset, isPDF),
  );

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

  urls.forEach((url) => {
    URL.revokeObjectURL(url);
    cachedBlobs.delete(url);
  });

  // Update the store directly because the passed `asset` can be a proxy
  allAssets.current.forEach((asset) => {
    if (asset.blobURL !== undefined && urls.has(asset.blobURL)) {
      delete asset.blobURL;
    }
  });
};

/**
 * Revoke the given blob URL if it’s not being used in any elements.
 *
 * The revocations are batched, because every asset preview asks for one as it unmounts: leaving an
 * asset grid would otherwise run a document-wide query and a scan of every asset once per preview,
 * which is O(assets²) in the frame the page navigates away.
 *
 * Deferring to the next frame is also what keeps a still-decoding image working: the flush skips
 * any URL an element is displaying, so a thumbnail is only released once nothing points at it.
 * @param {string | undefined} url Blob URL, or `undefined`/a non-blob URL to ignore.
 */
export const revokeBlobURLIfNeeded = (url) => {
  if (!url?.startsWith('blob:')) {
    return;
  }

  const isFirst = !pendingRevocations.size;

  // Queue before scheduling, so the flush can never observe an empty queue
  pendingRevocations.add(url);

  if (isFirst) {
    window.requestAnimationFrame(flushRevocations);
  }
};

/**
 * Revoke the blob URL for the given asset if it’s not being used in any elements.
 *
 * An unsaved asset is left alone, as its URL belongs to whoever created it: the entry draft, which
 * uses it as the field value until the entry is saved, or the asset picker, for a file dropped
 * into it. Revoking it here would break the field as soon as the picker is closed, if the field
 * hasn’t displayed the URL again by the next frame — which is the case when the same file is
 * picked again on a slow device.
 * @param {Asset} asset Asset.
 * @see https://github.com/sveltia/sveltia-cms/issues/1030
 */
export const revokeAssetBlobURLIfNeeded = ({ blobURL, unsaved }) => {
  if (!unsaved) {
    revokeBlobURLIfNeeded(blobURL);
  }
};

/**
 * Convert the path of an asset stored in a folder with template tags, like
 * `/assets/images/{{slug}}`, to its public path. Each tag in the internal path captures the text it
 * stands for, which then fills the same tag in the public path. A tag can share a path segment with
 * literal text, as in `post-{{slug}}`, and appear more than once.
 * @param {object} args Arguments.
 * @param {string} args.path Asset path, e.g. `static/images/post-hello/photo.jpg`.
 * @param {string} args.internalPath Folder’s internal path, e.g. `static/images/post-{{slug}}`.
 * @param {string} args.publicPath Folder’s public path, e.g. `/images/post-{{slug}}`.
 * @returns {string} Public path, e.g. `/images/post-hello/photo.jpg`.
 */
const replaceTemplatePath = ({ path, internalPath, publicPath }) => {
  /**
   * Capture group names by tag. A tag, like `{{slug | upper}}`, isn’t always a valid group name.
   * @type {Map<string, string>}
   */
  const groupNames = new Map();

  const regex = createPathRegEx(internalPath, (segment) => {
    const pattern = segment
      .split(TEMPLATE_TAG_REGEX)
      .map((part, index) => {
        // The odd parts are the tag names captured by the split
        if (index % 2 === 0) {
          return escapeRegExp(part);
        }

        const tag = part.trim();
        const groupName = groupNames.get(tag);

        if (groupName) {
          // The same text again
          return `\\k<${groupName}>`;
        }

        const newGroupName = `tag${groupNames.size}`;

        groupNames.set(tag, newGroupName);

        return `(?<${newGroupName}>[^/]+?)`;
      })
      .join('');

    // A tag at the end of the segment takes everything up to the next slash
    return `${pattern}(?=\\/|$)`;
  });

  return path.replace(regex, (...args) => {
    /** @type {Record<string, string>} */
    const groups = args.at(-1);

    return publicPath.replaceAll(TEMPLATE_TAG_REPLACE_REGEX, (tag, name) => {
      const groupName = groupNames.get(name.trim());

      return groupName ? groups[groupName] : tag;
    });
  });
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
        ) ??
        globalAssetFolder.current ??
        // There is no global folder without the global `media_folder` option
        asset.folder);

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
    /** @type {InternalCmsConfig} */ (cmsConfig.current);

  const internalPath = asset.folder.internalPath ?? '';
  const publicBasePath = publicPath === '/' ? '' : (publicPath ?? '');

  let path = hasTemplateTags
    ? replaceTemplatePath({ path: asset.path, internalPath, publicPath: publicBasePath })
    : internalPath
      ? asset.path.replace(internalPath, publicBasePath)
      : // An asset in a root media folder has no folder path to swap for the public path
        `${publicBasePath}/${asset.path}`;

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
 * Get the public path of a directory in an asset folder, which is saved as the value of a File
 * field with the `select_folder` option.
 * @param {object} args Arguments.
 * @param {AssetFolderInfo} args.folder Asset folder with a fixed path, which can be browsed by
 * subfolder.
 * @param {string} args.subfolderPath Path of the directory below the folder, relative to it. Empty
 * for the folder root.
 * @returns {string} Public path, e.g. `/images/gallery`.
 */
export const getFolderPublicPath = ({ folder, subfolderPath }) => {
  const { output: { encode_file_path: encodingEnabled = false } = {} } =
    /** @type {InternalCmsConfig} */ (cmsConfig.current);

  const basePath = (folder.publicPath ?? '').replace(/\/$/, '');
  const path = (subfolderPath ? `${basePath}/${subfolderPath}` : basePath) || '/';

  return encodingEnabled ? encodeFilePath(path) : path;
};
