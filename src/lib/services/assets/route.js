import { encodePathSegments } from '$lib/services/utils/url';

/**
 * Folder path of the All Assets folder in the URL, e.g. `/assets/-/all`. The `-` segment can’t be
 * the start of a real folder path, as it’s reserved for the virtual folders.
 */
export const ALL_ASSETS_FOLDER_PATH = '-/all';

/**
 * Regular expression matching the routes of the Asset Library page.
 */
export const ASSETS_ROUTE_REGEX =
  /^\/assets(?:\/(?<folderPath>.+?)(?:\/(?<fileName>[^/]+\.[A-Za-z0-9]+))?)?$/;

/**
 * Parse a URL path of the Asset Library page.
 * @param {string} path URL path, e.g. `/assets/static/uploads/a.png`.
 * @returns {{ folderPath?: string, fileName?: string } | undefined} The folder path and the file
 * name of an asset whose details are shown, or `undefined` if the path belongs to another page.
 */
export const parseAssetsPath = (path) => {
  const groups = path.match(ASSETS_ROUTE_REGEX)?.groups;

  return groups ? { folderPath: groups.folderPath, fileName: groups.fileName } : undefined;
};

/**
 * Get the path of the Asset Library for a folder, or for an asset’s details, encoded for the URL
 * hash.
 * @param {string} [path] Internal folder path, e.g. `static/images`, or an asset’s path. Defaults
 * to the All Assets folder.
 * @returns {string} Path, e.g. `/assets/static/images` or `/assets/-/all`.
 */
export const getAssetLibraryPath = (path = ALL_ASSETS_FOLDER_PATH) =>
  encodePathSegments(`/assets/${path}`);
