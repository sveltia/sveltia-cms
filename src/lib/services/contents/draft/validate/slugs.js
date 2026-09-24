import { _ } from '@sveltia/i18n';

import { slugify } from '$lib/services/common/slug';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getSharedEntryFileName } from '$lib/services/contents/collection/nested';
import { getSlugOptions } from '$lib/services/contents/collection/slug';
import { getRegex } from '$lib/services/utils/regex';
import { getUnpublishedEntriesByCollection } from '$lib/services/workflow';

/**
 * @import {
 * Entry,
 * EntryDraft,
 * EntryValidityState,
 * InternalLocaleCode,
 * LocaleValidityMap,
 * UnpublishedEntry,
 * } from '$lib/types/private';
 */

/**
 * What stops a slug from being used: it’s empty, contains a slash or whitespace, doesn’t match the
 * collection’s `pattern` slug option, or is taken by another entry.
 * @typedef {'empty' | 'invalid' | 'pattern' | 'duplicate'} SlugValidationError
 */

/**
 * Get the other entries of the collection the draft belongs to: the published ones and the
 * unpublished ones, leaving out any version of the entry being edited. With Editorial Workflow, a
 * draft that has already renamed the entry leaves the published version behind under the old slug,
 * so that version has to be recognized as the same entry — otherwise reverting the slug looks like
 * a conflict. The unpublished entries are concatenated rather than swapped over their published
 * versions, because a draft that renamed an entry leaves the published file behind, so both slugs
 * are still in use.
 * @param {EntryDraft} draft Entry draft.
 * @returns {(Entry | UnpublishedEntry)[]} Entries.
 */
export const getOtherEntries = (draft) => {
  // An entry in the Editorial Workflow has previous paths
  const { collectionName, originalEntry } =
    /** @type {EntryDraft & { originalEntry?: UnpublishedEntry }} */ (draft);

  // Every file path this entry occupies
  const ownPaths = new Set([
    ...Object.values(originalEntry?.locales ?? {}).map(({ path }) => path),
    ...(originalEntry?.workflow?.previousPaths ?? []),
  ]);

  return [
    ...getEntriesByCollection(collectionName),
    ...getUnpublishedEntriesByCollection(collectionName),
  ].filter((entry) => !Object.values(entry.locales).some(({ path }) => ownPaths.has(path)));
};

/**
 * Get the slugs taken by the other entries of the collection, for each locale of the draft’s slugs.
 * A locale-agnostic slug, under the `_` key, can collide with another entry’s slug in any locale.
 * The entry’s own original slugs never count as taken.
 * @param {EntryDraft} draft Entry draft.
 * @param {InternalLocaleCode[]} [locales] Locales to get the taken slugs for. Default: the locales
 * of the draft’s slugs.
 * @returns {Record<InternalLocaleCode, string[]>} Taken slugs for each locale.
 */
export const getTakenSlugs = (draft, locales = Object.keys(draft.currentSlugs)) => {
  const { originalSlugs } = draft;
  const otherEntries = getOtherEntries(draft);
  const ownSlugs = new Set(Object.values(originalSlugs));

  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      otherEntries
        .flatMap((entry) =>
          locale === '_'
            ? Object.values(entry.locales).map(({ slug }) => slug)
            : [entry.locales[locale]?.slug],
        )
        .filter((slug) => typeof slug === 'string' && !ownSlugs.has(slug)),
    ]),
  );
};

/**
 * Check whether the given slug can be used.
 * @param {object} args Arguments.
 * @param {string | undefined} args.slug Slug to check, as typed.
 * @param {boolean} [args.required] Whether the slug must be given. An empty slug that isn’t
 * required is valid, as the slug template fills it instead.
 * @param {[string | RegExp, string]} [args.pattern] The collection’s `pattern` slug option.
 * @param {string[]} [args.takenSlugs] Slugs taken by the other entries.
 * @param {InternalLocaleCode} [args.locale] Locale of the slug, used to slugify it the same way it
 * will be saved.
 * @returns {SlugValidationError | undefined} What stops the slug from being used, or `undefined` if
 * it can be used.
 */
export const validateSlug = ({ slug, required = true, pattern, takenSlugs = [], locale }) => {
  const trimmedSlug = slug?.trim() ?? '';

  if (!trimmedSlug) {
    return required ? 'empty' : undefined;
  }

  // A slash or whitespace would break the file path and URL structure
  if (/[/\s]/.test(/** @type {string} */ (slug))) {
    return 'invalid';
  }

  if (Array.isArray(pattern)) {
    const regex = getRegex(pattern[0]);

    if (regex && !regex.test(trimmedSlug)) {
      return 'pattern';
    }
  }

  // Compare the slug the way it will be saved
  if (takenSlugs.includes(slugify(trimmedSlug, { locale }))) {
    return 'duplicate';
  }

  return undefined;
};

/**
 * Get the message for the given slug validation error.
 * @param {object} args Arguments.
 * @param {SlugValidationError} args.error Error.
 * @param {[string | RegExp, string]} [args.pattern] The collection’s `pattern` slug option, whose
 * second item is the message for a slug that doesn’t match.
 * @returns {string} Message.
 */
export const getSlugValidationMessage = ({ error, pattern }) =>
  error === 'pattern' && pattern?.[1] ? pattern[1] : _(`edit_slug_error.${error}`);

/**
 * Check whether the slug of the given locale has to be validated. For a new entry, that’s when the
 * slug editor is shown. For an existing entry, that’s when the slug has been edited, except in a
 * collection where every entry is an index file within a folder of its own: there the slug editor
 * renames the folder, which goes by different rules than a slug, and a localized slug is a sub
 * path.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale, or `_` for a locale-agnostic slug.
 * @returns {boolean} Result.
 */
const isSlugEditable = ({ draft, locale }) => {
  const { collection, isNew, currentLocales, currentSlugs, originalSlugs, slugEditor } = draft;

  // The slug can only be edited in an entry collection; the slug of a file/singleton collection’s
  // entry is the file name
  if (collection._type !== 'entry') {
    return false;
  }

  // Only validate slugs for locales that are currently enabled. A disabled locale’s slug is not
  // written to disk, so an empty value should not block saving.
  // @see https://github.com/sveltia/sveltia-cms/issues/740
  if (locale !== '_' && !currentLocales?.[locale]) {
    return false;
  }

  if (isNew) {
    return !!slugEditor[locale];
  }

  return currentSlugs[locale] !== originalSlugs[locale] && !getSharedEntryFileName(collection);
};

/**
 * Validate the slugs and return the results. A slug is validated when the user can edit it: in a
 * new entry with the slug editor shown, or in an existing entry whose slug has been edited.
 * @param {EntryDraft} draft Draft to validate.
 * @returns {{ valid: boolean, validities: LocaleValidityMap }} Validation results.
 */
export const validateSlugs = (draft) => {
  const { collection, isNew, currentSlugs, slugEditor } = draft;
  /** @type {LocaleValidityMap} */
  const validities = {};
  let valid = true;
  /** @type {Record<InternalLocaleCode, string[]> | undefined} */
  let takenSlugs;
  // The options are only used for an entry collection, where the slug can be edited
  const { editorRequired, editorValueIsSlug, pattern } = getSlugOptions(collection);
  // An existing entry’s slug is edited as a whole. A new entry’s value can be only a part of the
  // slug, in which case it can’t be told whether the slug is taken
  const isWholeSlug = !isNew || editorValueIsSlug;
  // A slug editor that has never been shown, e.g. in a closed sidebar panel, hasn’t set its slug
  // yet, and the slug must still be given
  const locales = new Set([...Object.keys(currentSlugs), ...Object.keys(slugEditor)]);

  locales.forEach((locale) => {
    const slug = currentSlugs[locale];

    const error = isSlugEditable({ draft, locale })
      ? validateSlug({
          slug,
          // An existing entry always needs a slug, while a new entry’s slug can come from the
          // template
          required: !isNew || editorRequired,
          pattern,
          // Only look for other entries when the slug could collide with one
          takenSlugs:
            isWholeSlug && slug?.trim() ? (takenSlugs ??= getTakenSlugs(draft))[locale] : [],
          locale,
        })
      : undefined;

    /** @type {EntryValidityState} */
    const validity = {
      valueMissing: error === 'empty',
      patternMismatch: error === 'invalid',
      customError: error === 'pattern',
      duplicateError: error === 'duplicate',
      valid: !error,
    };

    if (error) {
      valid = false;
      validity.customErrorMessage = getSlugValidationMessage({ error, pattern });
    }

    validities[locale] = { _slug: validity };
  });

  return { valid, validities };
};
