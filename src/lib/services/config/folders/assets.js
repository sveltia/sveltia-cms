import { getPathInfo } from '@sveltia/utils/file';
import { compare, stripSlashes } from '@sveltia/utils/string';

import { getValidCollections } from '$lib/services/contents/collection';
import { getValidCollectionFiles } from '$lib/services/contents/collection/files';

/**
 * @import {
 * AssetFolderInfo,
 * CollectedMediaField,
 * InternalCmsConfig,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 * @import { Collection, CollectionDivider, CollectionFile } from '$lib/types/public';
 */

/**
 * @typedef {object} NormalizeAssetFolderArgs
 * @property {string} collectionName Collection name.
 * @property {string} [fileName] Collection file name. File/singleton collection only.
 * @property {TypedFieldKeyPath} [typedKeyPath] Key path to the field.
 * @property {boolean} [isIndexFile] Whether the field is part of an index file entry.
 * @property {string} mediaFolder Raw `media_folder` option of the collection or collection file.
 * @property {string | undefined} publicFolder Raw `public_folder` option of the collection or
 * collection file.
 * @property {string | undefined} baseFolder `folder` option for the collection or base directory of
 * the collection file.
 * @property {GlobalFolders | undefined} globalFolders Global folders information.
 */

/**
 * @typedef {object} GlobalFolders
 * @property {string} globalMediaFolder Normalized global `media_folder` option.
 * @property {string} globalPublicFolder Normalized global `public_folder` option.
 */

/**
 * Collection-level and file-level asset folders.
 * @type {AssetFolderInfo[]}
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 */
const assetFolders = [];

/**
 * Check if a folder string contains template tags.
 * @internal
 * @param {string} folder Folder string.
 * @returns {boolean} `true` if the folder contains template tags.
 */
export const hasTags = (folder) =>
  folder.includes('{{media_folder}}') || folder.includes('{{public_folder}}');

/**
 * Replace `{{media_folder}}` and `{{public_folder}}` template tags.
 * @internal
 * @param {string} folder Original folder path.
 * @param {object} context Context for replacement.
 * @param {string} context.globalMediaFolder Normalized global `media_folder` option.
 * @param {string} context.globalPublicFolder Normalized global `public_folder` option.
 * @returns {string} Replaced folder path with a leading slash so it won’t be treated as relative.
 */
export const replaceTags = (folder, { globalMediaFolder, globalPublicFolder }) =>
  folder
    .trim()
    .replace('{{media_folder}}', `/${globalMediaFolder}`)
    .replace('{{public_folder}}', `/${globalPublicFolder}`)
    .replace('//', '/');

/**
 * Get a normalized asset folder information given the arguments.
 * @internal
 * @param {NormalizeAssetFolderArgs} args Arguments.
 * @returns {AssetFolderInfo | undefined} Normalized asset folder information or `undefined` if
 * template tags are used but global folder information is not available.
 */
export const normalizeAssetFolder = ({
  collectionName,
  fileName,
  typedKeyPath,
  isIndexFile = false,
  mediaFolder,
  publicFolder,
  baseFolder,
  globalFolders,
}) => {
  if (hasTags(mediaFolder)) {
    // Cannot substitute tags without global folder info
    if (!globalFolders) {
      return undefined;
    }

    mediaFolder = replaceTags(mediaFolder, globalFolders);
  }

  if (publicFolder === undefined) {
    publicFolder = mediaFolder;
  } else if (hasTags(publicFolder)) {
    // Cannot substitute tags without global folder info
    if (!globalFolders) {
      return undefined;
    }

    publicFolder = replaceTags(publicFolder, globalFolders);
  }

  const entryRelative = !mediaFolder.startsWith('/');

  return {
    collectionName,
    fileName,
    typedKeyPath,
    isIndexFile,
    internalPath: stripSlashes(entryRelative ? (baseFolder ?? '') : mediaFolder),
    internalSubPath: entryRelative ? stripSlashes(mediaFolder) : undefined,
    publicPath:
      // Prefix the public path with `/` unless it’s empty or starting with `.` (entry-relative
      // setting) or starting with `@` (framework-specific)
      publicFolder === '' || /^[.@]/.test(publicFolder)
        ? publicFolder
        : `/${stripSlashes(publicFolder)}`,
    entryRelative,
    hasTemplateTags: /{{.+?}}/.test(mediaFolder),
  };
};

/**
 * Add an asset folder for a collection or collection file if it’s not the same as the global
 * asset folder.
 * @internal
 * @param {NormalizeAssetFolderArgs} args Arguments for {@link normalizeAssetFolder}.
 */
export const addFolderIfNeeded = (args) => {
  if (args.mediaFolder === undefined) {
    return;
  }

  const folder = normalizeAssetFolder(args);

  if (!folder) {
    return;
  }

  const { globalMediaFolder, globalPublicFolder } = args.globalFolders ?? {};

  if (
    !folder.entryRelative &&
    folder.internalPath === globalMediaFolder &&
    folder.publicPath === globalPublicFolder
  ) {
    return;
  }

  assetFolders.push(folder);
};

/**
 * Iterate through files in a file/singleton collection and add their folders.
 * @internal
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {(CollectionFile | CollectionDivider)[]} args.files Collection files. May include
 * dividers.
 * @param {GlobalFolders | undefined} args.globalFolders Global folders information.
 */
export const iterateFiles = ({ collectionName, files, globalFolders }) => {
  getValidCollectionFiles(files).forEach((file) => {
    const {
      name: fileName,
      file: filePath,
      media_folder: fileMediaFolder,
      public_folder: filePublicFolder,
    } = file;

    addFolderIfNeeded({
      collectionName,
      fileName,
      // @ts-ignore
      mediaFolder: fileMediaFolder,
      publicFolder: filePublicFolder,
      baseFolder: getPathInfo(filePath).dirname,
      globalFolders,
    });
  });
};

/**
 * Handle field-level media folders and add them if needed.
 * @internal
 * @param {object} args Arguments.
 * @param {CollectedMediaField[]} args.fieldMediaFolders Collected field-level media folders.
 * @param {Collection[]} args.validCollections Valid collections.
 * @param {GlobalFolders | undefined} args.globalFolders Global folders information.
 */
export const handleFieldMediaFolders = ({ fieldMediaFolders, validCollections, globalFolders }) => {
  fieldMediaFolders.forEach(({ fieldConfig, context }) => {
    const _collection = /** @type {Collection} */ (context.collection);

    const isValidCollection =
      _collection.name === '_singletons' ||
      validCollections.some((c) => c.name === _collection.name);

    if (!isValidCollection) {
      return;
    }

    addFolderIfNeeded({
      collectionName: _collection.name,
      fileName: context.collectionFile?.name,
      mediaFolder: /** @type {string} */ (fieldConfig.media_folder),
      publicFolder: fieldConfig.public_folder,
      baseFolder: 'folder' in _collection ? _collection.folder : undefined,
      typedKeyPath: /** @type {string} */ (context.typedKeyPath),
      isIndexFile: /** @type {boolean} */ (context.isIndexFile),
      globalFolders,
    });
  });
};

/**
 * Get all asset folders.
 * @param {InternalCmsConfig} config CMS configuration.
 * @param {CollectedMediaField[]} [fieldMediaFolders] Collected field-level media folders.
 * @returns {AssetFolderInfo[]} Asset folders.
 */
export const getAllAssetFolders = (config, fieldMediaFolders = []) => {
  // Clear any previous results
  assetFolders.length = 0;

  const {
    media_folder: _globalMediaFolder,
    public_folder: _globalPublicFolder,
    collections,
    singletons,
  } = config;

  const isGlobalFolderConfigured = !!_globalMediaFolder;

  // Normalize the media folder: an empty string, `/` and `.` are all considered as the root folder
  const globalMediaFolder = isGlobalFolderConfigured
    ? stripSlashes(_globalMediaFolder).replace(/^\.$/, '')
    : '';

  // Some frameworks expect asset paths starting with `@`, like `@assets/images/...`. Remove an
  // extra leading slash in that case. A trailing slash should always be removed internally.
  const globalPublicFolder = isGlobalFolderConfigured
    ? _globalPublicFolder
      ? `/${stripSlashes(_globalPublicFolder)}`.replace(/^\/@/, '@')
      : `/${globalMediaFolder}`
    : '';

  /** @type {AssetFolderInfo} */
  const allAssetsFolder = {
    collectionName: undefined,
    internalPath: undefined,
    internalSubPath: undefined,
    publicPath: undefined,
    entryRelative: false,
    hasTemplateTags: false,
  };

  /** @type {AssetFolderInfo | undefined} */
  const globalAssetFolder = isGlobalFolderConfigured
    ? { ...allAssetsFolder, internalPath: globalMediaFolder, publicPath: globalPublicFolder }
    : undefined;

  const globalFolders = isGlobalFolderConfigured
    ? { globalMediaFolder, globalPublicFolder }
    : undefined;

  const validCollections = getValidCollections({ collections });

  validCollections.forEach((collection) => {
    const {
      name: collectionName,
      // @ts-ignore
      files: collectionFiles,
      // @ts-ignore
      // e.g. `content/posts`
      folder: baseFolder,
      // @ts-ignore
      // e.g. `{{slug}}/index`
      path: entryPath,
      // relative path, e.g. `` (an empty string), `./` (same as an empty string),
      // `{{media_folder}}/posts`, etc. or absolute path, e.g. `/static/images/posts`, etc.
      media_folder: _mediaFolder,
      // `undefined`, `` (an empty string), `{{public_folder}}`, etc. or relative/absolute path
      public_folder: publicFolder,
    } = collection;

    // When specifying a `path` on an entry collection, `media_folder` defaults to an empty string
    const mediaFolder = _mediaFolder === undefined && entryPath !== undefined ? '' : _mediaFolder;

    addFolderIfNeeded({
      collectionName,
      // @ts-ignore
      mediaFolder,
      publicFolder,
      baseFolder,
      entryPath,
      globalFolders,
    });

    if (collectionFiles?.length) {
      iterateFiles({ collectionName, files: collectionFiles, globalFolders });
    }
  });

  if (singletons?.length) {
    // Singleton collection is always at the end
    iterateFiles({ collectionName: '_singletons', files: singletons, globalFolders });
  }

  handleFieldMediaFolders({ fieldMediaFolders, validCollections, globalFolders });

  assetFolders.sort((a, b) => compare(a.internalPath ?? '', b.internalPath ?? ''));

  const allFolders = [];

  if (globalAssetFolder) {
    allFolders.push(globalAssetFolder);
  }

  allFolders.push(...assetFolders);

  if (allFolders.length) {
    allFolders.unshift(allAssetsFolder);
  }

  return allFolders;
};
