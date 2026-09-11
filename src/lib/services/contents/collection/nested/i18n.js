import { getPathInfo } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import {
  DEFAULT_INDEX_FILE_NAMES,
  getEntryDirPath,
  getNestedIndexFileName,
  isNestedCollection,
} from '$lib/services/contents/collection/nested';
import { hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
import { mergeUnpublishedEntries, unpublishedEntries } from '$lib/services/workflow';

/**
 * @import { Entry, InternalCollection, InternalLocaleCode } from '$lib/types/private';
 */

/**
 * Get the name of the folder at the given path.
 * @param {string} dirPath Folder path relative to the collection folder.
 * @returns {string} Last path segment. An empty string for the collection folder itself.
 */
export const getFolderName = (dirPath) => dirPath.slice(dirPath.lastIndexOf('/') + 1);

/**
 * Get the name of the folder an entry occupies in the given locale, in a collection where every
 * entry is an index file within a folder of its own. The folder is named after the entry’s slug,
 * so it goes by a different name in each locale when the slug is localized.
 * @param {string} subPath Entry’s sub path in the locale, e.g. `docs/guides/_index`.
 * @returns {string} Folder name, e.g. `guides`. An empty string if the entry is directly in the
 * collection folder, which is the case for the collection’s own index file.
 */
export const getOwnFolderName = (subPath) => getFolderName(getEntryDirPath(subPath));

/**
 * Check whether the folders of a nested collection go by a different name in each locale. That’s
 * the case when the entry slugs are localized: a folder is named after the entry it belongs to,
 * which is stored either in it or beside it, so the folder chain above an entry is localized along
 * with the entry itself.
 * @param {InternalCollection} collection Collection.
 * @returns {boolean} Result.
 * @see https://github.com/sveltia/sveltia-cms/issues/962
 */
export const hasLocalizedFolders = (collection) =>
  isNestedCollection(collection) && hasLocalizedSlugs(collection);

/**
 * Find the entry a folder is named after, along with the folder name it has in the given locale.
 * In the `subfolders` mode that’s the folder’s own index file; otherwise it’s the folder’s index
 * file if it has one, as named with the `meta.path.index_file` option or by convention, or else a
 * file of the same name as the folder stored beside it, which is how Eleventy, Jekyll and other
 * frameworks give a folder its page.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries Entries in the collection.
 * @param {string} args.dirPath Folder path in the default locale, relative to the collection
 * folder.
 * @param {string[]} args.indexFileNames File names, without an extension, an index file can have.
 * @param {InternalLocaleCode} args.locale Locale.
 * @returns {string | undefined} Localized folder name, or `undefined` if the folder has no entry or
 * its entry lacks the locale.
 */
const getLocalizedFolderName = ({ entries, dirPath, indexFileNames, locale }) => {
  const indexEntry = entries.find(({ subPath }) =>
    indexFileNames.some((name) => subPath === `${dirPath}/${name}`),
  );

  if (indexEntry) {
    const localizedSubPath = indexEntry.locales[locale]?.slug;

    return localizedSubPath ? getOwnFolderName(localizedSubPath) || undefined : undefined;
  }

  const siblingEntry = entries.find(({ subPath }) => subPath === dirPath);
  const localizedSubPath = siblingEntry?.locales[locale]?.slug;

  return localizedSubPath ? getPathInfo(localizedSubPath).basename : undefined;
};

/**
 * Get every entry in the collection, including the unpublished ones. With Editorial Workflow, a
 * section can be started and filled in one sitting, so a folder that only exists as a draft has to
 * be recognized too, or the sub-pages filed under it would land in a folder with the default
 * locale’s name.
 * @param {InternalCollection} collection Collection.
 * @returns {Entry[]} Entries.
 */
const getAllEntries = (collection) => {
  const { name } = collection;

  return mergeUnpublishedEntries(
    getEntriesByCollection(name),
    get(unpublishedEntries).filter(({ workflow }) => workflow.collectionName === name),
  );
};

/**
 * Get the given locale’s counterpart of a folder path within a nested collection. The path editor
 * chooses a folder once, in the default locale, and the folders go by localized names in the other
 * locales, so each locale’s file has to be stored below the localized chain instead. Each folder
 * takes its name from the entry it belongs to, as described in {@link getLocalizedFolderName}. A
 * folder without such an entry, or whose entry lacks the locale, keeps its name.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {string} args.dirPath Folder path in the default locale, relative to the collection
 * folder.
 * @param {InternalLocaleCode} args.locale Locale.
 * @param {Entry[]} [args.entries] Entries to look the folders up in. Defaults to every entry in the
 * collection, including the unpublished ones.
 * @returns {string} Localized folder path without leading and trailing slashes. The given path,
 * normalized the same way, if the collection’s folders aren’t localized or the locale is the
 * default one.
 * @see https://github.com/sveltia/sveltia-cms/issues/962
 */
export const localizeDirPath = ({ collection, dirPath, locale, entries }) => {
  const path = stripSlashes(dirPath);

  if (!path || locale === collection._i18n.defaultLocale || !hasLocalizedFolders(collection)) {
    return path;
  }

  const configuredIndexFileName = getNestedIndexFileName(collection);

  const indexFileNames = configuredIndexFileName
    ? [configuredIndexFileName]
    : DEFAULT_INDEX_FILE_NAMES;

  const allEntries = entries ?? getAllEntries(collection);
  let prefix = '';

  return path
    .split('/')
    .map((segment) => {
      prefix = prefix ? `${prefix}/${segment}` : segment;

      return (
        getLocalizedFolderName({ entries: allEntries, dirPath: prefix, indexFileNames, locale }) ??
        segment
      );
    })
    .join('/');
};
