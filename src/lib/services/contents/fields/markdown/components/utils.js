import { flatten, unflatten } from 'flat';

/**
 * Check if the given pattern is multiline.
 * @param {RegExp} pattern Pattern.
 * @returns {boolean} Result.
 */
export const isMultiLinePattern = ({ multiline, dotAll, source }) =>
  multiline || dotAll || source.includes('[\\s\\S]') || source.includes('[\\S\\s]');

/**
 * Normalize properties by removing internal properties.
 * @param {Record<string, any>} props Properties to normalize.
 * @returns {Record<string, any>} Properties excluding those starting with `__sc_`, which are used
 * for internal purposes.
 */
export const normalizeProps = (props) =>
  unflatten(
    Object.fromEntries(
      Object.entries(flatten(props)).filter(([key]) => !key.split('.').pop()?.startsWith('__sc_')),
    ),
  );

/**
 * Replace double quotes with single quotes to avoid breaking Markdown syntax.
 * @param {string} str String to escape.
 * @returns {string} Escaped string.
 */
export const replaceQuotes = (str) => str.replace(/"/g, "'");

/**
 * Encode double quotes as HTML entities to prevent issues in HTML rendering.
 * @param {string} str String to escape.
 * @returns {string} Escaped string.
 */
export const encodeQuotes = (str) => str.replace(/"/g, '&quot;');
