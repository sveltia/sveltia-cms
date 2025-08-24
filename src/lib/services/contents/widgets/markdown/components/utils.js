import { flatten, unflatten } from 'flat';

/**
 * Check if the given pattern is multiline.
 * @param {RegExp} pattern Pattern.
 * @returns {boolean} Result.
 */
export const isMultiLinePattern = (pattern) =>
  pattern.multiline || pattern.dotAll || pattern.source.includes('[\\S\\s]');

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
