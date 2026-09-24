import { getPathInfo } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';

import { getNewFolderName, slugify } from '$lib/services/common/slug';
import {
  getEntryDirPath,
  getSharedEntryFileName,
  isNestedCollection,
} from '$lib/services/contents/collection/nested';
import { getFolderName, getOwnFolderName } from '$lib/services/contents/collection/nested/i18n';
import { getSlugOptions } from '$lib/services/contents/collection/slug';
import { getSlugs, hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
import { getOtherEntries } from '$lib/services/contents/draft/validate/slugs';
import { createPath } from '$lib/services/utils/file';
import { getUnpublishedEntryByDraft, isPendingDeletion } from '$lib/services/workflow';

/**
 * @import { EntryDraft, InternalEntryCollection, InternalLocaleCode } from '$lib/types/private';
 */

/**
 * Check whether the entry has a slug the Slug panel can show. Only an entry collection has slugs;
 * the slug of a file/singleton collection’s entry is the file name, and the collection’s index file
 * has a fixed name.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @returns {boolean} Result.
 */
export const hasEntrySlug = (draft) =>
  !!draft && draft.collection._type === 'entry' && !draft.isIndexFile;

/**
 * Check whether the slug of an existing entry can be updated. The collection’s `editable` slug
 * option has to allow it, and the entry has to be identified by a name of its own: an entry in a
 * nested collection that doesn’t store every entry as an index file is identified by its path
 * within the collection folder, which can’t be renamed without relocating the entry. An entry
 * awaiting deletion is read-only.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @returns {boolean} Result.
 */
export const canUpdateSlug = (draft) => {
  if (
    !draft ||
    draft.isNew ||
    !hasEntrySlug(draft) ||
    // Look the entry up in the store, as its status can be changed while the editor is open
    isPendingDeletion(getUnpublishedEntryByDraft(draft))
  ) {
    return false;
  }

  // The collection is an entry collection, as checked above
  const { collection } = /** @type {EntryDraft & { collection: InternalEntryCollection }} */ (
    draft
  );

  if (isNestedCollection(collection) && !getSharedEntryFileName(collection)) {
    return false;
  }

  return getSlugOptions(collection).editable.update;
};

/**
 * Check whether a new entry’s slug has to be given with the slug editor, which is when the slug
 * template can’t fill it. The Slug panel is opened for such an entry, so the field isn’t missed.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @returns {boolean} Result.
 */
export const needsSlugInput = (draft) =>
  !!draft?.isNew &&
  hasEntrySlug(draft) &&
  Object.values(draft.slugEditor).includes(true) &&
  getSlugOptions(draft.collection).editorRequired;

/**
 * Get the slug a new entry would be saved with if it was saved now, which is shown while the entry
 * is being edited. Date and time tags in the slug template are filled with the current date and
 * time, as they will be with the time of the save.
 * @param {EntryDraft} draft Entry draft.
 * @param {object} [options] Options.
 * @param {boolean} [options.templateOnly] Whether to ignore a filled-in slug editor, to get the
 * slugs the template fills.
 * @returns {Record<InternalLocaleCode, string>} Slug for each enabled locale if the slug is
 * localized. Otherwise the slug shared by every locale, under the `_` key.
 * @see https://github.com/sveltia/sveltia-cms/discussions/736
 */
export const getSlugPreviews = (draft, { templateOnly = false } = {}) => {
  const { defaultLocaleSlug, localizedSlugs } = getSlugs({ draft, templateOnly });

  if (!localizedSlugs) {
    return { _: defaultLocaleSlug };
  }

  // Every enabled locale has a slug
  return /** @type {Record<InternalLocaleCode, string>} */ (
    Object.fromEntries(
      Object.entries(localizedSlugs).filter(([locale]) => !!draft.currentLocales[locale]),
    )
  );
};

/**
 * Update the slugs of an existing entry. The slugs are slugified the way a new entry’s slug is.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Record<InternalLocaleCode, string>} args.slugs Slugs as typed, for the locales to update.
 * The other locales’ slugs are left as is.
 */
export const updateSlugs = ({ draft, slugs }) => {
  draft.currentSlugs = {
    ...draft.currentSlugs,
    ...Object.fromEntries(
      Object.entries(slugs).map(([locale, slug]) => [locale, slugify(slug, { locale })]),
    ),
  };
};

/**
 * Get the folder the entry occupies in each locale, in a collection where every entry is an index
 * file within a folder of its own. The folder name is what identifies the entry, so renaming it is
 * what the slug editor does there. The default locale’s folder is the one the path editor points
 * at; the other locales are only there when the folder is localized, and their folder is the one in
 * the localized slug, which is the entry’s sub path in that locale.
 * @param {EntryDraft} draft Entry draft.
 * @returns {Record<InternalLocaleCode, string> | undefined} Folder paths, or `undefined` if the
 * entry doesn’t occupy a folder of its own, including a new entry, which has no folder yet.
 * @see https://github.com/sveltia/sveltia-cms/issues/962
 */
export const getOwnFolderPaths = (draft) => {
  const { collection, isNew, defaultLocale, currentPath, currentLocales, currentSlugs } = draft;

  if (isNew || !getSharedEntryFileName(collection)) {
    return undefined;
  }

  /* v8 ignore next -- an existing entry always has a path */
  const ownFolderPath = stripSlashes(currentPath ?? '');

  // The folder is shared by every locale unless the slugs are localized, as the folder is named
  // after the slug
  if (!hasLocalizedSlugs(collection)) {
    return { [defaultLocale]: ownFolderPath };
  }

  return {
    [defaultLocale]: ownFolderPath,
    ...Object.fromEntries(
      Object.entries(currentSlugs)
        .filter(
          ([locale, slug]) =>
            locale !== defaultLocale &&
            !!currentLocales[locale] &&
            !!getOwnFolderName(/** @type {string} */ (slug)),
        )
        .map(([locale, slug]) => [locale, getEntryDirPath(/** @type {string} */ (slug))]),
    ),
  };
};

/**
 * Get the names of the folders sharing a parent with the entry’s own folder in each locale, which
 * are the only ones that can be in the way when renaming it. In another locale than the default,
 * the siblings are the folders next to the entry’s localized folder.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Record<InternalLocaleCode, string>} args.ownFolderPaths Folder the entry occupies in each
 * locale. See {@link getOwnFolderPaths}.
 * @returns {Record<InternalLocaleCode, string[]>} Taken folder names for each locale.
 */
export const getTakenFolderNames = ({ draft, ownFolderPaths }) => {
  const { defaultLocale, originalEntry } = draft;
  const otherEntries = getOtherEntries(draft).filter((entry) => entry.id !== originalEntry?.id);

  return Object.fromEntries(
    Object.entries(ownFolderPaths).map(([locale, dirPath]) => {
      const parentPath = getEntryDirPath(dirPath);

      return [
        locale,
        otherEntries
          .map((entry) => (locale === defaultLocale ? entry.subPath : entry.locales[locale]?.slug))
          .filter((otherSubPath) => typeof otherSubPath === 'string')
          .map((otherSubPath) => getEntryDirPath(otherSubPath))
          .filter((otherDirPath) => getEntryDirPath(otherDirPath) === parentPath)
          .map((otherDirPath) => getFolderName(otherDirPath)),
      ];
    }),
  );
};

/**
 * Rename the entry’s own folder in each locale, in a collection where every entry is an index file
 * within a folder of its own. Renaming the folder is what moves the entry, so the rest of the save
 * takes care of the entries and assets stored below it.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Record<InternalLocaleCode, string>} args.ownFolderPaths Folder the entry occupies in each
 * locale.
 * @param {Record<InternalLocaleCode, string>} args.folderNames New folder names as typed, for each
 * locale.
 */
export const renameEntryFolders = ({ draft, ownFolderPaths, folderNames }) => {
  const { defaultLocale } = draft;
  let { currentPath, currentSlugs: slugs } = draft;

  Object.entries(folderNames).forEach(([locale, name]) => {
    const dirPath = createPath([getEntryDirPath(ownFolderPaths[locale]), getNewFolderName(name)]);

    if (locale === defaultLocale) {
      currentPath = dirPath;
    } else {
      // The localized slug of an existing entry is its sub path in the locale, so the folder is
      // renamed within it, leaving the file name in place
      slugs = {
        ...slugs,
        [locale]: createPath([
          dirPath,
          getPathInfo(/** @type {string} */ (slugs[locale])).basename,
        ]),
      };
    }
  });

  draft.currentPath = currentPath;
  draft.currentSlugs = slugs;
};
