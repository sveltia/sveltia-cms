import { getPathInfo } from '@sveltia/utils/file';
import { compare, stripSlashes } from '@sveltia/utils/string';
import { getValidCollections } from '$lib/services/contents/collection';
import { getValidCollectionFiles } from '$lib/services/contents/collection/files';

/**
 * @import { AssetFolderInfo, InternalSiteConfig } from '$lib/types/private';
 * @import { CollectionDivider, CollectionFile } from '$lib/types/public';
 */

/**
 * @typedef {object} NormalizeAssetFolderArgs
 * @property {string} collectionName Collection name.
 * @property {string} [fileName] Collection file name. File/singleton collection only.
 * @property {string} mediaFolder Raw `media_folder` option of the collection or collection file.
 * @property {string | undefined} publicFolder Raw `public_folder` option of the collection or
 * collection file.
 * @property {string | undefined} baseFolder `folder` option for the collection or base directory of
 * the collection file.
 * @property {GlobalFolders} globalFolders Global folders information.
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
 * Replace `{{media_folder}}` and `{{public_folder}}` template tags.
 * @param {string} folder Original folder path.
 * @param {object} context Context for replacement.
 * @param {string} context.globalMediaFolder Normalized global `media_folder` option.
 * @param {string} context.globalPublicFolder Normalized global `public_folder` option.
 * @returns {string} Replaced folder path with a leading slash so it won’t be treated as relative.
 */
const replaceTags = (folder, { globalMediaFolder, globalPublicFolder }) =>
  folder
    .trim()
    .replace('{{media_folder}}', `/${globalMediaFolder}`)
    .replace('{{public_folder}}', `/${globalPublicFolder}`)
    .replace('//', '/');

/**
 * Get a normalized asset folder information given the arguments.
 * @param {NormalizeAssetFolderArgs} args Arguments.
 * @returns {AssetFolderInfo} Normalized asset folder information.
 */
const normalizeAssetFolder = ({
  collectionName,
  fileName,
  mediaFolder,
  publicFolder,
  baseFolder,
  globalFolders,
}) => {
  mediaFolder = replaceTags(mediaFolder, globalFolders);
  publicFolder =
    publicFolder !== undefined ? replaceTags(publicFolder, globalFolders) : mediaFolder;

  const entryRelative = !mediaFolder.startsWith('/');

  return {
    collectionName,
    fileName,
    internalPath: stripSlashes(entryRelative ? (baseFolder ?? '') : mediaFolder),
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
 * @param {NormalizeAssetFolderArgs} args Arguments for {@link normalizeAssetFolder}.
 */
const addFolderIfNeeded = (args) => {
  if (args.mediaFolder === undefined) {
    return;
  }

  const folder = normalizeAssetFolder(args);
  const { globalMediaFolder, globalPublicFolder } = args.globalFolders;

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
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {(CollectionFile | CollectionDivider)[]} args.files Collection files. May include
 * dividers.
 * @param {GlobalFolders} args.globalFolders Global folders information.
 */
const iterateFiles = ({ collectionName, files, globalFolders }) => {
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
 * Get all asset folders.
 * @param {InternalSiteConfig} config Site configuration.
 * @returns {AssetFolderInfo[]} Asset folders.
 */
export const getAllAssetFolders = (config) => {
  const {
    media_folder: _globalMediaFolder,
    public_folder: _globalPublicFolder,
    collections,
    singletons,
  } = config;

  // Normalize the media folder: an empty string, `/` and `.` are all considered as the root folder
  const globalMediaFolder = stripSlashes(_globalMediaFolder).replace(/^\.$/, '');

  // Some frameworks expect asset paths starting with `@`, like `@assets/images/...`. Remove an
  // extra leading slash in that case. A trailing slash should always be removed internally.
  const globalPublicFolder = _globalPublicFolder
    ? `/${stripSlashes(_globalPublicFolder)}`.replace(/^\/@/, '@')
    : `/${globalMediaFolder}`;

  /** @type {AssetFolderInfo} */
  const allAssetsFolder = {
    collectionName: undefined,
    internalPath: undefined,
    publicPath: undefined,
    entryRelative: false,
    hasTemplateTags: false,
  };

  /** @type {AssetFolderInfo} */
  const globalAssetFolder = {
    collectionName: undefined,
    internalPath: globalMediaFolder,
    publicPath: globalPublicFolder,
    entryRelative: false,
    hasTemplateTags: false,
  };

  const globalFolders = { globalMediaFolder, globalPublicFolder };

  getValidCollections({ collections }).forEach((collection) => {
    const {
      name: collectionName,
      files: collectionFiles,
      // e.g. `content/posts`
      folder: baseFolder,
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

  assetFolders.sort((a, b) => compare(a.internalPath ?? '', b.internalPath ?? ''));

  return [allAssetsFolder, globalAssetFolder, ...assetFolders];
};
