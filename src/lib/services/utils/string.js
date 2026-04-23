import { sanitize } from 'isomorphic-dompurify';

/**
 * Escape a string for safe use as an HTML attribute value inside double quotes. Bare `&` characters
 * are encoded as `&amp;`, but pre-existing HTML entities (e.g. `&amp;`, `&quot;`) are left
 * untouched to avoid double-encoding.
 * @param {string} str Raw string.
 * @returns {string} Escaped string.
 */
export const escapeAttr = (str) =>
  str.replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;').replaceAll('"', '&quot;');

/**
 * Sanitization options for anchor tag links.
 */
const LINK_SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['a'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

/**
 * Replace `<a>` tag in a localization string, and sanitize the result.
 * @param {string} str Localized string containing `<a>` tag.
 * @param {string} href URL to set as the `href` attribute of the `<a>` tag.
 * @returns {string} Linked and sanitized HTML string.
 */
export const makeLink = (str, href) =>
  sanitize(str.replace('<a>', `<a href="${href}" target="_blank">`), LINK_SANITIZE_OPTIONS);
