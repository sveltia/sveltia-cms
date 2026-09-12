import { UNPKG_BASE_URL, version as userVersion } from '$lib/services/app';

/**
 * URL of the `package.json` of the latest published version.
 */
const PACKAGE_JSON_URL = `${UNPKG_BASE_URL}/package.json`;
/**
 * URL of the script that loads the latest version, as opposed to one pinned to a version.
 */
const SCRIPT_URL = `${UNPKG_BASE_URL}/dist/sveltia-cms.js`;

/**
 * How often to check for a new version.
 */
export const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * How long to wait before offering a reload once a new version has been found. Redirects are
 * cached by the UNPKG CDN, so an older script may still be served right after a release, and the
 * notification would persist when the user reloads the page.
 * @see https://unpkg.com/#cache-behavior
 */
export const UPDATE_CACHE_TIMEOUT = 10 * 60 * 1000; // 10 min

/**
 * Get the latest published version of the application.
 * @returns {Promise<string | undefined>} Version, or `undefined` if it couldn’t be fetched.
 */
export const getLatestVersion = async () => {
  try {
    const response = await fetch(PACKAGE_JSON_URL);

    if (!response.ok) {
      return undefined;
    }

    const { version } = await response.json();

    return typeof version === 'string' && version ? version : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Check whether a new version of the application is available, and whether a reload would pick it
 * up. It would if the script is loaded from the CDN without a version pinned. If it’s pinned in the
 * script tag or installed via npm, a reload won’t update the instance, so a console warning is
 * shown instead.
 * @returns {Promise<boolean>} `true` if a reload would update the application.
 */
export const isUpdateAvailable = async () => {
  const latestVersion = await getLatestVersion();

  if (!latestVersion || latestVersion === userVersion) {
    return false;
  }

  if (document.querySelector(`script[src="${SCRIPT_URL}"]`)) {
    return true;
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[Sveltia CMS] A new version (${latestVersion}) is available. ` +
      'Update the pinned version in your script tag or package.json to upgrade.',
  );

  return false;
};
