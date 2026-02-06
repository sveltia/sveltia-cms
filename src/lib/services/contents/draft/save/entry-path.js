import { stripSlashes } from '@sveltia/utils/string';

import { fillTemplate } from '$lib/services/common/template';
import { getIndexFile } from '$lib/services/contents/collection/index-file';
import { getLocalePath } from '$lib/services/contents/i18n';
import { createPath } from '$lib/services/utils/file';

/**
 * @import { EntryDraft, InternalEntryCollection, InternalLocaleCode } from '$lib/types/private';
 */

/**
 * Determine the file path for the given entry draft depending on the collection type, i18n config
 * and entry collection’s subpath.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} args.slug Entry slug.
 * @returns {string} Complete path, including the folder, slug, extension and possibly locale.
 * @see https://decapcms.org/docs/i18n/
 * @see https://sveltiacms.app/en/docs/i18n
 */
export const createEntryPath = ({ draft, locale, slug }) => {
  const { collection, collectionFile, originalEntry, currentValues, isIndexFile } = draft;

  const {
    _i18n: { defaultLocale, structure, omitDefaultLocaleFromFileName },
  } = collectionFile ?? collection;

  if (collectionFile) {
    const { _i18n, file } = collectionFile;

    return getLocalePath({ _i18n, locale, path: stripSlashes(file) });
  }

  if (originalEntry?.locales[locale]?.slug === slug) {
    return originalEntry.locales[locale].path;
  }

  const entryCollection = /** @type {InternalEntryCollection} */ (collection);

  const {
    _file: { basePath, subPath, extension },
  } = entryCollection;

  /**
   * Support entry collection’s subpath.
   * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
   * @see https://sveltiacms.app/en/docs/collections/entries#managing-entry-file-paths
   */
  let path = isIndexFile
    ? /** @type {string} */ (getIndexFile(entryCollection)?.name)
    : subPath
      ? fillTemplate(subPath, {
          collection: entryCollection,
          locale,
          content: currentValues[defaultLocale],
          currentSlug: slug,
        })
      : slug;

  // Remove extension from index file name if it already has one
  if (isIndexFile && path?.endsWith(`.${extension}`)) {
    path = path.slice(0, -extension.length - 1);
  }

  const pathOptions = {
    multiple_folders: `${basePath}/${locale}/${path}.${extension}`,
    multiple_folders_i18n_root: `${locale}/${basePath}/${path}.${extension}`, // deprecated
    multiple_root_folders: `${locale}/${basePath}/${path}.${extension}`, // new name
    multiple_files:
      omitDefaultLocaleFromFileName && locale === defaultLocale
        ? `${basePath}/${path}.${extension}`
        : `${basePath}/${path}.${locale}.${extension}`,
    single_file: `${basePath}/${path}.${extension}`,
  };

  // Remove unnecessary slashes in case `basePath` is empty
  return createPath((pathOptions[structure] ?? pathOptions.single_file).split('/'));
};
