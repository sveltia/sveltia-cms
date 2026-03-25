import { getPathInfo } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';
import equal from 'fast-deep-equal';
import { flatten } from 'flat';
import { derived, get, writable } from 'svelte/store';

import {
  allAssetFolders,
  getAssetFolder,
  globalAssetFolder,
  selectedAssetFolder,
} from '$lib/services/assets/folders';
import { fillTemplate } from '$lib/services/common/template';
import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
import { getAssociatedCollections } from '$lib/services/contents/entry';
import {
  getDefaultMediaLibraryOptions,
  transformFile,
} from '$lib/services/integrations/media-libraries/default';
import { createPath, decodeFilePath, resolvePath } from '$lib/services/utils/file';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import {
 * Asset,
 * AssetFolderInfo,
 * Entry,
 * InternalCollection,
 * InternalCollectionFile,
 * ProcessedAssets,
 * TypedFieldKeyPath,
 * UploadingAssets,
 * } from '$lib/types/private';
 */

/**
 * List of all assets.
 * @type {Writable<Asset[]>}
 */
export const allAssets = writable([]);

/**
 * Lazily-rebuilt Map from asset path to Asset, used for O(1) path lookups. Rebuilt only when
 * `allAssets` changes reference.
 * @type {{ source: Asset[] | undefined, map: Map<string, Asset> }}
 */
const assetPathCache = { source: undefined, map: new Map() };

/**
 * Get a Map from asset path to Asset, rebuilt only when `allAssets` changes.
 * @returns {Map<string, Asset>} Map.
 */
const getAssetPathMap = () => {
  const _allAssets = get(allAssets);

  if (_allAssets !== assetPathCache.source) {
    assetPathCache.source = _allAssets;
    assetPathCache.map = new Map(_allAssets.map((asset) => [asset.path, asset]));
  }

  return assetPathCache.map;
};

/**
 * Selected assets.
 * @type {Writable<Asset[]>}
 */
export const selectedAssets = writable([]);

/**
 * Asset currently focused in the UI.
 * @type {Writable<Asset | undefined>}
 */
export const focusedAsset = writable();

/**
 * Asset to be displayed in `<AssetDetailsOverlay>`.
 * @type {Writable<Asset | undefined>}
 */
export const overlaidAsset = writable();

/**
 * Assets currently being uploaded.
 * @type {Writable<UploadingAssets>}
 */
export const uploadingAssets = writable({ folder: undefined, files: [] });

/**
 * Asset currently being edited.
 * @type {Writable<Asset | undefined>}
 */
export const editingAsset = writable();

/**
 * Asset currently being renamed.
 * @type {Writable<Asset | undefined>}
 */
export const renamingAsset = writable();

/**
 * Asset currently being processed.
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
 * Find an asset by a relative path, using the associated entry and collection to help locate it.
 * @param {object} context Context.
 * @param {string} context.path Saved relative path.
 * @param {Entry} context.entry Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {InternalCollection} context.collection Associated collection.
 * @param {InternalCollectionFile} [context.file] Associated collection file.
 * @param {TypedFieldKeyPath} [context.typedKeyPath] Field key path for field-level media folders.
 * @returns {Asset | undefined} Found asset.
 */
export const getAssetByRelativePathAndCollection = ({
  path,
  entry,
  collection,
  file,
  typedKeyPath,
}) => {
  const { locales } = entry;

  const {
    _i18n: { defaultLocale },
  } = file ?? collection;

  // When a field-level key path is provided, look up the field-specific asset folder first so we
  // use the correct `media_folder` (e.g. a field with `media_folder: images1` instead of the
  // collection-level `/src/assets/images/blog`).
  const fieldFolder = typedKeyPath
    ? getAssetFolder({ collectionName: collection.name, fileName: file?.name, typedKeyPath })
    : undefined;

  const mediaFolder = fieldFolder?.entryRelative
    ? (fieldFolder.internalSubPath ?? '')
    : /** @type {string | undefined} */ ((file ?? collection).media_folder);

  const locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0];
  const { path: entryFilePath, content: entryContent } = locales[locale];

  if (!entryFilePath || !entryContent) {
    return undefined;
  }

  // The regex matches any non-empty string (`entryFilePath` is guaranteed non-empty above). Named
  // capture groups always produce a `groups` object, so no optional chaining needed.
  const { entryFolder } = /** @type {{ entryFolder: string }} */ (
    /** @type {RegExpMatchArray} */ (entryFilePath.match(/(?<entryFolder>.+?)(?:\/[^/]+)?$/)).groups
  );

  // Strip the `media_folder` prefix from the stored path before joining with `mediaFolder`, to
  // avoid duplication when the stored value already includes the media folder (e.g.
  // `images/photo.jpg`).
  const localPath =
    mediaFolder && path.startsWith(`${mediaFolder}/`) ? path.slice(mediaFolder.length + 1) : path;

  const resolvedPath = resolvePath(createPath([entryFolder, mediaFolder, localPath]));

  return getAssetPathMap().get(resolvedPath);
};

/**
 * Get an asset by a relative public path typically stored as an image field value.
 * @param {object} args Arguments.
 * @param {string} args.path Saved relative path.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @returns {Asset | undefined} Corresponding asset.
 */
export const getAssetByRelativePath = ({ path, entry, typedKeyPath }) => {
  if (!entry) {
    return undefined;
  }

  const assets = getAssociatedCollections(entry).flatMap((collection) => {
    const collectionFiles = getCollectionFilesByEntry(collection, entry);
    const args = { path, entry, collection, typedKeyPath };

    if (collectionFiles.length) {
      return collectionFiles.map((file) => getAssetByRelativePathAndCollection({ ...args, file }));
    }

    return getAssetByRelativePathAndCollection({ ...args });
  });

  return (
    assets.filter(Boolean)[0] ??
    // Fall back to exact match at the root folder
    getAssetPathMap().get(path)
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
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @returns {Asset | undefined} Corresponding asset.
 */
export const getAssetByAbsolutePath = ({ path, entry, collectionName, fileName, typedKeyPath }) => {
  const exactMatch = getAssetPathMap().get(stripSlashes(path));

  if (exactMatch) {
    return exactMatch;
  }

  const { dirname: dirName = '', basename: baseName } = getPathInfo(path);
  /** @type {Asset | undefined} */
  let foundAsset = undefined;

  const scanningFolders = [
    typedKeyPath ? getAssetFolder({ collectionName, fileName, typedKeyPath }) : undefined,
    getAssetFolder({ collectionName, fileName }),
    getAssetFolder({ collectionName }),
    get(globalAssetFolder),
    get(allAssetFolders).findLast((folder) =>
      dirName.match(`^${(folder.publicPath ?? '').replace(/{{.+?}}/g, '.+?')}\\b`),
    ),
  ].filter((folder) => !!folder);

  // Use `find` to stop scanning folders as soon as the asset is found
  scanningFolders.find((folder) => {
    const { publicPath, collectionName: _collectionName } = folder;
    let { internalPath } = folder;

    // Deal with template tags like `/assets/images/{{slug}}`
    if (internalPath !== undefined && /{{.+?}}/.test(internalPath)) {
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

      internalPath = fillTemplate(internalPath, {
        type: 'media_folder',
        collection,
        content: flatten(content),
        currentSlug: entry.slug,
        entryFilePath,
        isIndexFile: isCollectionIndexFile(collection, entry),
      });
    }

    // Handle assets stored in a subfolder of the internal path
    if (publicPath && internalPath && dirName) {
      if (publicPath === '/') {
        internalPath = `${internalPath}${dirName}`;
      } else if (dirName.startsWith(`${publicPath}/`)) {
        internalPath = dirName.replace(publicPath, internalPath);
      }
    }

    const fullPath = createPath([internalPath, baseName]);
    const found = getAssetPathMap().get(fullPath);

    if (found) {
      foundAsset = found;
    }

    return !!found;
  });

  return foundAsset;
};

/**
 * Check if a path is a relative path. A path starting with `@`, like `@assets/images/...` is a
 * special case, considered as an absolute path.
 * @param {string} path Path to check.
 * @returns {boolean} `true` if the path is relative.
 */
export const isRelativePath = (path) => !/^[/@]/.test(path);

/**
 * Get an asset by a public path typically stored as an image field value.
 * @param {object} args Arguments.
 * @param {string} args.value Saved absolute path or relative path.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @returns {Asset | undefined} Corresponding asset.
 */
export const getAssetByPath = ({ value, entry, collectionName, fileName, typedKeyPath }) => {
  // Remove potential fragment before decoding
  const path = decodeFilePath(value.split('#')[0]);

  // Handle a relative path
  if (isRelativePath(path)) {
    return getAssetByRelativePath({ path, entry, typedKeyPath });
  }

  return getAssetByAbsolutePath({ path, entry, collectionName, fileName, typedKeyPath });
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
