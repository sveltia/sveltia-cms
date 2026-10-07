/**
 * Names of the folders the CMS itself is usually served from, e.g. `static/admin/index.html` along
 * with its `config.yml`. With a media folder at the root of the public folder, such as `static` or
 * `public`, those files are listed as assets, and replacing the admin page would hand the next
 * user’s sign-in to whoever wrote it. So the files in such a folder are read-only in the Asset
 * Library, and no asset change made through the CMS can touch them. Deployment configuration such
 * as `_redirects` can be edited as an entry of a file collection, so it isn’t ruled out here.
 */
export const CMS_FOLDER_NAMES = ['admin', 'cms'];

/**
 * Check whether the given folder name is one the CMS itself is usually served from.
 * @param {string} name Folder name.
 * @returns {boolean} Result.
 */
export const isCmsFolderName = (name) => CMS_FOLDER_NAMES.includes(name.normalize().toLowerCase());

/**
 * Check whether the given folder is, or is below, a folder the CMS itself is usually served from.
 * @param {string} dirPath Folder path. An empty string for the root.
 * @returns {boolean} Result.
 */
export const isCmsFolderPath = (dirPath) => dirPath.split('/').some(isCmsFolderName);

/**
 * Check whether the given file is below a folder the CMS itself is usually served from.
 * @param {string} path File path.
 * @returns {boolean} Result.
 */
export const isInCmsFolder = (path) =>
  isCmsFolderPath(path.slice(0, Math.max(path.lastIndexOf('/'), 0)));

/**
 * Make sure none of the given files is below a folder the CMS itself is usually served from. The
 * Asset Library doesn’t offer to change those files, so this is only a safeguard.
 * @param {string[]} paths File paths.
 * @throws {Error} When one of them is.
 */
export const assertOutsideCmsFolders = (paths) => {
  if (paths.some(isInCmsFolder)) {
    throw new Error('Cannot change a file in a folder the CMS is served from');
  }
};
