import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';

/**
 * Normalize the given string as a slug for a filename.
 * @param {string} string String to be normalized.
 * @returns {string} Slug.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 */
export const normalizeSlug = (string) => {
  const {
    slug: {
      encoding = 'unicode',
      clean_accents: cleanAccents = false,
      sanitize_replacement: sanitizeReplacement = '-',
    } = {},
  } = get(siteConfig);

  let slug = string;

  if (cleanAccents) {
    // Remove any accent @see https://stackoverflow.com/q/990904
    slug = slug.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  if (encoding === 'ascii') {
    slug = slug.replaceAll(/[^\w-~]/g, ' ');
  } else {
    // Allow Unicode letters and numbers @see https://stackoverflow.com/q/280712
    slug = slug.replaceAll(/[^\p{L}\p{N}]/gu, ' ');
  }

  // Make the string lowercase; replace all the spaces with replacers (hyphens by default)
  return slug.toLocaleLowerCase().trim().replaceAll(/\s+/g, sanitizeReplacement);
};
