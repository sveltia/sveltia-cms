/**
 * Helpers for mapping between the paths the CMS uses and the keys an object storage service uses.
 * A service stores every file under a flat key, so a folder is only the common prefix of the keys
 * below it, and the configured `prefix` option is stripped from the paths the CMS sees.
 */

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { AzureMediaLibrary } from '$lib/types/public';
 */

/**
 * Configuration of a cloud storage library. Only the `prefix` option is read here, but the union
 * is named in full rather than structurally: every property of a structural `{ prefix?: string }`
 * would be optional, so the fetch options — which carry no prefix — would satisfy it too, and
 * passing those in place of the configuration would key every object at the container or bucket
 * root instead of under the configured prefix.
 * @typedef {AzureMediaLibrary | S3Config} CloudStorageConfig
 */

/**
 * Get the configured prefix as a directory, with a trailing slash. The option is documented as
 * ending with one, but a prefix without it would otherwise glue itself to the file names and make
 * every path start with a slash, so it’s put right rather than left to break the listing.
 * @param {CloudStorageConfig} config Cloud storage configuration.
 * @returns {string} Prefix, or an empty string for the container or bucket root.
 */
export const getPrefix = ({ prefix = '' }) =>
  prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;

/**
 * Get the key of the placeholder object that keeps an empty folder, which is the folder path with
 * a trailing slash, the way the AWS console and Azure Storage Explorer create a virtual directory.
 * @param {CloudStorageConfig} config Cloud storage configuration.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @returns {string} Object key.
 */
export const getFolderKey = (config, dirPath) => `${getPrefix(config)}${dirPath}/`;

/**
 * Get the key of a file at the given path.
 * @param {CloudStorageConfig} config Cloud storage configuration.
 * @param {string} path File path relative to the configured prefix.
 * @returns {string} Object key.
 */
export const getFileKey = (config, path) => `${getPrefix(config)}${path}`;

/**
 * Get the path of an object relative to the configured prefix.
 * @param {CloudStorageConfig} config Cloud storage configuration.
 * @param {string} key Object key.
 * @returns {string} Path.
 */
export const getRelativeKey = (config, key) => {
  const prefix = getPrefix(config);

  return prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
};

/**
 * Percent-encode an object key for use in a URL path, keeping the path separators intact.
 * @param {string} key Object key.
 * @param {(segment: string) => string} [encodeSegment] Function to encode each path segment.
 * Default: `encodeURIComponent`.
 * @returns {string} Encoded key.
 */
export const encodeKey = (key, encodeSegment = encodeURIComponent) =>
  key
    .split('/')
    .map((segment) => encodeSegment(segment))
    .join('/');
