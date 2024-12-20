import { getPathInfo, isTextFileType } from '@sveltia/utils/file';
import { IndexedDB } from '@sveltia/utils/storage';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';
import { flatten } from 'flat';
import mime from 'mime';
import { derived, get, writable } from 'svelte/store';
import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByAssetURL } from '$lib/services/contents/collection/entries';
import { getFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';
import { fillSlugTemplate } from '$lib/services/contents/entry/slug';
import { createPath, resolvePath } from '$lib/services/utils/file';
import { convertImage, getMediaMetadata, renderPDF } from '$lib/services/utils/media';

export const mediaKinds = ['image', 'video', 'audio'];
export const assetKinds = [...mediaKinds, 'document', 'other'];
/**
 * Common file extension regex list that can be used for filtering.
 * @type {Record<string, RegExp>}
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
 * @type {import('svelte/store').Writable<boolean>}
 */
export const showAssetOverlay = writable(false);
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
 * @type {import('svelte/store').Writable<Asset | undefined>}
 */
export const renamingAsset = writable();

/**
 * Check if the given asset kind is media.
 * @param {string} kind - Kind, e.g. `image` or `video`.
 * @returns {boolean} Result.
 */
export const isMediaKind = (kind) => mediaKinds.includes(kind);

/**
 * Whether the given asset is previewable.
 * @param {Asset} asset - Asset.
 * @returns {boolean} Result.
 */
export const canPreviewAsset = (asset) => {
  const type = mime.getType(asset.path);

  return isMediaKind(asset.kind) || type === 'application/pdf' || (!!type && isTextFileType(type));
};

/**
 * Get the media type of the given blob or path.
 * @param {Blob | string} source - Blob, blob URL, or asset path.
 * @returns {Promise<AssetKind | undefined>} Kind.
 */
export const getMediaKind = async (source) => {
  let mimeType = '';

  if (typeof source === 'string') {
    if (source.startsWith('blob:')) {
      try {
        mimeType = (await (await fetch(source)).blob()).type;
      } catch {
        //
      }
    } else {
      mimeType = mime.getType(source) ?? '';
    }
  } else if (source instanceof Blob) {
    mimeType = source.type;
  }

  if (!mimeType) {
    return undefined;
  }

  const [type, subType] = mimeType.split('/');

  if (isMediaKind(type) && !subType.startsWith('x-')) {
    return /** @type {AssetKind} */ (type);
  }

  return undefined;
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
    Object.entries(assetExtensions).find(([, regex]) => regex.test(name))?.[0] ?? 'other'
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
 * @returns {Promise<string | undefined>} Thumbnail blob URL.
 */
export const getAssetThumbnailURL = async (asset) => {
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
    const blob = await getAssetBlob(asset);
    const options = { format: /** @type {'webp'} */ ('webp'), quality: 0.85, dimension: 512 };

    thumbnailBlob = isPDF ? await renderPDF(blob, options) : await convertImage(blob, options);

    await thumbnailDB?.set(asset.sha, thumbnailBlob);
  }

  return URL.createObjectURL(thumbnailBlob);
};

/**
 * Get collection asset folders that match the given path.
 * @param {string} path - Asset path.
 * @param {object} [options] - Options.
 * @param {boolean} [options.matchSubFolders] - Whether to match assets stored in the subfolders of
 * a global/collection internal path. By default (`false`), for example, if the given `path` is
 * `images/products/image.jpg`, it matches the `images/products` folder but not `images`.
 * @returns {CollectionAssetFolder[]} Asset folders.
 */
export const getAssetFoldersByPath = (path, { matchSubFolders = false } = {}) => {
  const { filename } = getPathInfo(path);

  // Exclude files with a leading `+` sign, which are Svelte page/layout files
  if (filename.startsWith('+')) {
    return [];
  }

  return get(allAssetFolders)
    .filter(({ internalPath, entryRelative }) => {
      if (entryRelative) {
        return path.startsWith(`${internalPath}/`);
      }

      // Compare that the enclosing directory is exactly the same as the internal path, and ignore
      // any subdirectories, unless the `matchSubFolders` option is specified. The internal path can
      // contain template tags like `{{slug}}` so that we have to take it into account.
      const regex = new RegExp(
        `^${internalPath.replace(/{{.+?}}/g, '.+?')}${internalPath && matchSubFolders ? '\\b' : '$'}`,
      );

      return regex.test(getPathInfo(path).dirname ?? '');
    })
    .sort((a, b) => b.internalPath?.localeCompare(a.internalPath ?? '') ?? 0);
};

/**
 * Get a list of collections the given asset belongs to.
 * @param {Asset} asset - Asset.
 * @returns {Collection[]} Collections.
 */
export const getCollectionsByAsset = (asset) =>
  getAssetFoldersByPath(asset.path, { matchSubFolders: true })
    .map(({ collectionName }) => (collectionName ? getCollection(collectionName) : undefined))
    .filter((collection) => !!collection);

/**
 * Get an asset by a public path typically stored as an image field value.
 * @param {string} savedPath - Saved absolute path or relative path.
 * @param {object} [options] - Options.
 * @param {Entry} [options.entry] - Associated entry to be used to help locale an asset from a
 * relative path. Can be `undefined` when editing a new draft.
 * @param {Collection} [options.collection] - Associated collection. Can be undefined, then it will
 * be automatically determined from the entry.
 * @returns {Asset | undefined} Corresponding asset.
 */
export const getAssetByPath = (savedPath, { entry, collection } = {}) => {
  // Handle a relative path. A path starting with `@`, like `@assets/images/...` is a special case,
  // considered as an absolute path.
  if (!/^[/@]/.test(savedPath)) {
    if (!entry) {
      return undefined;
    }

    const { locales } = entry;

    /**
     * Find an asset.
     * @param {Collection | CollectionFile} input - Collection or single collection file.
     * @returns {Asset | undefined} Found asset.
     */
    const getAsset = ({ _i18n }) => {
      const { defaultLocale } = _i18n;
      const locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0];
      const { path: entryFilePath, content: entryContent } = locales[locale];

      if (!entryFilePath || !entryContent) {
        return undefined;
      }

      const { entryFolder } = entryFilePath.match(/(?<entryFolder>.+?)(?:\/[^/]+)?$/)?.groups ?? {};
      const resolvedPath = resolvePath(`${entryFolder}/${savedPath}`);

      return get(allAssets).find((asset) => asset.path === resolvedPath);
    };

    const assets = getAssociatedCollections(entry).map((_collection) => {
      const collectionFiles = getFilesByEntry(_collection, entry);

      if (collectionFiles.length) {
        return collectionFiles.map(getAsset);
      }

      return getAsset(_collection);
    });

    return (
      assets.flat(1).filter(Boolean)[0] ??
      // Fall back to exact match at the root folder
      get(allAssets).find((asset) => asset.path === savedPath)
    );
  }

  const exactMatch = get(allAssets).find((asset) => asset.path === stripSlashes(savedPath));

  if (exactMatch) {
    return exactMatch;
  }

  const { dirname: publicPath, basename: fileName } = getPathInfo(savedPath);

  if (!publicPath) {
    return undefined;
  }

  // eslint-disable-next-line prefer-const
  let { internalPath, collectionName } =
    get(allAssetFolders).findLast((folder) =>
      publicPath.match(`^${folder.publicPath.replace(/{{.+?}}/g, '.+?')}\\b`),
    ) ?? {};

  if (internalPath === undefined) {
    return undefined;
  }

  // Find a global/uncategorized asset
  if (!collectionName) {
    const fullPath = savedPath.replace(new RegExp(`^${escapeRegExp(publicPath)}`), internalPath);
    const globalAsset = get(allAssets).find((asset) => asset.path === fullPath);

    if (globalAsset) {
      return globalAsset;
    }
  }

  if (entry && !collection) {
    [collection] = getAssociatedCollections(entry);
  }

  if (entry && collection && /{{.+?}}/.test(internalPath)) {
    const { content, path } = entry.locales[collection._i18n.defaultLocale];

    internalPath = fillSlugTemplate(internalPath, {
      type: 'media_folder',
      // eslint-disable-next-line object-shorthand
      collection: /** @type {EntryCollection} */ (collection),
      content: flatten(content),
      currentSlug: entry.slug,
      entryFilePath: path,
    });
  }

  const _publicPath = collection?._assetFolder?.publicPath;

  const subPath = _publicPath
    ? stripSlashes(publicPath.replace(new RegExp(`^${escapeRegExp(_publicPath)}`), ''))
    : '';

  const fullPath = createPath([internalPath, subPath, fileName]);

  return get(allAssets).find((asset) => asset.path === fullPath);
};

/**
 * Get the public URL for the given asset.
 * @param {Asset} asset - Asset file, such as an image.
 * @param {object} [options] - Options.
 * @param {boolean} [options.pathOnly] - Whether to use the absolute path starting with `/` instead
 * of the complete URL starting with `https`.
 * @param {boolean} [options.allowSpecial] - Whether to allow returning a special, unlinkable path
 * starting with `@`, etc.
 * @param {Entry} [options.entry] - Associated entry to be used to help locale an asset from a
 * relative path. Can be `undefined` when editing a new draft.
 * @returns {string | undefined} URL or `undefined` if it cannot be determined.
 */
export const getAssetPublicURL = (
  asset,
  { pathOnly = false, allowSpecial = false, entry = undefined } = {},
) => {
  const _allAssetFolders = get(allAssetFolders);

  const { publicPath, entryRelative } =
    _allAssetFolders.find(({ collectionName }) =>
      getCollectionsByAsset(asset).some((collection) => collection.name === collectionName),
    ) ??
    _allAssetFolders.find(({ collectionName }) => !collectionName) ??
    {};

  // Cannot determine the URL if it’s relative to an entry, unless the asset is in the same folder
  if (entryRelative) {
    if (
      pathOnly &&
      !!entry &&
      getPathInfo(asset.path).dirname === getPathInfo(Object.values(entry.locales)[0].path).dirname
    ) {
      return asset.name;
    }

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
 * path. Can be `undefined` when editing a new draft.
 * @param {object} [options] - Options.
 * @param {boolean} [options.thumbnail] - Whether to use a thumbnail of the image.
 * @returns {Promise<string | undefined>} Blob URL or public URL that can be used in the app UI.
 */
export const getMediaFieldURL = async (value, entry, { thumbnail = false } = {}) => {
  if (!value) {
    return undefined;
  }

  if (/^(?:https?|data|blob):/.test(value)) {
    return value;
  }

  const asset = getAssetByPath(value, { entry });

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
 * @param {Asset} asset - Asset.
 * @returns {Promise<AssetDetails>} Details.
 */
export const getAssetDetails = async (asset) => {
  const { kind, path } = asset;
  const { blobBaseURL } = get(backend)?.repository ?? {};
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
    repoBlobURL: blobBaseURL ? `${blobBaseURL}/${path}` : undefined,
    dimensions,
    duration,
    usedEntries: url ? await getEntriesByAssetURL(url) : [],
  };
};

/**
 * Get a list of assets stored in the given collection defined folder.
 * @param {string} folder - Folder path.
 * @returns {Asset[]} Assets.
 */
export const getAssetsByFolder = (folder) => get(allAssets).filter((a) => a.folder === folder);

/**
 * Get a list of assets stored in the given internal directory.
 * @param {string} dirname - Directory path.
 * @returns {Asset[]} Assets.
 */
export const getAssetsByDirName = (dirname) =>
  get(allAssets).filter((a) => getPathInfo(a.path).dirname === dirname);

// Reset the asset selection when a different folder is selected
selectedAssetFolder.subscribe(() => {
  focusedAsset.set(undefined);
});
