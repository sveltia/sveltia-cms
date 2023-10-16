import { flatten } from 'flat';
import { derived, get, writable } from 'svelte/store';
import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { getCollection, getEntriesByAssetURL } from '$lib/services/contents';
import { fillSlugTemplate } from '$lib/services/contents/slug';
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
 * @type {import('svelte/store').Writable<CollectionAssetPaths[]>}
 */
export const allAssetPaths = writable([]);

/**
 * @type {import('svelte/store').Writable<string | undefined>}
 */
export const selectedAssetFolderPath = writable();

/**
 * @type {import('svelte/store').Writable<Asset[]>}
 */
export const selectedAssets = writable([]);

/**
 * @type {import('svelte/store').Writable<Asset | undefined>}
 */
export const selectedAsset = writable();

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
 * Get the internal/public asset path configuration by collection.
 * @param {Collection} collection Collection.
 * @param {any} fillSlugOptions Options to be passed to {@link fillSlugTemplate}.
 * @returns {{ internalAssetFolder: string, publicAssetFolder: string }} Determined paths.
 */
export const getAssetFolder = (collection, fillSlugOptions) => {
  const { entryRelative, internalPath, publicPath } = get(allAssetPaths).findLast((p) =>
    [null, collection.name].includes(p.collectionName),
  );

  if (entryRelative) {
    const entryFolder = collection.path ? collection.path.split('/').slice(0, -1).join('/') : '.';

    return {
      internalAssetFolder: resolvePath(
        fillSlugTemplate(`${internalPath}/${entryFolder}`, fillSlugOptions),
      ),
      // Dot-only public path is a special case; the final path stored as the field value will be
      // `./image.png` rather than `image.png`
      publicAssetFolder: publicPath.match(/^\.?$/)
        ? publicPath
        : resolvePath(fillSlugTemplate(publicPath, fillSlugOptions)),
    };
  }

  return {
    internalAssetFolder: internalPath,
    publicAssetFolder: publicPath,
  };
};

/**
 * Determine the asset’s kind from the file extension.
 * @param {string} name File name or path.
 * @returns {AssetKind} One of {@link assetKinds}.
 */
export const getAssetKind = (name) =>
  /** @type {AssetKind} */ (
    Object.entries(assetExtensions).find(([, regex]) => name.match(regex))?.[0] || 'other'
  );

/**
 * Get an asset by a public path typically stored as an image field value.
 * @param {string} savedPath Saved absolute path or relative path.
 * @param {Entry} entry Associated entry to be used to help locale an asset from a relative path.
 * @returns {(Asset | undefined)} Corresponding asset.
 */
export const getAssetByPath = (savedPath, entry) => {
  // Handle relative path
  if (!savedPath.startsWith('/')) {
    if (!entry) {
      return undefined;
    }

    const { collectionName, locales } = entry;
    const collection = getCollection(collectionName);

    const {
      _i18n: { defaultLocale = 'default' },
      public_folder: publicFolder,
    } = collection;

    const locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0];
    const { path: entryFilePath, content: entryContent } = locales[locale];

    if (!entryFilePath || !entryContent) {
      return undefined;
    }

    const entryFolder = entryFilePath.split('/').slice(0, -1).join('/');

    const slug = publicFolder
      ? fillSlugTemplate(publicFolder, {
          collection,
          content: flatten(entryContent),
          currentSlug: entry.slug,
          isMediaFolder: true,
          entryFilePath,
        })
      : '.';

    const resolvedPath = resolvePath(`${entryFolder}/${slug}/${savedPath}`);

    return get(allAssets).find((asset) => asset.path === resolvedPath);
  }

  const [, publicPath, fileName] = savedPath.match(/(.+?)\/([^/]+)$/) || [];

  if (!publicPath) {
    return undefined;
  }

  const { internalPath } =
    get(allAssetPaths).findLast((config) => config.publicPath === publicPath) || {};

  if (!internalPath) {
    return undefined;
  }

  return get(allAssets).find((asset) => asset.path === `${internalPath}/${fileName}`);
};

/**
 * Get the public URL for the given asset.
 * @param {Asset} asset Asset file, such as an image.
 * @param {object} [options] Options.
 * @param {boolean} [options.pathOnly] Whether to use the absolute path instead of the complete URL.
 * @returns {Promise<(string | undefined)>} URL that can be used or displayed in the app UI. This is
 * mostly a Blob URL of the asset.
 */
export const getAssetURL = async (asset, { pathOnly = false } = {}) => {
  if (!asset) {
    return undefined;
  }

  const isBlobURL = asset.url?.startsWith('blob:');

  if (isBlobURL && !pathOnly) {
    return asset.url;
  }

  if (!asset.url && (asset.file || asset.fetchURL) && !pathOnly) {
    const url = URL.createObjectURL(asset.file || (await get(backend).fetchBlob(asset)));

    // Cache the URL
    allAssets.update((assets) => [
      ...assets.filter(({ sha, path }) => !(sha === asset.sha && path === asset.path)),
      { ...asset, url },
    ]);

    return url;
  }

  const { publicPath, entryRelative } =
    get(allAssetPaths).find(({ collectionName }) => collectionName === asset.collectionName) ||
    get(allAssetPaths).find(({ collectionName }) => collectionName === null);

  if (entryRelative) {
    return isBlobURL ? asset.url : undefined;
  }

  const baseURL = pathOnly ? '' : get(siteConfig).site_url || '';
  const path = asset.path.replace(asset.folder, publicPath);

  return `${baseURL}${path}`;
};

/**
 * Get the public URL from the given image/file entry field value.
 * @param {string} value Saved field value. It can be an absolute path, entry-relative path, or a
 * complete/external URL.
 * @param {Entry} entry Associated entry.
 * @returns {Promise<(string | undefined)>} URL that can be displayed in the app UI.
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
 * @param {Asset} asset Asset.
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
    displayURL: url,
    dimensions,
    duration,
    usedEntries: await getEntriesByAssetURL(url),
  };
};
