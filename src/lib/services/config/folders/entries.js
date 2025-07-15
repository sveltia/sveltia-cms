import { compare, stripSlashes } from '@sveltia/utils/string';
import { getValidCollections } from '$lib/services/contents/collection';
import {
  getValidCollectionFiles,
  isValidCollectionFile,
} from '$lib/services/contents/collection/files';
import { getI18nConfig, getLocalePath } from '$lib/services/contents/i18n';

/**
 * @import { EntryFolderInfo, InternalLocaleCode, InternalSiteConfig } from '$lib/types/private';
 * @import { Collection, CollectionFile } from '$lib/types/public';
 */

/**
 * Get a map of file paths for the given collection and file.
 * @param {object} args Arguments.
 * @param {Collection} args.collection Collection.
 * @param {CollectionFile} args.file Collection file.
 * @returns {Record<InternalLocaleCode, string>} Map of file paths for each locale.
 */
const getFilePathMap = ({ collection, file }) => {
  const path = stripSlashes(file.file);

  if (!path.includes('{{locale}}')) {
    return { _default: path };
  }

  const _i18n = getI18nConfig(collection, file);

  return Object.fromEntries(
    _i18n.allLocales.map((locale) => [locale, getLocalePath({ _i18n, locale, path })]),
  );
};

/**
 * Get a collection file folder information.
 * @param {Collection} collection Collection.
 * @param {CollectionFile} file Collection file.
 * @returns {EntryFolderInfo | undefined} Collection file folder information.
 */
const getCollectionFileFolder = (collection, file) => {
  if (!isValidCollectionFile(file)) {
    return undefined;
  }

  return {
    collectionName: collection.name,
    fileName: file.name,
    filePathMap: getFilePathMap({ collection, file }),
  };
};

/**
 * Compare two entry folders by their file paths. This is used to sort entry folders.
 * @param {EntryFolderInfo} a One entry folder.
 * @param {EntryFolderInfo} b Another entry folder.
 * @returns {number} Comparison result.
 */
const compareFilePath = (a, b) =>
  compare(Object.values(a.filePathMap ?? {})[0], Object.values(b.filePathMap ?? {})[0]);

/**
 * Get entry collection folders.
 * @param {InternalSiteConfig} config Site configuration.
 * @returns {EntryFolderInfo[]} Entry folders.
 */
const getEntryCollectionFolders = ({ collections }) =>
  getValidCollections({ collections, type: 'entry', visible: true })
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

/**
 * Get file collection folders.
 * @param {InternalSiteConfig} config Site configuration.
 * @returns {EntryFolderInfo[]} Entry folders.
 */
const getFileCollectionFolders = ({ collections }) =>
  getValidCollections({ collections, type: 'file', visible: true })
    .map((collection) =>
      (collection.files ?? []).map((file) => getCollectionFileFolder(collection, file)),
    )
    .flat(1)
    .filter((file) => !!file)
    .sort(compareFilePath);

/**
 * Get singleton collection folders.
 * @param {InternalSiteConfig} config Site configuration.
 * @returns {EntryFolderInfo[]} Entry folders.
 */
const getSingletonCollectionFolders = ({ singletons }) => {
  const files = Array.isArray(singletons) ? getValidCollectionFiles(singletons) : [];

  if (!files.length) {
    return [];
  }

  const singletonCollection = { name: '_singletons', files };

  return files
    .map((file) => getCollectionFileFolder(singletonCollection, file))
    .filter((file) => !!file)
    .sort(compareFilePath);
};

/**
 * Get all entry folders.
 * @param {InternalSiteConfig} config Site configuration.
 * @returns {EntryFolderInfo[]} Entry folders.
 */
export const getAllEntryFolders = (config) => [
  ...getEntryCollectionFolders(config),
  ...getFileCollectionFolders(config),
  ...getSingletonCollectionFolders(config),
];
