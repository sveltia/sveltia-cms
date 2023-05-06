/**
 * Escape the given string so it can be used safely for `new RegExp()`.
 * @param {string} string Original string.
 * @returns {string} Escaped string.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
 */
export const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Strip the leading and trailing slashes from the given string.
 * @param {string} string Original string, e.g. `/foo/bar/`.
 * @returns {string} Trimmed string, e.g. `foo/bar`.
 */
export const stripSlashes = (string) => string.replace(/^\//, '').replace(/\/$/, '');

/**
 * Generate a v4 UUID.
 * @returns {string} UUID like `10f95178-c983-4cfe-91d6-4e62c8c7e582`.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
 */
export const generateUUID = () => window.crypto.randomUUID();
