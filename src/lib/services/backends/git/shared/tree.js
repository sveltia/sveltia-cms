import { getPathInfo } from '@sveltia/utils/file';

/**
 * @import { BaseFileListItemProps } from '$lib/types/private';
 */

/**
 * Convert the entries of a Git tree to a file list, leaving out any entry that isn’t a file, like a
 * subtree or a submodule.
 * @param {{ type: string, path: string, sha: string, size?: number }[]} entries Tree entries.
 * @returns {BaseFileListItemProps[]} File list. The size is `0` if the API doesn’t tell.
 */
export const toFileListItems = (entries) =>
  entries
    .filter(({ type }) => type === 'blob')
    .map(({ path, sha, size = 0 }) => ({ path, sha, size, name: getPathInfo(path).basename }));
