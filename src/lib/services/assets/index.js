import { isTextFileType } from '@sveltia/utils/file';
import { IndexedDB } from '@sveltia/utils/storage';
import mime from 'mime';
import { derived, get, writable } from 'svelte/store';
import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { getCollection, getEntriesByAssetURL } from '$lib/services/contents';
import { resolvePath } from '$lib/services/utils/file';
import { convertImage, getMediaMetadata, renderPDF } from '$lib/services/utils/media';

export const assetKinds = ['image', 'video', 'audio', 'document', 'other'];

/**
 * Common file extension regex list that can be used for filtering.
 * @type {{ [key: string]: RegExp }}
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
 */
export const assetExtensions = {
  image: /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i,
  video: /\.(?:avi|mp4|mpeg|ogv|ts|webm|3gp|3g2)$/i,
  audio: /\.(?:aac|midi?|mp3|opus|wav|weba)$/i,
  document: /\.(?:csv|docx?|odp|ods|odt|pdf|pptx?|rtf|xslx?)$/i,
};

/**
 * @type {import('svelte/store').Writable<Asset[]>}
 */
export const allAssets = writable([]);

/**
 * @type {import('svelte/store').Writable<CollectionAssetFolder[]>}
 */
export const allAssetFolders = writable([]);

/**
 * @type {import('svelte/store').Readable<CollectionAssetFolder | undefined>}
 */
export const globalAssetFolder = derived([allAssetFolders], ([_allAssetFolders], set) => {
  set(_allAssetFolders.find(({ collectionName }) => !collectionName));
});

/**
 * @type {import('svelte/store').Writable<CollectionAssetFolder | undefined>}
 */
export const selectedAssetFolder = writable();

/**
 * @type {import('svelte/store').Writable<Asset[]>}
 */
export const selectedAssets = writable([]);

/**
 * @type {import('svelte/store').Writable<Asset | undefined>}
 */
export const focusedAsset = writable();

/**
 * Asset to be displayed in `<AssetDetailsOverlay>`.
 * @type {import('svelte/store').Writable<Asset | undefined>}
 */
export const overlaidAsset = writable();

/**
 * @type {import('svelte/store').Writable<UploadingAssets>}
 */
export const uploadingAssets = writable({ folder: undefined, files: [] });

/**
 * @type {import('svelte/store').Writable<Asset | undefined>}
 */
export const editingAsset = writable();

/**
 * Whether the given asset is previewable.
 * @param {Asset} asset - Asset.
 * @returns {boolean} Result.
 */
export const canPreviewAsset = (asset) => {
  const type = mime.getType(asset.path);

  return (
    ['image', 'audio', 'video'].includes(asset.kind) ||
    type === 'application/pdf' ||
    (!!type && isTextFileType(type))
  );
};

/**
 * Whether the given asset is editable.
 * @param {Asset} asset - Asset.
 * @returns {boolean} Result.
 * @todo Support image editing.
 */
export const canEditAsset = (asset) => {
  const type = mime.getType(asset.path);

  return !!type && isTextFileType(type);
};

/**
 * Determine the asset’s kind from the file extension.
 * @param {string} name - File name or path.
 * @returns {AssetKind} One of {@link assetKinds}.
 */
export const getAssetKind = (name) =>
  /** @type {AssetKind} */ (
    Object.entries(assetExtensions).find(([, regex]) => name.match(regex))?.[0] ?? 'other'
  );

/**
 * Get the blob for the given asset.
 * @param {Asset} asset - Asset.
 * @returns {Promise<Blob>} Blob.
 */
export const getAssetBlob = async (asset) => {
  const { file, blobURL, name } = asset;

  if (blobURL) {
    return fetch(blobURL).then((r) => r.blob());
  }

  /** @type {Blob} */
  let blob;

  if (file) {
    blob = file;
  } else {
    const _blob = await get(backend)?.fetchBlob?.(asset);

    if (!_blob) {
      throw new Error('Failed to retrieve blob');
    }

    // Override the MIME type as it can be `application/octet-stream`
    blob = new Blob([_blob], { type: mime.getType(name) ?? _blob.type });
  }

  // Cache the URL
  asset.blobURL = URL.createObjectURL(blob);

  return blob;
};

/**
 * Get the blob URL for the given asset.
 * @param {Asset} asset - Asset.
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
 * @param {Asset} asset - Asset.
 * @returns {Promise<string>} Thumbnail blob URL.
 */
export const getAssetThumbnailURL = async (asset) => {
  // Use a cached image if available
  if (asset.thumbnailURL) {
    return asset.thumbnailURL;
  }

  // Initialize the thumbnail DB
  if (thumbnailDB === undefined) {
    const { repository: { service, owner, repo } = /** @type {RepositoryInfo} */ ({}) } =
      get(backend) ?? /** @type {BackendService} */ ({});

    thumbnailDB = repo ? new IndexedDB(`${service}:${owner}/${repo}`, 'asset-thumbnails') : null;
  }

  /** @type {Blob | undefined} */
  let thumbnailBlob = await thumbnailDB?.get(asset.sha);

  if (!thumbnailBlob) {
    const blob = await getAssetBlob(asset);
    const options = { format: /** @type {'webp'} */ ('webp'), quality: 0.85, dimension: 512 };

    thumbnailBlob = asset.name.endsWith('.pdf')
      ? await renderPDF(blob, options)
      : await convertImage(blob, options);

    await thumbnailDB?.set(asset.sha, thumbnailBlob);
  }

  const thumbnailURL = URL.createObjectURL(thumbnailBlob);

  // Cache the image as blob URL for later use
  asset.thumbnailURL = thumbnailURL;

  return thumbnailURL;
};

/**
 * Get an asset by a public path typically stored as an image field value.
 * @param {string} savedPath - Saved absolute path or relative path.
 * @param {Entry} [entry] - Associated entry to be used to help locale an asset from a relative
 * path. Can be `undefined` when editing a draft.
 * @returns {Asset | undefined} Corresponding asset.
 */
export const getAssetByPath = (savedPath, entry) => {
  // Handle a relative path. A path starting with `@`, like `@assets/images/...` is a special case,
  // considered as an absolute path.
  if (!savedPath.match(/^[/@]/)) {
    if (!entry) {
      return undefined;
    }

    const { collectionName, fileName, locales } = entry;
    const collection = getCollection(collectionName);

    if (!collection) {
      return undefined;
    }

    const collectionFile = fileName ? collection._fileMap?.[fileName] : undefined;
    const { defaultLocale } = (collectionFile ?? collection)._i18n;
    const locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0];
    const { path: entryFilePath, content: entryContent } = locales[locale];

    if (!entryFilePath || !entryContent) {
      return undefined;
    }

    const [, entryFolder] = entryFilePath.match(/(.+?)(?:\/[^/]+)?$/) ?? [];
    const resolvedPath = resolvePath(`${entryFolder}/${savedPath}`);

    return get(allAssets).find((asset) => asset.path === resolvedPath);
  }

  const [, publicPath, fileName] = savedPath.match(/(.+?)\/([^/]+)$/) ?? [];

  if (!publicPath) {
    return undefined;
  }

  const { internalPath } =
    get(allAssetFolders).findLast((config) => config.publicPath === publicPath) ?? {};

  if (!internalPath) {
    return undefined;
  }

  return get(allAssets).find((asset) => asset.path === `${internalPath}/${fileName}`);
};

/**
 * Get the public URL for the given asset.
 * @param {Asset} asset - Asset file, such as an image.
 * @param {object} [options] - Options.
 * @param {boolean} [options.pathOnly] - Whether to use the absolute path starting with `/` instead
 * of the complete URL starting with `https`.
 * @param {boolean} [options.allowSpecial] - Whether to allow returning a special, unlinkable path
 * starting with `@`, etc.
 * @returns {string | undefined} URL or `undefined` if it cannot be determined.
 */
export const getAssetPublicURL = (asset, { pathOnly = false, allowSpecial = false } = {}) => {
  const _allAssetFolders = get(allAssetFolders);

  const { publicPath, entryRelative } =
    _allAssetFolders.find(({ collectionName }) => collectionName === asset.collectionName) ??
    _allAssetFolders.find(({ collectionName }) => collectionName === null) ??
    {};

  // Cannot determine the URL if it’s relative to an entry
  if (entryRelative) {
    return undefined;
  }

  const path = asset.path.replace(asset.folder, publicPath ?? '');

  // Path starting with `@`, etc. cannot be linked
  if (!path.startsWith('/') && !allowSpecial) {
    return undefined;
  }

  if (pathOnly) {
    return path;
  }

  const baseURL = get(siteConfig)?.site_url ?? '';

  return `${baseURL}${path}`;
};

/**
 * Get the blob or public URL from the given image/file entry field value.
 * @param {string} value - Saved field value. It can be an absolute path, entry-relative path, or a
 * complete/external URL.
 * @param {Entry} [entry] - Associated entry to be used to help locale an asset from a relative
 * path. Can be `undefined` when editing a draft.
 * @param {object} [options] - Options.
 * @param {boolean} [options.thumbnail] - Whether to use a thumbnail of the image.
 * @returns {Promise<string | undefined>} Blob URL or public URL that can be used in the app UI.
 */
export const getMediaFieldURL = async (value, entry, { thumbnail = false } = {}) => {
  if (!value) {
    return undefined;
  }

  if (value.match(/^(?:https?|data):/)) {
    return value;
  }

  const asset = getAssetByPath(value, entry);

  if (!asset) {
    return undefined;
  }

  return (
    (thumbnail ? await getAssetThumbnailURL(asset) : await getAssetBlobURL(asset)) ??
    getAssetPublicURL(asset)
  );
};

/**
 * Get the given asset’s extra info.
 * @param {Asset} asset - Asset.
 * @returns {Promise<AssetDetails>} Details.
 */
export const getAssetDetails = async (asset) => {
  const { kind } = asset;
  const blobURL = await getAssetBlobURL(asset);
  const publicURL = getAssetPublicURL(asset);
  const url = blobURL ?? publicURL;
  let dimensions;
  let duration;

  if (['image', 'video', 'audio'].includes(kind) && blobURL) {
    ({ dimensions, duration } = await getMediaMetadata(blobURL, kind));
  }

  return {
    publicURL,
    dimensions,
    duration,
    usedEntries: url ? await getEntriesByAssetURL(url) : [],
  };
};

// Reset the asset selection when a different folder is selected
selectedAssetFolder.subscribe(() => {
  focusedAsset.set(undefined);
});
