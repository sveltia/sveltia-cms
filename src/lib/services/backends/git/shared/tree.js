import { getPathInfo } from '@sveltia/utils/file';

/**
 * @import { BaseFileListItemProps } from '$lib/types/private';
 */

/**
 * Create a file list item for the given path, with the file name derived from it.
 * @param {string} path File path.
 * @param {Partial<Omit<BaseFileListItemProps, 'path' | 'name'>>} [props] Other properties, such as
 * the SHA, size and text. The SHA is an empty string and the size `0` unless given.
 * @returns {BaseFileListItemProps} File list item.
 */
export const toFileListItem = (path, { sha = '', size = 0, ...rest } = {}) => ({
  path,
  name: getPathInfo(path).basename,
  sha,
  size,
  ...rest,
});

/**
 * Convert the entries of a Git tree to a file list, leaving out any entry that isn’t a file, like a
 * subtree or a submodule.
 * @param {{ type: string, path: string, sha: string, size?: number }[]} entries Tree entries.
 * @returns {BaseFileListItemProps[]} File list. The size is `0` if the API doesn’t tell.
 */
export const toFileListItems = (entries) =>
  entries
    .filter(({ type }) => type === 'blob')
    .map(({ path, sha, size }) => toFileListItem(path, { sha, size }));
