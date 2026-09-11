import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import {
  getMetaPathConfig,
  getNestedConfig,
  getSharedEntryFileName,
  isDescendantPath,
  usesCustomEntryPath,
} from '$lib/services/contents/collection/nested';
import { entryDraft } from '$lib/services/contents/draft';
import { buildCustomEntryPath } from '$lib/services/contents/draft/save/entry-path';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { getUnpublishedEntriesByCollection } from '$lib/services/workflow';

/**
 * @import { EntryDraft, LocaleValidityMap } from '$lib/types/private';
 */

/**
 * Path segments that would let an entry escape the collection folder or produce an unusable file
 * name.
 */
const INVALID_SEGMENT_REGEX = /(?:^|\/)(?:\.{1,2})(?:\/|$)/;

/**
 * Check whether another entry is already stored where this one is headed. The destination can only
 * be worked out ahead of the save when every entry in the collection shares one file name, which is
 * the case that matters: the path editor is then the only thing deciding it, so an overlooked
 * collision would quietly overwrite a page. With localized slugs, each locale has a destination of
 * its own, so every enabled locale is checked against the other entries’ files in that locale.
 * @param {EntryDraft} draft Entry draft.
 * @returns {boolean} Whether the destination is taken.
 * @see https://github.com/decaporg/decap-cms/issues/7094
 */
const isPathTaken = (draft) => {
  const { id, collection, currentLocales } = draft;
  const { defaultLocale } = collection._i18n;
  const indexFileName = getSharedEntryFileName(collection);

  // A blank folder hands the destination back to the collection’s own `path` option and slug, which
  // this check knows nothing about
  if (!indexFileName || !usesCustomEntryPath(draft)) {
    return false;
  }

  const { defaultLocaleSlug, localizedSlugs } = getSlugs({ draft });

  // The unpublished entries count too, or a folder already claimed by a draft awaiting review
  // would be handed out twice and the two would collide when the branches are merged. The entry
  // being edited doesn’t count, and it’s told apart by the draft’s ID rather than the original
  // entry’s: a new entry has no original, yet it’s saved under the draft’s ID, and once it is,
  // the draft is validated again — to see whether the entry can be sent for review — while the
  // saved entry already sits at the destination
  const otherEntries = [
    ...getEntriesByCollection(collection.name),
    ...getUnpublishedEntriesByCollection(collection.name),
  ].filter((entry) => entry.id !== id);

  return Object.entries(currentLocales)
    .filter(([, enabled]) => enabled)
    .some(([locale]) => {
      // Ask for the same sub path the save will build, so the two can’t disagree
      const subPath = buildCustomEntryPath({
        draft,
        slug: localizedSlugs?.[locale] ?? defaultLocaleSlug,
        indexFileName,
        locale,
      });

      return otherEntries.some((entry) =>
        locale === defaultLocale
          ? entry.subPath === subPath
          : entry.locales[locale]?.slug === subPath,
      );
    });
};

/**
 * Validate the folder chosen with the entry path editor. The path editor is only shown when the
 * collection’s `meta.path` option is enabled, so an entry without one is always valid.
 * @param {EntryDraft} [draft] Draft to validate. Defaults to the one open in the editor.
 * @returns {{ valid: boolean, validities: LocaleValidityMap }} Validation results.
 */
export const validatePath = (draft = /** @type {EntryDraft} */ (get(entryDraft))) => {
  const { collection, currentLocales, originalPath, currentPath } = draft;

  if (!getMetaPathConfig(collection)) {
    return { valid: true, validities: {} };
  }

  const path = stripSlashes(currentPath ?? '');
  const patternMismatch = INVALID_SEGMENT_REGEX.test(path) || path.includes('\\');

  // Moving an entry moves the whole subtree below it, so a folder can’t be moved into itself
  const customError =
    !patternMismatch &&
    !!originalPath &&
    path !== originalPath &&
    !!getNestedConfig(collection)?.subfolders &&
    isDescendantPath(originalPath, path);

  const duplicateError = !patternMismatch && !customError && isPathTaken(draft);
  const invalid = patternMismatch || customError || duplicateError;
  /** @type {LocaleValidityMap} */
  const validities = {};

  Object.keys(currentLocales).forEach((locale) => {
    validities[locale] = {
      _path: { patternMismatch, customError, duplicateError, valid: !invalid },
    };
  });

  return { valid: !invalid, validities };
};
