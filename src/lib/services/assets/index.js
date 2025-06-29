import { getPathInfo, isTextFileType } from '@sveltia/utils/file';
import { IndexedDB } from '@sveltia/utils/storage';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';
import equal from 'fast-deep-equal';
import { flatten } from 'flat';
import mime from 'mime';
import { derived, get, writable } from 'svelte/store';
import { getDefaultMediaLibraryOptions, transformFile } from '$lib/services/assets/media-library';
import { backend } from '$lib/services/backends';
import { fillSlugTemplate } from '$lib/services/common/slug';
import { siteConfig } from '$lib/services/config';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByAssetURL } from '$lib/services/contents/collection/entries';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
import { getAssociatedCollections } from '$lib/services/contents/entry';
import {
  createPath,
  createPathRegEx,
  decodeFilePath,
  encodeFilePath,
  resolvePath,
} from '$lib/services/utils/file';
import { getMediaMetadata } from '$lib/services/utils/media';
import { transformImage } from '$lib/services/utils/media/image';
import { renderPDF } from '$lib/services/utils/media/pdf';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import {
 * Asset,
 * AssetDetails,
 * AssetFolderInfo,
 * AssetKind,
 * Entry,
 * InternalCollection,
 * InternalI18nOptions,
 * InternalImageTransformationOptions,
 * InternalSiteConfig,
 * ProcessedAssets,
 * UploadingAssets,
 * } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

export const MEDIA_KINDS = ['image', 'video', 'audio'];
export const ASSET_KINDS = [...MEDIA_KINDS, 'document', 'other'];
/**
 * Regular expression that matches common document file extensions.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
 */
export const DOC_EXTENSION_REGEX = /\.(?:csv|docx?|odp|ods|odt|pdf|pptx?|rtf|xslx?)$/i;
/**
 * @type {Writable<Asset[]>}
 */
export const allAssets = writable([]);
/**
 * @type {Writable<AssetFolderInfo[]>}
 */
export const allAssetFolders = writable([]);
/**
 * @type {Readable<AssetFolderInfo>}
 */
export const globalAssetFolder = derived([allAssetFolders], ([_allAssetFolders], set) => {
  set(
    /** @type {AssetFolderInfo} */ (
      _allAssetFolders.find(
        ({ collectionName, internalPath }) =>
          collectionName === undefined && internalPath !== undefined,
      )
    ),
  );
});
/**
 * @type {Writable<AssetFolderInfo | undefined>}
 */
export const selectedAssetFolder = writable();
/**
 * @type {Writable<Asset[]>}
 */
export const selectedAssets = writable([]);
/**
 * @type {Writable<Asset | undefined>}
 */
export const focusedAsset = writable();
/**
 * @type {Writable<boolean>}
 */
export const showAssetOverlay = writable(false);
/**
 * Asset to be displayed in `<AssetDetailsOverlay>`.
 * @type {Writable<Asset | undefined>}
 */
export const overlaidAsset = writable();
/**
 * @type {Writable<UploadingAssets>}
 */
export const uploadingAssets = writable({ folder: undefined, files: [] });
/**
 * @type {Writable<Asset | undefined>}
 */
export const editingAsset = writable();
/**
 * @type {Writable<Asset | undefined>}
 */
export const renamingAsset = writable();

/**
 * Upload target asset folder.
 * @type {Readable<AssetFolderInfo>}
 */
export const targetAssetFolder = derived(
  [selectedAssetFolder, globalAssetFolder],
  ([_selectedAssetFolder, _globalAssetFolder]) =>
    // When selecting All Assets folder, the `internalPath` will be `undefined`
    _selectedAssetFolder?.internalPath !== undefined ? _selectedAssetFolder : _globalAssetFolder,
);

/**
 * @type {Readable<ProcessedAssets>}
 */
export const processedAssets = derived([uploadingAssets], ([_uploadingAssets], set, update) => {
  set({
    processing: false,
    undersizedFiles: [],
    oversizedFiles: [],
    transformedFileMap: new WeakMap(),
  });

  const originalFiles = _uploadingAssets.files;
  const transformedFileMap = new WeakMap();
  const { max_file_size: maxSize, transformations } = getDefaultMediaLibraryOptions().config;
  /** @type {File[]} */
  let files = [];

  (async () => {
    if (originalFiles.length && transformations) {
      update((state) => ({ ...state, processing: true }));

      files = await Promise.all(
        originalFiles.map(async (file) => {
          const newFile = await transformFile(file, transformations);

          if (newFile !== file) {
            transformedFileMap.set(newFile, file);
          }

          return newFile;
        }),
      );
    } else {
      files = [...originalFiles];
    }

    update(() => ({
      processing: false,
      undersizedFiles: files.filter(({ size }) => size <= /** @type {number} */ (maxSize)),
      oversizedFiles: files.filter(({ size }) => size > /** @type {number} */ (maxSize)),
      transformedFileMap,
    }));
  })();
});

/**
 * Check if the given asset kind is media.
 * @param {string} kind Kind, e.g. `image` or `video`.
 * @returns {boolean} Result.
 */
export const isMediaKind = (kind) => MEDIA_KINDS.includes(kind);

/**
 * Whether the given asset is previewable.
 * @param {Asset} asset Asset.
 * @returns {boolean} Result.
 */
export const canPreviewAsset = (asset) => {
  const type = mime.getType(asset.path);

  return isMediaKind(asset.kind) || type === 'application/pdf' || (!!type && isTextFileType(type));
};

/**
 * Get the media type of the given blob or path.
 * @param {Blob | string} source Blob, blob URL, or asset path.
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
 * @param {Asset} asset Asset.
 * @returns {boolean} Result.
 * @todo Support image editing.
 */
export const canEditAsset = (asset) => {
  const type = mime.getType(asset.path);

  return !!type && isTextFileType(type);
};

/**
 * Determine the asset’s kind from the file extension.
 * @param {string} name File name or path.
 * @returns {AssetKind} One of {@link ASSET_KINDS}.
 */
export const getAssetKind = (name) =>
  /** @type {AssetKind} */ (
    mime.getType(name)?.match(/^(?<type>image|audio|video)\//)?.groups?.type ??
      (DOC_EXTENSION_REGEX.test(name) ? 'document' : 'other')
  );

/**
 * Get the blob for the given asset.
 * @param {Asset} asset Asset.
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
 * Get an asset folder that matches the given condition.
 * @param {object} args Arguments.
 * @param {string | undefined} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {FieldKeyPath} [args.keyPath] Field key path.
 * @returns {AssetFolderInfo | undefined} Asset folder information.
 */
export const getAssetFolder = ({ collectionName, fileName, keyPath }) =>
  get(allAssetFolders).find(
    (f) => f.collectionName === collectionName && f.fileName === fileName && f.keyPath === keyPath,
  );

/**
 * Get collection asset folders that match the given path.
 * @param {string} path Asset path.
 * @param {object} [options] Options.
 * @param {boolean} [options.matchSubFolders] Whether to match assets stored in the subfolders of a
 * global/collection internal path. By default (`false`), for example, if the given `path` is
 * `images/products/image.jpg`, it matches the `images/products` folder but not `images`.
 * @returns {AssetFolderInfo[]} Asset folders.
 */
export const getAssetFoldersByPath = (path, { matchSubFolders = false } = {}) => {
  const { filename } = getPathInfo(path);

  // Exclude files with a leading `+` sign, which are Svelte page/layout files
  if (filename.startsWith('+')) {
    return [];
  }

  return get(allAssetFolders)
    .filter(({ internalPath, entryRelative }) => {
      if (internalPath === undefined) {
        return false;
      }

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
    .sort((a, b) => (b.internalPath ?? '').localeCompare(a.internalPath ?? '') ?? 0);
};

/**
 * Get a list of collections the given asset belongs to.
 * @param {Asset} asset Asset.
 * @returns {InternalCollection[]} Collections.
 */
export const getCollectionsByAsset = (asset) =>
  getAssetFoldersByPath(asset.path, { matchSubFolders: true })
    .map(({ collectionName }) => (collectionName ? getCollection(collectionName) : undefined))
    .filter((collection) => !!collection);

/**
 * Find an asset.
 * @param {object} context Context.
 * @param {string} context.path Saved relative path.
 * @param {Entry} context.entry Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {InternalI18nOptions} context._i18n I18n options for the collection or collection file.
 * @returns {Asset | undefined} Found asset.
 */
const getAsset = ({ path, entry, _i18n }) => {
  const { locales } = entry;
  const { defaultLocale } = _i18n;
  const locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0];
  const { path: entryFilePath, content: entryContent } = locales[locale];

  if (!entryFilePath || !entryContent) {
    return undefined;
  }

  const { entryFolder } = entryFilePath.match(/(?<entryFolder>.+?)(?:\/[^/]+)?$/)?.groups ?? {};
  const resolvedPath = resolvePath(`${entryFolder}/${path}`);

  return get(allAssets).find((asset) => asset.path === resolvedPath);
};

/**
 * Get an asset by a relative public path typically stored as an image field value.
 * @param {object} args Arguments.
 * @param {string} args.path Saved relative path.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @returns {Asset | undefined} Corresponding asset.
 */
const getAssetByRelativePath = ({ path, entry }) => {
  if (!entry) {
    return undefined;
  }

  const assets = getAssociatedCollections(entry).map((_collection) => {
    const collectionFiles = getCollectionFilesByEntry(_collection, entry);

    if (collectionFiles.length) {
      return collectionFiles.map((file) => getAsset({ path, entry, _i18n: file._i18n }));
    }

    return getAsset({ path, entry, _i18n: _collection._i18n });
  });

  return (
    assets.flat(1).filter(Boolean)[0] ??
    // Fall back to exact match at the root folder
    get(allAssets).find((asset) => asset.path === path)
  );
};

/**
 * Get an asset by an absolute public path typically stored as an image field value.
 * @param {object} args Arguments.
 * @param {string} args.path Saved absolute path.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @returns {Asset | undefined} Corresponding asset.
 */
const getAssetByAbsolutePath = ({ path, entry, collectionName, fileName }) => {
  const exactMatch = get(allAssets).find((asset) => asset.path === stripSlashes(path));

  if (exactMatch) {
    return exactMatch;
  }

  const { dirname: dirName = '', basename: baseName } = getPathInfo(path);
  /** @type {Asset | undefined} */
  let foundAsset = undefined;

  const scanningFolders = [
    getAssetFolder({ collectionName, fileName }),
    getAssetFolder({ collectionName }),
    get(globalAssetFolder),
    get(allAssetFolders).findLast((folder) =>
      dirName.match(`^${(folder.publicPath ?? '').replace(/{{.+?}}/g, '.+?')}\\b`),
    ),
  ].filter((folder) => !!folder);

  // Use `find` to stop scanning folders as soon as the asset is found
  scanningFolders.find((folder) => {
    let { internalPath } = folder;

    // Deal with template tags like `/assets/images/{{slug}}`
    if (internalPath !== undefined && /{{.+?}}/.test(internalPath)) {
      const { collectionName: _collectionName } = folder;

      const collection = _collectionName
        ? getCollection(_collectionName)
        : entry
          ? getAssociatedCollections(entry)?.[0]
          : undefined;

      if (!(entry && collection)) {
        // Cannot resolve the path
        return false;
      }

      const { content, path: entryFilePath } = entry.locales[collection._i18n.defaultLocale];

      internalPath = fillSlugTemplate(internalPath, {
        type: 'media_folder',
        collection,
        content: flatten(content),
        currentSlug: entry.slug,
        entryFilePath,
        isIndexFile: isCollectionIndexFile(collection, entry),
      });
    }

    const fullPath = createPath([internalPath, baseName]);
    const found = get(allAssets).find((asset) => asset.path === fullPath);

    if (found) {
      foundAsset = found;
    }

    return !!found;
  });

  return foundAsset;
};

/**
 * Get an asset by a public path typically stored as an image field value.
 * @param {object} args Arguments.
 * @param {string} args.value Saved absolute path or relative path.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @returns {Asset | undefined} Corresponding asset.
 */
export const getAssetByPath = ({ value, entry, collectionName, fileName }) => {
  const path = decodeFilePath(value);

  // Handle a relative path. A path starting with `@`, like `@assets/images/...` is a special case,
  // considered as an absolute path.
  if (!/^[/@]/.test(path)) {
    return getAssetByRelativePath({ path, entry });
  }

  return getAssetByAbsolutePath({ path, entry, collectionName, fileName });
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
        (get(allAssetFolders).find(({ collectionName }) =>
          getCollectionsByAsset(asset).some((collection) => collection.name === collectionName),
        ) ?? get(globalAssetFolder));

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

  const { _baseURL: baseURL = '', output: { encode_file_path: encodingEnabled = false } = {} } =
    /** @type {InternalSiteConfig} */ (get(siteConfig));

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
 * Get the blob or public URL from the given image/file entry field value.
 * @param {object} args Arguments.
 * @param {string} args.value Saved field value. It can be an absolute path, entry-relative path, or
 * a complete/external URL.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {boolean} [args.thumbnail] Whether to use a thumbnail of the image.
 * @returns {Promise<string | undefined>} Blob URL or public URL that can be used in the app UI.
 */
export const getMediaFieldURL = async ({
  value,
  entry,
  collectionName,
  fileName,
  thumbnail = false,
}) => {
  if (!value) {
    return undefined;
  }

  if (/^(?:https?|data|blob):/.test(value)) {
    return value;
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
  let dimensions;
  let duration;

  if (['image', 'video', 'audio'].includes(kind) && blobURL) {
    ({ dimensions, duration } = await getMediaMetadata(blobURL, kind));
  }

  return {
    publicURL: getAssetPublicURL(asset),
    repoBlobURL: blobBaseURL ? `${blobBaseURL}/${path}` : undefined,
    dimensions,
    duration,
    usedEntries: url ? await getEntriesByAssetURL(url) : [],
  };
};

/**
 * Get a list of assets stored in the given collection defined folder.
 * @param {AssetFolderInfo} folder Folder info.
 * @returns {Asset[]} Assets.
 */
export const getAssetsByFolder = (folder) => get(allAssets).filter((a) => equal(a.folder, folder));

/**
 * Get a list of assets stored in the given internal directory.
 * @param {string} dirname Directory path.
 * @returns {Asset[]} Assets.
 */
export const getAssetsByDirName = (dirname) =>
  get(allAssets).filter((a) => getPathInfo(a.path).dirname === dirname);

// Reset the asset selection when a different folder is selected
selectedAssetFolder.subscribe(() => {
  focusedAsset.set(undefined);
});

/**
 * Check if asset creation is allowed in the folder. Can’t upload assets if collection assets are
 * saved at entry-relative paths or the asset folder contains template tags.
 * @param {AssetFolderInfo | undefined} assetFolder Asset folder.
 * @returns {boolean} Result.
 */
export const canCreateAsset = (assetFolder) =>
  !!assetFolder && !assetFolder.entryRelative && !assetFolder.hasTemplateTags;
