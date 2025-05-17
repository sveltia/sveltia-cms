import { getPathInfo } from '@sveltia/utils/file';
import { compare, stripSlashes } from '@sveltia/utils/string';
import { getI18nConfig } from '$lib/services/contents/i18n';

/**
 * @import {
 * AssetFolderInfo,
 * EntryFolderInfo,
 * InternalLocaleCode,
 * InternalSiteConfig,
 * } from '$lib/types/private';
 */

/**
 * Get all entry folders.
 * @param {InternalSiteConfig} config Site configuration.
 * @returns {EntryFolderInfo[]} Entry folders.
 */
export const getAllEntryFolders = (config) => {
  const validCollections = config.collections.filter(({ hide, divider }) => !hide && !divider);

  const entryCollectionFolders = validCollections
    .filter(({ folder }) => typeof folder === 'string')
    .map((collection) => {
      const { name: collectionName, folder } = collection;
      const folderPath = stripSlashes(/** @type {string} */ (folder));
      const { i18nEnabled, structure, allLocales } = getI18nConfig(collection);
      const i18nRootMultiFolder = i18nEnabled && structure === 'multiple_folders_i18n_root';

      return {
        collectionName,
        folderPath,
        folderPathMap: Object.fromEntries(
          allLocales.map((locale) => [
            locale,
            i18nRootMultiFolder ? `${locale}/${folderPath}` : folderPath,
          ]),
        ),
      };
    })
    .sort((a, b) => compare(a.folderPath ?? '', b.folderPath ?? ''));

  const fileCollectionFolders = validCollections
    .filter(({ files }) => Array.isArray(files))
    .map((collection) => {
      const { name: collectionName, files } = collection;

      return (files ?? []).map((file) => {
        /** @type {Record<InternalLocaleCode, string>} */
        const filePathMap = (() => {
          const path = stripSlashes(file.file);

          if (!path.includes('{{locale}}')) {
            return { _default: path };
          }

          const _i18n = getI18nConfig(collection, file);
          const { allLocales, defaultLocale, omitDefaultLocaleFromFileName } = _i18n;

          return Object.fromEntries(
            allLocales.map((locale) => [
              locale,
              omitDefaultLocaleFromFileName && locale === defaultLocale
                ? path.replace('.{{locale}}', '')
                : path.replace('{{locale}}', locale),
            ]),
          );
        })();

        return {
          collectionName,
          fileName: file.name,
          filePathMap,
        };
      });
    })
    .flat(1)
    .sort((a, b) => compare(Object.values(a.filePathMap)[0], Object.values(b.filePathMap)[0]));

  return [...entryCollectionFolders, ...fileCollectionFolders];
};

/**
 * Get a normalized asset folder information given the arguments.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File collection only.
 * @param {string} args.mediaFolder Raw `media_folder` option of the collection or collection file.
 * @param {string | undefined} args.publicFolder Raw `public_folder` option of the collection or
 * collection file.
 * @param {string | undefined} args.baseFolder `folder` option for the collection or base directory
 * of the collection file.
 * @param {string} args.globalMediaFolder Normalized global `media_folder` option.
 * @param {string} args.globalPublicFolder Normalized global `public_folder` option.
 * @returns {AssetFolderInfo} Normalized asset folder information.
 */
const normalizeAssetFolder = ({
  collectionName,
  fileName,
  mediaFolder,
  publicFolder,
  baseFolder,
  globalMediaFolder,
  globalPublicFolder,
}) => {
  /**
   * Replace `{{media_folder}}` and `{{public_folder}}` template tags.
   * @param {string} folder Original folder path.
   * @returns {string} Replaced folder path.
   */
  const replaceTags = (folder) =>
    folder
      .trim()
      .replace('{{media_folder}}', globalMediaFolder)
      .replace('{{public_folder}}', globalPublicFolder);

  mediaFolder = replaceTags(mediaFolder);
  publicFolder = publicFolder !== undefined ? replaceTags(publicFolder) : mediaFolder;

  const entryRelative = !(mediaFolder.startsWith('/') || mediaFolder.startsWith(globalMediaFolder));

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
 * Get all asset folders.
 * @param {InternalSiteConfig} config Site configuration.
 * @returns {AssetFolderInfo[]} Asset folders.
 */
export const getAllAssetFolders = (config) => {
  const {
    media_folder: _globalMediaFolder,
    public_folder: _globalPublicFolder,
    collections,
  } = config;

  // Normalize the media folder: an empty string, `/` and `.` are all considered as the root folder
  const globalMediaFolder = stripSlashes(_globalMediaFolder).replace(/^\.$/, '');

  // Some frameworks expect asset paths starting with `@`, like `@assets/images/...`. Remove an
  // extra leading slash in that case. A trailing slash should always be removed internally.
  const globalPublicFolder = _globalPublicFolder
    ? `/${stripSlashes(_globalPublicFolder)}`.replace(/^\/@/, '@')
    : `/${globalMediaFolder}`;

  /** @type {AssetFolderInfo} */
  const globalAssetFolder = {
    collectionName: undefined,
    internalPath: globalMediaFolder,
    publicPath: globalPublicFolder,
    entryRelative: false,
    hasTemplateTags: false,
  };

  /**
   * Collection-level and file-level asset folders.
   * @type {AssetFolderInfo[]}
   * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
   */
  const assetFolders = [];

  collections.forEach((collection) => {
    const {
      divider = false,
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

    if (divider) {
      return;
    }

    const normalizeFolderArgs = { collectionName, globalMediaFolder, globalPublicFolder };
    // When specifying a `path` on an entry collection, `media_folder` defaults to an empty string
    const mediaFolder = _mediaFolder === undefined && entryPath !== undefined ? '' : _mediaFolder;

    if (mediaFolder !== undefined) {
      assetFolders.push(
        normalizeAssetFolder({
          ...normalizeFolderArgs,
          mediaFolder,
          publicFolder,
          baseFolder,
        }),
      );
    }

    collectionFiles?.forEach((file) => {
      const {
        name: fileName,
        file: filePath,
        media_folder: fileMediaFolder,
        public_folder: filePublicFolder,
      } = file;

      if (fileMediaFolder !== undefined) {
        assetFolders.push(
          normalizeAssetFolder({
            ...normalizeFolderArgs,
            fileName,
            mediaFolder: fileMediaFolder,
            publicFolder: filePublicFolder,
            baseFolder: getPathInfo(filePath).dirname,
          }),
        );
      }
    });
  });

  assetFolders.sort((a, b) => compare(a.internalPath, b.internalPath));

  return [globalAssetFolder, ...assetFolders];
};
