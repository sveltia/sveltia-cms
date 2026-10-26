import transliterate from '@sindresorhus/transliterate';
import { generateUUID } from '@sveltia/utils/crypto';
import { escapeRegExp, truncate } from '@sveltia/utils/string';

import {
  UNSAFE_ASCII_SLUG_CHARS_REGEX,
  UNSAFE_UNICODE_SLUG_CHARS_REGEX,
} from '$lib/services/common/slug/constants';
import { cmsConfig } from '$lib/services/config';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { InternalCmsConfig } from '$lib/types/private';
 */

/**
 * Regular expression to match the dots at the beginning of a slug.
 */
const LEADING_DOTS_REGEX = /^\.+/;
/**
 * Regular expression to match the dots at the end of a slug.
 */
const TRAILING_DOTS_REGEX = /\.+$/;

/**
 * Global variants of the unsafe character patterns, keyed by the `encoding` option, to replace
 * every unsafe character in a string at once.
 */
const UNSAFE_CHARS_REGEXES = {
  unicode: new RegExp(UNSAFE_UNICODE_SLUG_CHARS_REGEX, 'gv'),
  ascii: new RegExp(UNSAFE_ASCII_SLUG_CHARS_REGEX, 'g'),
};

/**
 * Regular expressions to consolidate and trim the replacement characters, keyed by the escaped
 * replacement.
 * @type {Map<string, Record<'consecutivePattern' | 'trimPattern' | 'leadingDotsPattern' |
 * 'trailingDotsPattern', RegExp>>}
 */
const slugReplacementRegexCache = new Map();

/**
 * Get the regular expressions to consolidate and trim the given replacement character.
 * @param {string} replacement Non-empty `sanitize_replacement` option value.
 * @returns {Record<'consecutivePattern' | 'trimPattern' | 'leadingDotsPattern' |
 * 'trailingDotsPattern', RegExp>} Regular expressions.
 */
const getReplacementRegexes = (replacement) => {
  const escapedReplacement = escapeRegExp(replacement);

  return getOrCreate(slugReplacementRegexCache, escapedReplacement, () => ({
    // Group the replacement so that a multi-character one is repeated as a whole
    consecutivePattern: new RegExp(`(?:${escapedReplacement})+`, 'g'),
    trimPattern: new RegExp(`^(?:${escapedReplacement})+|(?:${escapedReplacement})+$`, 'g'),
    leadingDotsPattern: new RegExp(`^(?:\\.|${escapedReplacement})+`),
    trailingDotsPattern: new RegExp(`(?:\\.|${escapedReplacement})+$`),
  }));
};

/**
 * Get the regular expression that matches what a slug can’t end with: dots, which a Git branch name
 * can’t end with, and replacement characters, unless the `slug.trim` option is turned off, so a
 * slug can still end with a replacement character then.
 * @param {InternalCmsConfig['slug']} [slugOptions] Global slug options.
 * @returns {RegExp} Regular expression.
 */
const getTrailingDotsPattern = ({ sanitize_replacement: replacement = '-', trim = true } = {}) =>
  replacement && trim
    ? getReplacementRegexes(replacement).trailingDotsPattern
    : TRAILING_DOTS_REGEX;

/**
 * Remove the dots and replacement characters from the end of a slug, e.g. one cut down to a maximum
 * length, or filled from a template ending with a dot. It follows the global `slug` options, like
 * {@link slugify}: with `slug.trim` turned off, only dots are removed.
 * @param {string} slug Slug.
 * @returns {string} Slug.
 */
export const trimSlugEnd = (slug) =>
  slug.replace(
    getTrailingDotsPattern(/** @type {InternalCmsConfig} */ (cmsConfig.current)?.slug),
    '',
  );

/**
 * Get the time zone the date/time tags of a slug, entry path or file name template are filled in,
 * according to the global `slug.timezone` option: UTC by default, for compatibility with
 * Netlify/Decap CMS, or the user’s local time zone with `local`.
 * @returns {'UTC' | undefined} Time zone to pass to `getDateTimeParts()`, where `undefined` stands
 * for the local time zone.
 */
export const getSlugTimeZone = () =>
  /** @type {InternalCmsConfig} */ (cmsConfig.current)?.slug?.timezone === 'local'
    ? undefined
    : 'UTC';

/**
 * Slugify the given string to be used as a filename or URL slug, based on the `slug` configuration.
 * This function can be used for both entry slugs and asset file names.
 * @param {string} string String to be normalized.
 * @param {object} [options] Options.
 * @param {boolean} [options.fallback] Whether to return a fallback value if the slug is empty.
 * Defaults to `true`, which returns a part of a UUID.
 * @param {string} [options.locale] BCP 47 language tag passed to the transliterate library when
 * `clean_accents` is enabled.
 * @param {number} [options.maxLength] Maximum length of the slug.
 * @returns {string} Slug.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 * @see https://sveltiacms.app/en/docs/collections/entries/slugs#global-slug-options
 */
export const slugify = (
  string,
  { fallback = true, locale = undefined, maxLength: maxLengthParam = undefined } = {},
) => {
  const {
    slug: {
      encoding = 'unicode',
      clean_accents: cleanAccents = false,
      sanitize_replacement: sanitizeReplacement = '-',
      maxlength: maxLengthOption = undefined,
      trim: trimReplacement = true,
      lowercase = true,
    } = {},
  } = /** @type {InternalCmsConfig} */ (cmsConfig.current) ?? {};

  const maxLength = maxLengthParam ?? maxLengthOption;
  let slug = string;

  if (cleanAccents) {
    // Remove any accented characters by transliterating them to their ASCII equivalents. The
    // library takes a BCP 47 tag and picks the rules for its language, e.g. `tr` for `tr-TR`, and
    // `nb` for `no`, while ignoring a locale it has no rules for. An underscore, as in `pt_BR`, is
    // turned into a hyphen it understands
    // @see https://www.npmjs.com/package/@sindresorhus/transliterate
    slug = transliterate(slug.normalize('NFD'), { locale: locale?.replaceAll('_', '-') });
  }

  // Turn every unsafe character into a space, which is then replaced below
  slug = slug.replaceAll(UNSAFE_CHARS_REGEXES[encoding === 'ascii' ? 'ascii' : 'unicode'], ' ');

  // Replace all the spaces with replacers (hyphens by default)
  slug = slug.trim().replaceAll(/\s+/g, sanitizeReplacement);

  let leadingDotsPattern = LEADING_DOTS_REGEX;

  // Consolidate consecutive replacement characters into a single one and trim them from ends
  if (sanitizeReplacement) {
    const cachedSlugRegexes = getReplacementRegexes(sanitizeReplacement);

    slug = slug.replace(cachedSlugRegexes.consecutivePattern, sanitizeReplacement);

    // Trim replacement characters from the beginning and end
    if (trimReplacement) {
      slug = slug.replace(cachedSlugRegexes.trimPattern, '');
      ({ leadingDotsPattern } = cachedSlugRegexes);
    }
  }

  const trailingDotsPattern = getTrailingDotsPattern({
    sanitize_replacement: sanitizeReplacement,
    trim: trimReplacement,
  });

  // Remove leading dots, which the `unicode` encoding allows: a slug starting with one, e.g. from a
  // title like `.NET Tips`, would make a dot file, which is hidden and skipped when the repository
  // files are listed, so the entry would be lost from sight once saved. When trimming is enabled,
  // the replacement characters a dot leaves at the beginning go too, as in `. NET` or `.-.NET`
  slug = slug.replace(leadingDotsPattern, '');

  // Remove trailing dots as well, e.g. from a title like `Hello world.`: a Git branch name can’t
  // end with one, so the entry couldn’t be saved with Editorial Workflow, and Windows drops it from
  // a file name, which would no longer match the path in the repository. When trimming is enabled,
  // the replacement characters a dot leaves at the end go too, as in `Wait .`
  slug = slug.replace(trailingDotsPattern, '');

  if (!slug && fallback) {
    slug = generateUUID('short');
  }

  if (typeof maxLength === 'number' && slug.length > maxLength) {
    slug = truncate(slug, maxLength, { ellipsis: '' });

    // Trim the dots and replacement characters the cut may leave at the end
    slug = slug.replace(trailingDotsPattern, '');
  }

  if (lowercase) {
    slug = slug.toLocaleLowerCase();
  }

  return slug;
};

/**
 * Turn what was typed in the new folder dialog into the name the folder is actually given. The name
 * goes through the same slugification as an entry slug, so a folder created by hand looks like one
 * created by saving an entry into it. The random fallback is turned off: a name made up entirely of
 * characters that can’t be used would otherwise become a random string, which is no one’s idea of a
 * folder name, so nothing is returned and the name is rejected instead.
 * @param {string} name Name as typed.
 * @returns {string} Folder name. An empty string if slugification leaves nothing behind.
 */
export const getNewFolderName = (name) => slugify(name.trim(), { fallback: false });

/**
 * Check whether a folder can be given the name typed in, either while creating one with the parent
 * folder picker or while renaming one with the slug editor.
 * @param {object} args Arguments.
 * @param {string[]} args.takenNames Names of the folders already sharing the parent folder.
 * @param {string} args.name Name to check, as typed.
 * @returns {'empty' | 'invalid' | 'duplicate' | undefined} What stops the name from being used, or
 * `undefined` if it can be used.
 */
export const validateNewFolderName = ({ takenNames, name }) => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return 'empty';
  }

  const folderName = getNewFolderName(trimmedName);

  // A name has to stay a single folder, a leading dot would hide the folder from the site and from
  // most file listings, and slugification can leave nothing to name the folder with. The dot is
  // looked for in what was typed: slugification removes it, but a name meant to be hidden is
  // rejected rather than silently given another one
  if (!folderName || trimmedName.includes('/') || trimmedName.startsWith('.')) {
    return 'invalid';
  }

  return takenNames.includes(folderName) ? 'duplicate' : undefined;
};
