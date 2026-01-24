import { sanitize } from 'isomorphic-dompurify';

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
