import { stripSlashes } from '@sveltia/utils/string';
import { fillTemplate } from '$lib/services/common/template';
import { getIndexFile } from '$lib/services/contents/collection/index-file';
import { getLocalePath } from '$lib/services/contents/i18n';

/**
 * @import { EntryCollection, EntryDraft, InternalLocaleCode } from '$lib/types/private';
 */

/**
 * Determine the file path for the given entry draft depending on the collection type, i18n config
 * and folder collections path.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} args.slug Entry slug.
 * @returns {string} Complete path, including the folder, slug, extension and possibly locale.
 * @see https://decapcms.org/docs/i18n/
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

  const entryCollection = /** @type {EntryCollection} */ (collection);

  const {
    _file: { basePath, subPath, extension },
  } = entryCollection;

  /**
   * Support folder collections path.
   * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
   */
  const path = isIndexFile
    ? /** @type {string} */ (getIndexFile(entryCollection)?.name)
    : subPath
      ? fillTemplate(subPath, {
          collection: entryCollection,
          locale,
          content: currentValues[defaultLocale],
          currentSlug: slug,
        })
      : slug;

  const pathOptions = {
    multiple_folders: `${basePath}/${locale}/${path}.${extension}`,
    multiple_folders_i18n_root: `${locale}/${basePath}/${path}.${extension}`,
    multiple_files:
      omitDefaultLocaleFromFileName && locale === defaultLocale
        ? `${basePath}/${path}.${extension}`
        : `${basePath}/${path}.${locale}.${extension}`,
    single_file: `${basePath}/${path}.${extension}`,
  };

  return pathOptions[structure] ?? pathOptions.single_file;
};
