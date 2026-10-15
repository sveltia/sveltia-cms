import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';

import {
  allAssetFolders,
  getAssetFolder,
  globalAssetFolder,
  selectedAssetFolder,
} from '$lib/services/assets/folders';
import { allAssets, focusedAsset } from '$lib/services/assets/state';
import { focusedSubfolder, selectedSubfolderPath } from '$lib/services/assets/subfolders';
import { fillTemplate } from '$lib/services/common/template';
import { ESCAPED_PLACEHOLDER_REGEX } from '$lib/services/common/template/constants';
import { hasTemplateTags } from '$lib/services/common/template/tags';
import { getCollection } from '$lib/services/contents/collection';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry/collections';
import { getEntryLocaleFile } from '$lib/services/contents/entry/paths';
import { getOrCreate, memoizeOnSource } from '$lib/services/utils/cache';
import { createPath, getDirName, resolvePath, stripPathPrefix } from '$lib/services/utils/file';
import { createRootEffect } from '$lib/services/utils/state.svelte';
import { decodeURIComponentSafely } from '$lib/services/utils/url';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * Entry,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * LocalizedEntry,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 */

/**
 * Get a Map from asset path to Asset, used for O(1) path lookups. Rebuilt only when `allAssets` is
 * replaced.
 * @type {() => Map<string, Asset>}
 */
const getAssetPathMap = memoizeOnSource(
  () => allAssets.current,
  (_allAssets) => new Map(_allAssets.map((asset) => [asset.path, asset])),
);

/**
 * Get an asset by its internal repository path.
 * @param {string} path Asset path.
 * @returns {Asset | undefined} Asset.
 */
export const getAssetByInternalPath = (path) => getAssetPathMap().get(path);

/**
 * Get a stable, unique key for the given asset, to be used as its identity in a list. An unsaved
 * asset is keyed by its blob URL, because it can temporarily share a path with the saved asset it’s
 * going to overwrite, and two pending files can share one as well. A saved asset is keyed by its
 * path, which is unique within the repository, and unlike its blob URL — only generated when the
 * file is fetched — never changes while the asset is listed.
 * @param {Asset} asset Asset.
 * @returns {string} Key.
 */
export const getAssetKey = ({ unsaved, blobURL, path }) => (unsaved && blobURL ? blobURL : path);

/**
 * Resolve template tags in an entry’s `media_folder` path, such as `/assets/images/{{slug}}`, using
 * the given locale file of the entry.
 * @param {string} template Folder path that may contain template tags.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {Entry} args.entry Entry.
 * @param {LocalizedEntry} args.localeFile Entry’s locale file the path is resolved against.
 * @returns {string} Resolved path.
 */
const fillMediaFolderTemplate = (template, { collection, entry, localeFile }) =>
  fillTemplate(template, {
    type: 'media_folder',
    collection,
    content: localeFile.content,
    currentSlug: entry.slug,
    entryFilePath: localeFile.path,
    isIndexFile: isCollectionIndexFile(collection, entry),
  });

/**
 * Resolve template tags in an asset folder’s `internalPath`, such as `/assets/images/{{slug}}`,
 * using the given entry’s content.
 * @param {object} args Arguments.
 * @param {string} args.internalPath Internal path that may contain template tags.
 * @param {string} [args.collectionName] Collection name associated with the asset folder. It’s
 * `undefined` for the global asset folder as well as field-level asset folders in custom editor
 * components.
 * @param {Entry} [args.entry] Associated entry. Can be `undefined` when editing a new draft.
 * @param {InternalLocaleCode} [args.locale] Locale whose entry file the path is resolved against.
 * Default: the collection’s default locale.
 * @returns {string | undefined} Resolved path, which is the given `internalPath` itself if it has
 * no template tags, or `undefined` if the tags cannot be resolved, typically because the entry has
 * not been saved yet.
 */
export const fillInternalPathTemplate = ({ internalPath, collectionName, entry, locale }) => {
  if (!hasTemplateTags(internalPath)) {
    return internalPath;
  }

  const collection = collectionName
    ? getCollection(collectionName)
    : entry
      ? getAssociatedCollections(entry)[0]
      : undefined;

  if (!entry || !collection) {
    // Cannot resolve the path
    return undefined;
  }

  // An entry-relative asset referenced in a locale is stored beside that locale’s file. With the
  // `multiple_folders` or `multiple_root_folders` i18n structure, each locale’s file is in a folder
  // of its own
  const localeFile = /** @type {LocalizedEntry} */ (
    getEntryLocaleFile(entry, { locale, defaultLocale: collection._i18n.defaultLocale })
  );

  return fillMediaFolderTemplate(internalPath, { collection, entry, localeFile });
};

/**
 * Find an asset by a relative path, using the associated entry and collection to help locate it.
 * @param {object} context Context.
 * @param {string} context.path Saved relative path.
 * @param {Entry} context.entry Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {InternalCollection} context.collection Associated collection.
 * @param {InternalCollectionFile} [context.file] Associated collection file.
 * @param {string} [context.componentName] Custom editor component name for a field-level asset
 * folder.
 * @param {TypedFieldKeyPath} [context.typedKeyPath] Field key path for field-level media folders.
 * @param {InternalLocaleCode} [context.locale] Locale the path is referenced in, whose entry file
 * the path is relative to. Default: the default locale.
 * @returns {Asset | undefined} Found asset.
 */
export const getAssetByRelativePathAndCollection = ({
  path,
  entry,
  collection,
  file,
  componentName,
  typedKeyPath,
  locale,
}) => {
  const {
    _i18n: { defaultLocale },
  } = file ?? collection;

  // When a field-level key path is provided, look up the field-specific asset folder first so we
  // use the correct `media_folder` (e.g. a field with `media_folder: images1` instead of the
  // collection-level `/src/assets/images/blog`).
  const fieldFolder = typedKeyPath
    ? getAssetFolder({
        collectionName: collection.name,
        fileName: file?.name,
        componentName,
        typedKeyPath,
      })
    : undefined;

  // A collection file without its own `media_folder` inherits the collection’s, along with its
  // `public_folder`
  const folderOptions = file?.media_folder !== undefined ? file : collection;

  // A field-level folder that isn’t entry-relative is an absolute one, e.g. `/src/assets/authors`,
  // which has to be used along with its own `public_folder` rather than the collection’s
  // `media_folder`
  let mediaFolder = fieldFolder
    ? fieldFolder.entryRelative
      ? (fieldFolder.internalSubPath ?? '')
      : `/${fieldFolder.internalPath}`
    : /** @type {string | undefined} */ (folderOptions.media_folder);

  const publicFolder =
    fieldFolder?.publicPath !== undefined
      ? fieldFolder.publicPath
      : /** @type {string | undefined} */ (folderOptions.public_folder);

  const localeFile = /** @type {LocalizedEntry} */ (
    getEntryLocaleFile(entry, { locale, defaultLocale })
  );

  const { path: entryFilePath, content: entryContent } = localeFile;

  if (!entryFilePath || !entryContent) {
    return undefined;
  }

  // Resolve template tags like `{{filename}}` or `{{slug}}` in an entry-relative `media_folder`
  // (e.g. Hexo’s Post Asset Folder convention) so the asset can be located correctly.
  // @see https://github.com/sveltia/sveltia-cms/issues/853
  if (mediaFolder && hasTemplateTags(mediaFolder)) {
    mediaFolder = fillMediaFolderTemplate(mediaFolder, { collection, entry, localeFile });
  }

  // Directory of the entry file, which is an empty string for an entry file at the repository root
  const entryFolder = getDirName(entryFilePath);
  // Strip the `media_folder` prefix from the stored path before joining with `mediaFolder`, to
  // avoid duplication when the stored value already includes the media folder (e.g.
  // `images/photo.jpg`). Also normalize `./` prefix since `./images/photo.jpg` and
  // `images/photo.jpg` are equivalent relative paths.
  // `media_folder` is normalized the same way, since `./images` and `images/` are equivalent to
  // `images`.
  const normalizedPath = path.replace(/^\.\//, '');
  const normalizedMediaFolder = mediaFolder?.replace(/^\.\//, '').replace(/\/$/, '');
  let localPath = stripPathPrefix(normalizedPath, normalizedMediaFolder);
  let resolvedPath;

  // When `media_folder` is absolute (starts with `/`) and `public_folder` is entry-relative (e.g.
  // starts with `.` or `..`), we need special handling for the Astro content collections pattern
  // where images are stored in a shared folder but referenced with relative paths from each entry.
  // Strip the `public_folder` prefix from the stored value and resolve directly against the
  // absolute `media_folder`, bypassing `entryFolder` concatenation.
  // An empty `public_folder` stores bare file names, which are relative to the `media_folder` too
  if (mediaFolder?.startsWith('/') && publicFolder !== undefined) {
    // Normalize `public_folder` by removing leading `./`
    const normalizedPublicFolder = publicFolder.replace(/^\.\//, '');

    // Check if the stored path starts with the public folder
    if (normalizedPath.startsWith(`${normalizedPublicFolder}/`)) {
      // Strip the public folder prefix to get just the filename/subpath
      localPath = normalizedPath.slice(normalizedPublicFolder.length + 1);
    }

    // Resolve against the absolute media_folder (strip leading `/` to make it repo-relative)
    resolvedPath = resolvePath(createPath([mediaFolder.slice(1), localPath]));
  } else {
    // Original logic: concatenate entryFolder + mediaFolder + localPath for entry-relative folders
    resolvedPath = resolvePath(createPath([entryFolder, mediaFolder, localPath]));
  }

  return getAssetPathMap().get(resolvedPath);
};

/**
 * Get the asset folders that may hold an asset referenced in a field, from the most specific to the
 * least: the custom editor component’s folder, the field’s, the collection file’s, the
 * collection’s, then the global one.
 * @param {object} args Arguments.
 * @param {string} [args.collectionName] Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string} [args.componentName] Custom editor component name for a field-level asset folder.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @param {boolean} [args.requireCollectionName] Whether to leave out the field, collection file
 * and collection folders when no collection name is given.
 * @param {boolean} [args.skipTemplateFolders] Whether to leave out the folders whose path has
 * template tags, which can’t be resolved without an entry.
 * @returns {AssetFolderInfo[]} Asset folders.
 */
const getCandidateAssetFolders = ({
  collectionName,
  fileName,
  componentName,
  typedKeyPath,
  requireCollectionName = false,
  skipTemplateFolders = false,
}) => {
  const hasCollection = !requireCollectionName || !!collectionName;

  return /** @type {AssetFolderInfo[]} */ (
    [
      componentName ? getAssetFolder({ componentName, typedKeyPath }) : undefined,
      hasCollection && typedKeyPath
        ? getAssetFolder({ collectionName, fileName, typedKeyPath })
        : undefined,
      hasCollection ? getAssetFolder({ collectionName, fileName }) : undefined,
      hasCollection ? getAssetFolder({ collectionName }) : undefined,
      globalAssetFolder.current,
    ].filter((folder) => !!folder && !(skipTemplateFolders && folder.hasTemplateTags))
  );
};

/**
 * Get an asset by a relative public path typically stored as an image field value.
 * @param {object} args Arguments.
 * @param {string} args.path Saved relative path.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {string} [args.collectionName] Collection name, used when no entry is available.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string} [args.componentName] Custom editor component name for a field-level asset folder.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @param {InternalLocaleCode} [args.locale] Locale the path is referenced in, which tells which
 * locale’s entry file an entry-relative path is relative to. Default: the default locale.
 * @returns {Asset | undefined} Corresponding asset.
 */
export const getAssetByRelativePath = ({
  path,
  entry,
  collectionName,
  fileName,
  componentName,
  typedKeyPath,
  locale,
}) => {
  if (!entry) {
    // Without an entry we use collectionName/fileName to scan configured folders. For
    // entry-relative folders, internalPath + internalSubPath is used as a best-effort path.
    const scanningFolders = getCandidateAssetFolders({
      collectionName,
      fileName,
      componentName,
      typedKeyPath,
      requireCollectionName: true,
      skipTemplateFolders: true,
    });

    const foundAsset = scanningFolders
      .values()
      .map((folder) => {
        // Strip the publicPath prefix from the stored path to get the bare filename/subpath, so
        // that e.g. `uploads/photo.jpg` with publicPath `/uploads` resolves to `uploads/photo.jpg`
        // internally rather than `uploads/uploads/photo.jpg`.
        const localPath = stripPathPrefix(path, folder.publicPath?.replace(/^\//, ''));

        return getAssetPathMap().get(
          createPath([folder.internalPath, folder.internalSubPath ?? '', localPath]),
        );
      })
      .find(Boolean);

    return foundAsset ?? getAssetPathMap().get(path);
  }

  // Stop at the first collection or collection file that has the asset
  const foundAsset = getAssociatedCollections(entry)
    .values()
    .flatMap((collection) => {
      const collectionFiles = getCollectionFilesByEntry(collection, entry);
      const args = { path, entry, collection, componentName, typedKeyPath, locale };
      /** @type {(InternalCollectionFile | undefined)[]} */
      const files = collectionFiles.length ? collectionFiles : [undefined];

      return files.values().map((file) => getAssetByRelativePathAndCollection({ ...args, file }));
    })
    .find(Boolean);

  return (
    foundAsset ??
    // Fall back to exact match at the root folder
    getAssetPathMap().get(path)
  );
};

/**
 * Cache of {@link getPublicPathRegex} results, keyed by the asset folder.
 * @type {WeakMap<AssetFolderInfo, RegExp>}
 */
const publicPathRegexCache = new WeakMap();

/**
 * Get a regular expression matching a directory at or below the given folder’s public path, with
 * any template tag in the path matching a segment.
 * @param {AssetFolderInfo} folder Asset folder.
 * @returns {RegExp} Regular expression.
 */
const getPublicPathRegex = (folder) =>
  getOrCreate(publicPathRegexCache, folder, () => {
    const publicPath = folder.publicPath ?? '';
    const normalizedPath = escapeRegExp(publicPath).replace(ESCAPED_PLACEHOLDER_REGEX, '.+?');

    return new RegExp(`^${normalizedPath}${publicPath ? '(?=\\/|$)' : '$'}`);
  });

/**
 * Check if a path is a relative path. A path starting with `@`, like `@assets/images/...` is a
 * special case, considered as an absolute path.
 * @param {string} path Path to check.
 * @returns {boolean} `true` if the path is relative.
 */
export const isRelativePath = (path) => !/^[/@]/.test(path);

/**
 * Get an asset by an absolute public path typically stored as an image field value.
 * @param {object} args Arguments.
 * @param {string} args.path Saved absolute path.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string} [args.componentName] Custom editor component name for a field-level asset folder.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @param {InternalLocaleCode} [args.locale] Locale the path is referenced in, which tells which
 * locale’s entry file an entry-relative path is relative to. Default: the default locale.
 * @returns {Asset | undefined} Corresponding asset.
 */
export const getAssetByAbsolutePath = ({
  path,
  entry,
  collectionName,
  fileName,
  componentName,
  typedKeyPath,
  locale,
}) => {
  const exactMatch = getAssetPathMap().get(stripSlashes(path));

  if (exactMatch) {
    return exactMatch;
  }

  const { dirname: dirName = '', basename: baseName } = getPathInfo(path);

  /**
   * Look for the asset in the given folder.
   * @param {AssetFolderInfo} folder Asset folder.
   * @returns {Asset | undefined} Asset, if found.
   */
  const findInFolder = (folder) => {
    const { publicPath, collectionName: _collectionName } = folder;
    let { internalPath } = folder;

    if (internalPath !== undefined) {
      // Deal with template tags like `/assets/images/{{slug}}`
      internalPath = fillInternalPathTemplate({
        internalPath,
        collectionName: _collectionName,
        entry,
        locale,
      });

      if (internalPath === undefined) {
        // Cannot resolve the path
        return undefined;
      }
    }

    if (publicPath && dirName) {
      if (publicPath === '/' || dirName.startsWith(`${publicPath}/`)) {
        // Handle assets stored in a subfolder of the internal path
        if (internalPath) {
          internalPath =
            publicPath === '/'
              ? `${internalPath}${dirName}`
              : dirName.replace(publicPath, internalPath);
        }
      } else if (!isRelativePath(publicPath) && !getPublicPathRegex(folder).test(dirName)) {
        // The directory is neither the public path nor below it, e.g. `/images-old` or `/files`
        // with the `/images` public path, so the asset cannot be in this folder. A public path with
        // template tags, like `/images/{{slug}}`, matches any segment in place of the tags
        return undefined;
      }
    }

    return getAssetPathMap().get(createPath([internalPath, baseName]));
  };

  const scanningFolders = getCandidateAssetFolders({
    collectionName,
    fileName,
    componentName,
    typedKeyPath,
  });

  /** @type {Asset | undefined} */
  let foundAsset = undefined;

  // Use `some` to stop scanning folders as soon as the asset is found
  scanningFolders.some((folder) => {
    foundAsset = findInFolder(folder);

    return !!foundAsset;
  });

  if (foundAsset) {
    return foundAsset;
  }

  // Fall back to the last folder whose public path matches the directory. This is only worked out
  // once the likely folders above have missed, as it tests the path against every asset folder
  const matchingFolder = allAssetFolders.current.findLast((folder) =>
    getPublicPathRegex(folder).test(dirName),
  );

  return matchingFolder ? findInFolder(matchingFolder) : undefined;
};

/**
 * Get an asset by a public path typically stored as an image field value.
 * @param {object} args Arguments.
 * @param {string} args.value Saved absolute path or relative path.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string} [args.componentName] Custom editor component name for a field-level asset folder.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @param {InternalLocaleCode} [args.locale] Locale the path is referenced in, which tells which
 * locale’s entry file an entry-relative path is relative to. Default: the default locale.
 * @returns {Asset | undefined} Corresponding asset.
 */
export const getAssetByPath = ({ value, ...rest }) => {
  /**
   * Look up an asset by the given path.
   * @param {string} encodedPath Path that may contain URL-encoded characters.
   * @returns {Asset | undefined} Corresponding asset.
   */
  const find = (encodedPath) => {
    // The path is not encoded unless the `encode_file_path` option is enabled, so a file name can
    // contain a `%` sign, like `50% off.jpg`, which would make `decodeURIComponent()` throw
    const path = decodeURIComponentSafely(encodedPath);

    return isRelativePath(path)
      ? getAssetByRelativePath({ path, ...rest })
      : getAssetByAbsolutePath({ path, ...rest });
  };

  // Look up the whole value first, as an unencoded file name can contain a `#` sign, like
  // `photo #1.jpg`; then remove a potential fragment, like `#section`, and try again
  const [pathWithoutFragment] = value.split('#');

  return find(value) ?? (pathWithoutFragment !== value ? find(pathWithoutFragment) : undefined);
};

/**
 * Check if an asset belongs to the given asset folder. An asset is assigned to one folder only, but
 * a folder with a fixed path also holds the assets assigned to another folder with the same path,
 * so that the folders sharing a path, like an asset collection and a collection or field-level
 * folder, all list the same assets. An entry-relative folder has to be the asset’s own, as its path
 * is that of the collection, which the assets are stored somewhere below.
 * @param {Asset} asset Asset.
 * @param {AssetFolderInfo} folder Folder info.
 * @returns {boolean} Result.
 */
export const isAssetInFolder = ({ folder: assetFolder }, folder) => {
  if (assetFolder === folder) {
    return true;
  }

  if (!folder.entryRelative) {
    return !assetFolder.entryRelative && assetFolder.internalPath === folder.internalPath;
  }

  return (
    assetFolder.collectionName === folder.collectionName &&
    assetFolder.fileName === folder.fileName &&
    assetFolder.typedKeyPath === folder.typedKeyPath &&
    assetFolder.isIndexFile === folder.isIndexFile &&
    assetFolder.internalPath === folder.internalPath &&
    assetFolder.internalSubPath === folder.internalSubPath &&
    assetFolder.publicPath === folder.publicPath &&
    assetFolder.entryRelative === folder.entryRelative &&
    assetFolder.hasTemplateTags === folder.hasTemplateTags
  );
};

/**
 * Get a list of assets stored in the given collection defined folder.
 * @param {AssetFolderInfo} folder Folder info.
 * @returns {Asset[]} Assets.
 */
export const getAssetsByFolder = (folder) =>
  allAssets.current.filter((asset) => isAssetInFolder(asset, folder));

/**
 * Get a list of assets stored in the given internal directory.
 * @param {string} dirname Directory path. An empty string for the repository root.
 * @returns {Asset[]} Assets.
 */
export const getAssetsByDirName = (dirname) =>
  allAssets.current.filter((a) => getDirName(a.path) === dirname);

// Reset the asset selection when a different folder or subfolder is selected
createRootEffect(() => {
  // Read the folder and subfolder so that the effect re-runs whenever either changes
  void selectedAssetFolder.current;
  void selectedSubfolderPath.current;
  focusedAsset.current = undefined;
  focusedSubfolder.current = undefined;
});

/**
 * Get a list of duplicate files based on their names compared to existing assets.
 * @param {File[]} files The list of files to check for duplicates.
 * @param {Asset[]} assets The list of existing assets to compare against.
 * @returns {File[]} An array of files that have duplicate names in the existing assets.
 */
export const getDuplicateFiles = (files, assets) => {
  if (!assets.length || !files.length) {
    return [];
  }

  const existingNames = new Set(assets.map(({ name }) => name.normalize().toLowerCase()));

  return files.filter((file) => existingNames.has(file.name.normalize().toLowerCase()));
};
