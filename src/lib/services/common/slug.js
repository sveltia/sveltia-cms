import transliterate from '@sindresorhus/transliterate';
import { generateUUID } from '@sveltia/utils/crypto';
import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';

/**
 * @import { InternalSiteConfig } from '$lib/types/private';
 */

/**
 * Slugify the given string to be used as a filename or URL slug, based on the `slug` configuration.
 * This function can be used for both entry slugs and asset file names.
 * @param {string} string String to be normalized.
 * @param {object} [options] Options.
 * @param {boolean} [options.fallback] Whether to return a fallback value if the slug is empty.
 * Defaults to `true`, which returns a part of a UUID.
 * @returns {string} Slug.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 */
export const slugify = (string, { fallback = true } = {}) => {
  const {
    slug: {
      encoding = 'unicode',
      clean_accents: cleanAccents = false,
      sanitize_replacement: sanitizeReplacement = '-',
    } = {},
  } = /** @type {InternalSiteConfig} */ (get(siteConfig)) ?? {};

  let slug = string;

  if (cleanAccents) {
    // Remove any accent after transliteration
    // @see https://www.npmjs.com/package/@sindresorhus/transliterate
    // @see https://stackoverflow.com/q/990904
    slug = transliterate(slug)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  if (encoding === 'ascii') {
    slug = slug.replaceAll(/[^\w-~]/g, ' ');
  } else {
    // Disallow space, control, delimiter, reserved, unwise characters
    // @see https://stackoverflow.com/q/1547899
    slug = slug.replaceAll(/[\p{Z}\p{C}!"#$&'()*+,/:;<=>?@[\]^`{|}]/gu, ' ');
  }

  // Make the string lowercase; replace all the spaces with replacers (hyphens by default)
  slug = slug.toLocaleLowerCase().trim().replaceAll(/\s+/g, sanitizeReplacement);

  // Consolidate consecutive replacement characters into a single one and trim them from ends
  if (sanitizeReplacement) {
    const escapedReplacement = sanitizeReplacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const consecutivePattern = new RegExp(`${escapedReplacement}+`, 'g');

    slug = slug.replace(consecutivePattern, sanitizeReplacement);

    // Trim replacement characters from the beginning and end
    const trimPattern = new RegExp(`^${escapedReplacement}+|${escapedReplacement}+$`, 'g');

    slug = slug.replace(trimPattern, '');
  }

  if (!slug && fallback) {
    return generateUUID('short');
  }

  return slug;
};
