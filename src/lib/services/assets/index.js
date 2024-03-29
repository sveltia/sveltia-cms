import mime from 'mime';
import { derived, get, writable } from 'svelte/store';
import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { getCollection, getEntriesByAssetURL } from '$lib/services/contents';
import { resolvePath } from '$lib/services/utils/files';
import { getMediaMetadata } from '$lib/services/utils/media';

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
 * @type {import('svelte/store').Readable<boolean>}
 */
export const showUploadAssetsDialog = derived([uploadingAssets], ([_uploadingAssets], set) => {
  set(!!_uploadingAssets.files?.length);
});

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
 * Get the URL for the given asset. It can be a blob URL or public URL depending on the options.
 * @param {Asset | undefined} asset - Asset file, such as an image.
 * @param {object} [options] - Options.
 * @param {boolean} [options.pathOnly] - Whether to use the absolute path instead of the complete
 * URL.
 * @param {boolean} [options.publicURL] - Whether to return the public URL on the live site.
 * @returns {Promise<string | undefined>} URL that can be used or displayed in the app UI. This is
 * mostly a Blob URL of the asset.
 */
export const getAssetURL = async (asset, { pathOnly = false, publicURL = false } = {}) => {
  if (!asset) {
    return undefined;
  }

  const isBlobURL = asset.url?.startsWith('blob:');

  if (isBlobURL && !pathOnly && !publicURL) {
    return asset.url;
  }

  if (!asset.url && (asset.file || asset.fetchURL) && !pathOnly && !publicURL) {
    const blob = asset.file ?? (await get(backend)?.fetchBlob?.(asset));

    if (!blob) {
      return undefined;
    }

    const url = URL.createObjectURL(blob);

    // Cache the URL
    allAssets.update((assets) => [
      ...assets.filter(({ sha, path }) => !(sha === asset.sha && path === asset.path)),
      { ...asset, url },
    ]);

    return url;
  }

  const { publicPath, entryRelative } =
    get(allAssetFolders).find(({ collectionName }) => collectionName === asset.collectionName) ??
    get(allAssetFolders).find(({ collectionName }) => collectionName === null) ??
    {};

  if (entryRelative) {
    return isBlobURL ? asset.url : undefined;
  }

  const baseURL = pathOnly ? '' : get(siteConfig)?.site_url ?? '';
  const path = asset.path.replace(asset.folder, publicPath ?? '');

  // Path starting with `@`, etc. cannot be linked
  if (!path.startsWith('/')) {
    return undefined;
  }

  return `${baseURL}${path}`;
};

/**
 * Get the public URL from the given image/file entry field value.
 * @param {string} value - Saved field value. It can be an absolute path, entry-relative path, or a
 * complete/external URL.
 * @param {Entry} [entry] - Associated entry to be used to help locale an asset from a relative
 * path. Can be `undefined` when editing a draft.
 * @returns {Promise<string | undefined>} URL that can be displayed in the app UI.
 */
export const getMediaFieldURL = async (value, entry) => {
  if (!value) {
    return undefined;
  }

  if (value.match(/^(?:https?|data):/)) {
    return value;
  }

  return getAssetURL(getAssetByPath(value, entry));
};

/**
 * Get the given asset’s extra info.
 * @param {Asset} asset - Asset.
 * @returns {Promise<AssetDetails>} Details.
 */
export const getAssetDetails = async (asset) => {
  const { kind } = asset;
  const url = await getAssetURL(asset);
  let dimensions;
  let duration;

  if (['image', 'video', 'audio'].includes(kind) && url) {
    ({ dimensions, duration } = await getMediaMetadata(url, kind));
  }

  return {
    publicURL: await getAssetURL(asset, { publicURL: true }),
    dimensions,
    duration,
    usedEntries: url ? await getEntriesByAssetURL(url) : [],
  };
};

/**
 * Get the blob for the given asset. Override the MIME type as it can be `application/octet-stream`.
 * @param {Asset} asset - Asset.
 * @returns {Promise<Blob>} Blob.
 */
export const getBlob = async (asset) => {
  const { file, url, path } = /** @type {{ file: Blob, url: string, path: string }} */ (asset);
  const blob = file ?? (await fetch(url).then((r) => r.blob()));
  const type = mime.getType(path) ?? blob.type;

  return new Blob([blob], { type });
};

// Reset the asset selection when a different folder is selected
selectedAssetFolder.subscribe(() => {
  focusedAsset.set(undefined);
});
