import transliterate from '@sindresorhus/transliterate';
import { generateUUID } from '@sveltia/utils/crypto';
import { truncate } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { cmsConfig } from '$lib/services/config';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { InternalCmsConfig } from '$lib/types/private';
 */

/**
 * Locales that are supported in the `locale` option of the transliteration library.
 * @see https://github.com/sindresorhus/transliterate/tree/main#locale
 */
const TRANSLITERATION_LOCALES = ['da', 'de', 'hu', 'nb', 'sr', 'sv', 'tr'];
/**
 * @type {Map<string, { consecutivePattern: RegExp, trimPattern: RegExp }>}
 */
const slugReplacementRegexCache = new Map();

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
 * @see https://sveltiacms.app/en/docs/collections/entries#global-slug-options
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
  } = /** @type {InternalCmsConfig} */ (get(cmsConfig)) ?? {};

  const maxLength = maxLengthParam ?? maxLengthOption;
  let slug = string;

  if (cleanAccents) {
    // Remove any accented characters by transliterating them to their ASCII equivalents
    // @see https://www.npmjs.com/package/@sindresorhus/transliterate
    slug = transliterate(slug.normalize('NFD'), {
      locale: locale && TRANSLITERATION_LOCALES.includes(locale) ? locale : undefined,
    });
  }

  if (encoding === 'ascii') {
    slug = slug.replaceAll(/[^\w-~]/g, ' ');
  } else {
    // Disallow space, control, delimiter, reserved, unwise characters
    // @see https://stackoverflow.com/q/1547899
    slug = slug.replaceAll(/[\p{Z}\p{C}!"#$%&'()*+,/:;<=>?@[\\\]^`{|}]/gu, ' ');
  }

  // Replace all the spaces with replacers (hyphens by default)
  slug = slug.trim().replaceAll(/\s+/g, sanitizeReplacement);

  // Consolidate consecutive replacement characters into a single one and trim them from ends
  if (sanitizeReplacement) {
    const escapedReplacement = sanitizeReplacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const cachedSlugRegexes = getOrCreate(slugReplacementRegexCache, escapedReplacement, () => ({
      consecutivePattern: new RegExp(`${escapedReplacement}+`, 'g'),
      trimPattern: new RegExp(`^${escapedReplacement}+|${escapedReplacement}+$`, 'g'),
    }));

    slug = slug.replace(cachedSlugRegexes.consecutivePattern, sanitizeReplacement);

    // Trim replacement characters from the beginning and end
    if (trimReplacement) {
      slug = slug.replace(cachedSlugRegexes.trimPattern, '');
    }
  }

  if (!slug && fallback) {
    slug = generateUUID('short');
  }

  if (typeof maxLength === 'number' && slug.length > maxLength) {
    slug = truncate(slug, maxLength, { ellipsis: '' });
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
  // looked for in the slugified name, which can start with one even when what was typed didn’t
  if (!folderName || trimmedName.includes('/') || folderName.startsWith('.')) {
    return 'invalid';
  }

  return takenNames.includes(folderName) ? 'duplicate' : undefined;
};
