import { sanitize } from 'isomorphic-dompurify';
import { parseInline } from 'marked';

/**
 * Check if a value is a non-empty string.
 * @param {any} value Value to check.
 * @returns {value is string} Whether the value is a non-empty string.
 */
export const isNonEmptyString = (value) => typeof value === 'string' && !!value.trim();

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
 * Characters that have to be escaped for plain text to be read as such within HTML.
 * @type {Record<string, string>}
 */
const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/**
 * Escape plain text so that it’s read as text rather than markup within HTML, e.g. a literal `<b>`
 * or `&amp;`, for example by a translator taking HTML.
 * @param {string} text Plain text.
 * @returns {string} Escaped text.
 */
export const escapeHTML = (text) => text.replace(/[&<>]/g, (char) => HTML_ESCAPE_MAP[char]);

/**
 * Sanitization options for anchor tag links.
 */
export const LINK_SANITIZE_OPTIONS = {
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
  sanitize(
    str.replace('<a>', `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">`),
    LINK_SANITIZE_OPTIONS,
  );

/**
 * Parse the given string as inline Markdown and sanitize the result to only allow certain tags.
 * @param {string} str Original string.
 * @param {object} [options] Options.
 * @param {string[]} [options.allowedTags] Allowed HTML tags. Defaults to the basic inline
 * formatting tags and links.
 * @param {string[]} [options.allowedAttr] Allowed HTML attributes. Defaults to `href`.
 * @returns {string} Sanitized HTML string.
 */
export const sanitizeInlineMarkdown = (
  str,
  { allowedTags = ['strong', 'em', 'del', 'code', 'a'], allowedAttr = ['href'] } = {},
) =>
  sanitize(/** @type {string} */ (parseInline(str)), {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttr,
  });
