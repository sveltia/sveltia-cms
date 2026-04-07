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
