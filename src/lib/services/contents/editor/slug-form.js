import { _ } from '@sveltia/i18n';

import { validateNewFolderName } from '$lib/services/common/slug';
import { getFolderName } from '$lib/services/contents/collection/nested/i18n';
import { getSlugOptions } from '$lib/services/contents/collection/slug';
import { hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
import {
  getSlugValidationMessage,
  validateSlug,
} from '$lib/services/contents/draft/validate/slugs';
import { getLocaleLabel } from '$lib/services/contents/i18n';

/**
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 */

/**
 * A value the Slug panel lets the user edit: a slug, or the name of the folder the entry occupies.
 * @typedef {object} SlugEditRow
 * @property {InternalLocaleCode} locale Locale.
 * @property {string} label Label of the value.
 * @property {boolean} showLabel Whether to show the label, which is the locale of the value. A
 * value shared by every locale is the only one, which needs no heading.
 * @property {string} value Current slug or folder name.
 */

/**
 * Get the values the Slug panel lets the user edit: the entry’s folder names, in a collection where
 * every entry is an index file within a folder of its own, or else its slugs. A locale the entry
 * has no file for has no slug to rename.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Record<InternalLocaleCode, string> | undefined} args.ownFolderPaths Folder the entry
 * occupies in each locale, if any.
 * @returns {SlugEditRow[]} Values.
 */
export const getSlugEditRows = ({ draft, ownFolderPaths }) => {
  // Each locale has a folder of its own when the slugs are localized, as the folder is named after
  // the slug. Otherwise, the folder is shared by every locale
  // @see https://github.com/sveltia/sveltia-cms/issues/962
  const localized = hasLocalizedSlugs(draft.collection);

  /**
   * Get the label of a value: its locale, or what it is if it’s shared by every locale.
   * @param {InternalLocaleCode} locale Locale, or `_` or `_default` for a slug shared by every
   * locale.
   * @returns {{ label: string, showLabel: boolean }} Label and whether to show it.
   */
  const getLabel = (locale) => {
    const shared = ownFolderPaths ? !localized : ['_', '_default'].includes(locale);

    return shared
      ? { label: _(ownFolderPaths ? 'folder' : 'slug'), showLabel: false }
      : { label: getLocaleLabel(locale) ?? locale, showLabel: true };
  };

  if (ownFolderPaths) {
    return Object.entries(ownFolderPaths).map(([locale, dirPath]) => ({
      locale,
      ...getLabel(locale),
      value: getFolderName(dirPath),
    }));
  }

  return Object.entries(draft.currentSlugs)
    .filter(([, slug]) => slug !== undefined)
    .map(([locale, slug]) => ({
      locale,
      ...getLabel(locale),
      value: /** @type {string} */ (slug),
    }));
};

/**
 * Get the error message for a slug or folder name being edited in the Slug panel.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Record<InternalLocaleCode, string> | undefined} args.ownFolderPaths Folder the entry
 * occupies in each locale, if any, in which case the folder name is edited.
 * @param {Record<InternalLocaleCode, string[]>} args.takenFolderNames Names of the folders
 * sharing a parent with the entry’s own folder in each locale.
 * @param {Record<InternalLocaleCode, string[]>} args.takenSlugs Slugs taken by the other entries,
 * in each locale.
 * @param {InternalLocaleCode} args.locale Locale of the value.
 * @param {string} args.text Value as typed.
 * @returns {string | undefined} Error message, or `undefined` if the value can be used.
 */
export const getSlugEditError = ({
  draft,
  ownFolderPaths,
  takenFolderNames,
  takenSlugs,
  locale,
  text,
}) => {
  if (ownFolderPaths) {
    // A folder name goes by different rules than a slug: it’s slugified on the way out, so what
    // matters is that something usable survives and the folder doesn’t end up hidden behind a
    // leading dot
    const error = validateNewFolderName({ takenNames: takenFolderNames[locale], name: text });

    return error ? _(`new_parent_folder_error.${error}`) : undefined;
  }

  const { pattern } = getSlugOptions(draft.collection);
  const error = validateSlug({ slug: text, pattern, takenSlugs: takenSlugs[locale], locale });

  return error ? getSlugValidationMessage({ error, pattern }) : undefined;
};
