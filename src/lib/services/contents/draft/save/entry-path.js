import { getPathInfo } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';

import { fillTemplate } from '$lib/services/common/template';
import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
import {
  getEntryDirPath,
  getSharedEntryFileName,
  usesCustomEntryPath,
} from '$lib/services/contents/collection/nested';
import {
  getFolderName,
  getOwnFolderName,
  localizeDirPath,
} from '$lib/services/contents/collection/nested/i18n';
import { hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
import { getLocalePath } from '$lib/services/contents/i18n';
import { createPath } from '$lib/services/utils/file';

/**
 * @import {
 * Entry,
 * EntryDraft,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { I18nFileStructure } from '$lib/types/public';
 */

/**
 * Build the file path based on i18n structure and locale settings.
 * @param {object} args Arguments.
 * @param {string} args.basePath Base directory path.
 * @param {string} args.path File path (slug or subpath).
 * @param {string} args.extension File extension.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {boolean} args.omitLocale Whether to omit locale from the file path.
 * @param {I18nFileStructure} args.structure I18n structure type.
 * @returns {string} Complete file path string.
 */
export const buildPathByStructure = ({
  basePath,
  path,
  extension,
  locale,
  omitLocale,
  structure,
}) => {
  switch (structure) {
    case 'multiple_folders':
      return omitLocale
        ? `${basePath}/${path}.${extension}`
        : `${basePath}/${locale}/${path}.${extension}`;
    case 'multiple_folders_i18n_root': // deprecated
    case 'multiple_root_folders': // new name
      return omitLocale
        ? `${basePath}/${path}.${extension}`
        : `${locale}/${basePath}/${path}.${extension}`;
    case 'multiple_files':
      return omitLocale
        ? `${basePath}/${path}.${extension}`
        : `${basePath}/${path}.${locale}.${extension}`;
    default:
      return `${basePath}/${path}.${extension}`;
  }
};

/**
 * Build the entry’s sub path from the folder chosen with the path editor. The file name within the
 * folder is either the one shared by every entry in the collection, as configured with the
 * `meta.path.index_file` option, or the entry’s own file name: the slug for a new entry, or the
 * existing file name for an entry that’s only being moved. With a shared file name, the chosen
 * folder is where a new entry is created rather than the entry’s own folder, which is named after
 * the slug.
 *
 * The folder is chosen once, in the default locale. When the slugs are localized, so are the
 * folders named after them, and each locale’s file goes below the localized folder chain, in a
 * folder named after the localized slug.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.slug Entry slug in the locale. For an existing entry in a nested collection,
 * that’s the entry’s sub path in the locale.
 * @param {string | undefined} args.indexFileName File name shared by every entry in the collection,
 * if any.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @returns {string} Sub path without a file extension.
 * @see https://github.com/sveltia/sveltia-cms/issues/962
 */
export const buildCustomEntryPath = ({ draft, slug, indexFileName, locale }) => {
  const { collection, isNew, originalEntry, currentPath } = draft;
  const dirPath = stripSlashes(currentPath ?? '');
  const localized = locale !== collection._i18n.defaultLocale && hasLocalizedSlugs(collection);

  if (indexFileName) {
    // Every entry shares one file name, so a folder is what makes an entry. A new entry therefore
    // gets a folder of its own, named after the slug, within the folder the editor points at
    if (isNew) {
      return createPath([localizeDirPath({ collection, dirPath, locale }), slug, indexFileName]);
    }

    // An existing entry already has such a folder, and the editor points at it. In another locale,
    // the folder goes by the name in the localized slug; a locale that has just been enabled has a
    // bare slug, which becomes the folder name as it would for a new entry
    const parentPath = localizeDirPath({ collection, dirPath: getEntryDirPath(dirPath), locale });
    const ownFolderName = localized ? getOwnFolderName(slug) || slug : getFolderName(dirPath);

    return createPath([parentPath, ownFolderName, indexFileName]);
  }

  // The sub path already has the locale and the file extension stripped off. A locale that has just
  // been enabled keeps its localized slug, or it would be saved under the default locale’s name
  const originalSubPath =
    originalEntry?.locales[locale]?.slug ?? (localized ? undefined : originalEntry?.subPath);

  const fileName = originalSubPath ? getPathInfo(originalSubPath).basename : slug;

  return createPath([localizeDirPath({ collection, dirPath, locale }), fileName]);
};

/**
 * Check whether an existing entry’s file in the given locale stays where it is. The path editor
 * decides where the entry goes, so the slug alone can’t tell whether the file has moved; but as
 * long as the folder is left as it was and the slug is unchanged, the file stays put, even if not
 * where a rebuild would put it, e.g. a locale stored under folders that weren’t localized at the
 * time. Without the path editor, an unchanged slug is enough.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} args.slug Entry slug in the locale.
 * @returns {boolean} Result. Always `false` for a new entry, which has no file yet.
 */
export const keepsOriginalPath = ({ draft, locale, slug }) => {
  const { originalEntry, originalPath, currentPath } = draft;

  // A partial entry, without the locales, can stand in for the original when a draft is only built
  // to be checked
  if (originalEntry?.locales?.[locale]?.slug !== slug) {
    return false;
  }

  if (!usesCustomEntryPath(draft)) {
    return true;
  }

  // The path editor is in use, so the folder is set
  return stripSlashes(originalPath ?? '') === stripSlashes(/** @type {string} */ (currentPath));
};

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
    _i18n: { defaultLocale, structure, omitDefaultLocaleFromFilePath },
  } = collectionFile ?? collection;

  if (collectionFile) {
    const { _i18n, file } = collectionFile;

    return getLocalePath({ _i18n, locale, path: stripSlashes(file) });
  }

  const entryCollection = /** @type {InternalEntryCollection} */ (collection);
  const indexFileName = getSharedEntryFileName(entryCollection);
  // A blank folder in the path editor means the entry goes where it would without the editor, so
  // the collection’s own `path` option and slug take over rather than the entry landing on a bare
  // index file in the collection folder
  // @see https://github.com/decaporg/decap-cms/issues/7094
  const useCustomPath = usesCustomEntryPath(draft);

  if (keepsOriginalPath({ draft, locale, slug })) {
    return /** @type {Entry} */ (originalEntry).locales[locale].path;
  }

  const {
    _file: { basePath, subPath, extension },
  } = entryCollection;

  /**
   * Support entry collection’s subpath.
   * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
   * @see https://decapcms.org/docs/collection-nested/
   * @see https://sveltiacms.app/en/docs/collections/entries#managing-entry-file-paths
   */
  let path = isIndexFile
    ? /** @type {string} */ (getIndexFile(entryCollection)?.name)
    : useCustomPath
      ? buildCustomEntryPath({ draft, slug, indexFileName, locale })
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

  const pathString = buildPathByStructure({
    basePath: /** @type {string} */ (basePath),
    path,
    extension,
    locale,
    omitLocale: omitDefaultLocaleFromFilePath && locale === defaultLocale,
    structure,
  });

  // Remove unnecessary slashes in case `basePath` is empty
  return createPath(pathString.split('/'));
};
