import base32Encode from 'base32-encode';

/**
 * Truncate the given string.
 * @param {string} string - Original string.
 * @param {number} max - Maximum number of characters.
 * @param {object} [options] - Options.
 * @param {string} [options.ellipsis] - Character(s) to be appended if the the truncated string is
 * longer than `max`.
 * @returns {string} Truncated string.
 */
export const truncate = (string, max, { ellipsis = '…' } = {}) => {
  // Don’t use `split()` because it breaks Unicode characters like emoji
  const chars = [...string];
  const truncated = chars.slice(0, max).join('').trim();

  return `${truncated}${chars.length > max ? ellipsis : ''}`;
};

/**
 * Escape the given string so it can be used safely for `new RegExp()`.
 * @param {string} string - Original string.
 * @returns {string} Escaped string.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
 */
export const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Strip the leading and trailing slashes from the given string.
 * @param {string} string - Original string, e.g. `/foo/bar/`.
 * @returns {string} Trimmed string, e.g. `foo/bar`.
 */
export const stripSlashes = (string) => string.replace(/^\/+/, '').replace(/\/+$/, '');

/**
 * Generate a v4 UUID.
 * @returns {string} UUID like `10f95178-c983-4cfe-91d6-4e62c8c7e582`.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
 */
export const generateUUID = () => window.crypto.randomUUID();

/**
 * Generate a random ID.
 * @returns {string} Generated 26-character string.
 */
export const generateRandomId = () => {
  const hex = generateUUID().replaceAll('-', '');
  const { buffer } = new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));

  return base32Encode(buffer, 'RFC4648', { padding: false }).toLowerCase();
};
