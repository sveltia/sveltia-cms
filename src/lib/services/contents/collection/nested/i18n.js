import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import {
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
 * the case when the entry slugs are localized: in the `subfolders` mode, a folder is an entry named
 * after its slug, so the folder chain above an entry is localized along with the entry itself.
 * @param {InternalCollection} collection Collection.
 * @returns {boolean} Result.
 * @see https://github.com/sveltia/sveltia-cms/issues/962
 */
export const hasLocalizedFolders = (collection) =>
  isNestedCollection(collection) &&
  !!getNestedIndexFileName(collection) &&
  hasLocalizedSlugs(collection);

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
 * takes its name from the entry stored in it: in the `subfolders` mode that’s the folder’s own
 * entry, and otherwise the entry named with the `meta.path.index_file` option, if the folder has
 * one. A folder without such an entry, or whose entry lacks the locale, keeps its name.
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

  const indexFileName = getNestedIndexFileName(collection);
  const allEntries = entries ?? getAllEntries(collection);
  let prefix = '';

  return path
    .split('/')
    .map((segment) => {
      prefix = prefix ? `${prefix}/${segment}` : segment;

      const entry = allEntries.find(({ subPath }) => subPath === `${prefix}/${indexFileName}`);
      const localizedSubPath = entry?.locales[locale]?.slug;

      return (localizedSubPath ? getOwnFolderName(localizedSubPath) : '') || segment;
    })
    .join('/');
};
