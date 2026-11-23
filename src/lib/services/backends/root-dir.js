import { cmsConfig } from '$lib/services/config';
import { resolvePath } from '$lib/services/utils/file';

/**
 * @import { FileChange } from '$lib/types/private';
 */

/**
 * Normalize the value of the `root_dir` backend option: the empty segments and `.` segments are
 * dropped, so `/apps/site/`, `./apps/site` and `apps//site` all become `apps/site`, while an empty
 * string, `.` and `/` mean the repository root.
 * @param {unknown} value Option value.
 * @returns {string} Directory path relative to the repository root, without a leading or trailing
 * slash, or an empty string for the repository root.
 */
export const normalizeRootDir = (value) =>
  typeof value === 'string'
    ? value
        .split('/')
        .filter((segment) => segment && segment !== '.')
        .join('/')
    : '';

/**
 * Get the directory the CMS treats as the root of the repository, configured with the `root_dir`
 * backend option. In a monorepo, it’s the directory of the site the CMS is for, and every path the
 * CMS deals with, including the ones in the configuration, is relative to it. The rest of the
 * repository is out of sight.
 * @returns {string} Directory path relative to the repository root, or an empty string when the
 * option isn’t set.
 */
export const getRootDir = () => normalizeRootDir(cmsConfig.current?.backend?.root_dir);

/**
 * Convert a path relative to the root directory to a path relative to the repository root.
 * @param {string} path Path relative to the root directory. It may start with `../` to address a
 * file outside the directory, as {@link fromRepoPath} returns for one.
 * @param {string} [rootDir] Root directory. Default: the configured one.
 * @returns {string} Path relative to the repository root.
 */
export const toRepoPath = (path, rootDir = getRootDir()) =>
  rootDir ? resolvePath(`${rootDir}/${path}`) : path;

/**
 * Convert a path relative to the repository root to a path relative to the root directory. A file
 * outside the directory gets a path starting with `../`, which no entry or asset can have, so it’s
 * never mistaken for one, while {@link toRepoPath} can still turn it back.
 * @param {string} path Path relative to the repository root.
 * @param {string} [rootDir] Root directory. Default: the configured one.
 * @returns {string} Path relative to the root directory.
 */
export const fromRepoPath = (path, rootDir = getRootDir()) => {
  if (!rootDir) {
    return path;
  }

  if (path.startsWith(`${rootDir}/`)) {
    return path.slice(rootDir.length + 1);
  }

  const rootSegments = rootDir.split('/');
  const pathSegments = path.split('/');
  let common = 0;

  while (
    common < rootSegments.length &&
    common < pathSegments.length - 1 &&
    rootSegments[common] === pathSegments[common]
  ) {
    common += 1;
  }

  return [...rootSegments.slice(common).map(() => '..'), ...pathSegments.slice(common)].join('/');
};

/**
 * Check whether the given path, relative to the root directory, addresses a file in the directory.
 * @param {string} path Path returned by {@link fromRepoPath}.
 * @returns {boolean} Result.
 */
export const isInRootDir = (path) => !path.startsWith('../');

/**
 * Convert the paths of the given file changes to paths relative to the repository root.
 * @param {FileChange[]} changes File changes, with paths relative to the root directory.
 * @returns {FileChange[]} New file changes, or the same array when no root directory is configured.
 */
export const toRepoChanges = (changes) => {
  const rootDir = getRootDir();

  if (!rootDir) {
    return changes;
  }

  return changes.map(({ previousPath, ...change }) => ({
    ...change,
    path: toRepoPath(change.path, rootDir),
    ...(previousPath !== undefined && { previousPath: toRepoPath(previousPath, rootDir) }),
  }));
};
