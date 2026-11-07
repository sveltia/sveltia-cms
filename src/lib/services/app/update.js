import { UNPKG_BASE_URL, version as userVersion } from '$lib/services/app';
import { getScriptVersionSpec } from '$lib/services/app/dependencies';

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
 * @param {string} [versionSpec] Version range or tag to resolve, e.g. `^1`, as it appears in the
 * script URL. The latest release if omitted or empty.
 * @returns {Promise<string | undefined>} Version, or `undefined` if it couldn’t be fetched.
 */
export const getLatestVersion = async (versionSpec = '') => {
  try {
    const response = await fetch(
      `${UNPKG_BASE_URL}${versionSpec ? `@${versionSpec}` : ''}/package.json`,
    );

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
 * Check whether the given version is newer than the running one. The versions are compared part by
 * part as numbers, so `0.10.0` is newer than `0.9.0`. An older version can be reported right after
 * a release, while the CDN still serves a cached `package.json`, and that’s not an update.
 * @param {string} latestVersion Latest published version, e.g. `1.2.3`.
 * @returns {boolean} Result.
 */
const isNewerVersion = (latestVersion) => {
  const latest = latestVersion.split('.').map(Number);
  const current = userVersion.split('.').map(Number);
  const index = latest.findIndex((part, i) => part !== (current[i] ?? 0));

  return index > -1 && latest[index] > (current[index] ?? 0);
};

/**
 * Check whether a new version of the application is available, and whether a reload would pick it
 * up. It would if the script, classic or module, is loaded from the CDN without the exact version,
 * as long as the new version is within the range in the URL, e.g. `^1`: the URL is resolved the way
 * the CDN would. If it’s pinned in the script tag, a newer release is outside its range or it’s
 * installed via npm, a reload won’t update the instance, so a console warning is shown instead.
 * @returns {Promise<boolean>} `true` if a reload would update the application.
 */
export const isUpdateAvailable = async () => {
  const versionSpec = getScriptVersionSpec();

  if (versionSpec !== undefined) {
    const resolvedVersion = await getLatestVersion(versionSpec);

    if (resolvedVersion && isNewerVersion(resolvedVersion)) {
      return true;
    }

    // Without a version, the URL already serves the latest release
    if (!versionSpec) {
      return false;
    }
  }

  const latestVersion = await getLatestVersion();

  if (!latestVersion || !isNewerVersion(latestVersion)) {
    return false;
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[Sveltia CMS] A new version (${latestVersion}) is available. ` +
      `You are using version ${userVersion}. ` +
      'Update the pinned version in your script tag or package.json to upgrade.',
  );

  return false;
};
