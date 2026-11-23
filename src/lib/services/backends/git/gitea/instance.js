import { _ } from '@sveltia/i18n';

import { MIN_FORGEJO_VERSION, MIN_GITEA_VERSION } from '$lib/services/backends/git/gitea/constants';
import { repository } from '$lib/services/backends/git/gitea/repository';
import { apiConfig, fetchAPI } from '$lib/services/backends/git/shared/api';
import { sendRequest } from '$lib/services/utils/networking';

/**
 * Flag to indicate if the backend is Forgejo. This is used to determine which API endpoints to use,
 * as Gitea and Forgejo have different endpoints for fetching file contents.
 * @type {{ isForgejo: boolean }}
 */
export const instance = { isForgejo: false };

/**
 * Gitea’s first major version after 1.x. Gitea jumped from 1.27 to 28.0, while Forgejo, which has
 * used its own major versions since 7.0, won’t reach 28 for years.
 * @see https://blog.gitea.com/tags/release
 * @see https://forgejo.org/releases/
 */
const FIRST_NEW_GITEA_MAJOR_VERSION = 28;

/**
 * Check if the instance is Forgejo by requesting the Forgejo-specific version API endpoint, which
 * Gitea doesn’t have. The endpoint lives next to the regular API root, e.g. `/api/forgejo/v1` next
 * to `/api/v1`, and doesn’t require authentication.
 * @param {number} version Major and minor version number reported by the regular API.
 * @returns {Promise<boolean>} Whether the instance is Forgejo.
 * @see https://codeberg.org/api/swagger#/miscellaneous/getVersion
 */
const probeForgejo = async (version) => {
  const { restBaseURL, includeCredentials } = apiConfig;

  try {
    const url = new URL('../forgejo/v1/version', `${restBaseURL}/`).href;
    const init = includeCredentials ? { credentials: /** @type {const} */ ('include') } : {};

    const { ok, status, redirected } = /** @type {Response} */ (
      await sendRequest(url, init, { responseType: 'raw' })
    );

    // Only a 404 shows that the endpoint is missing; any other error, e.g. 401 on an instance that
    // requires sign-in, is inconclusive, and so is a redirect, e.g. to a sign-in page
    if (!redirected && (ok || status === 404)) {
      return ok;
    }
  } catch {
    // The request failed, e.g. because of a CORS restriction
  }

  // Fall back to the version number
  return version < FIRST_NEW_GITEA_MAJOR_VERSION;
};

/**
 * Check if the version of the user’s Gitea/Forgejo instance is supported. The API endpoint requires
 * authentication, meaning the user must be signed in before calling this function.
 * @throws {Error} When the detected version is unsupported.
 * @see https://docs.gitea.com/api/next/#tag/miscellaneous/operation/getVersion
 */
export const checkInstanceVersion = async () => {
  const { version: versionStr } = /** @type {{ version: string }} */ (await fetchAPI('/version'));
  const version = Number.parseFloat(versionStr);

  // Forgejo version strings typically look like `13.0.3+gitea-1.22.0`, while Gitea’s look like
  // `1.24.0`, `1.27.0+dev-954-g1f3981a301` or `28.0.0`. However, depending on the installation, the
  // fork indicator may not be included (I’ve got `13.0.3` with Homebrew), and both Forgejo and
  // Gitea 28+ use major versions above 1, so ask the instance when the version string is ambiguous
  const isForgejo =
    /\+gitea-/.test(versionStr ?? '') || (version >= 2 && (await probeForgejo(version)));

  const name = isForgejo ? 'Forgejo' : 'Gitea';
  const minVersion = isForgejo ? MIN_FORGEJO_VERSION : MIN_GITEA_VERSION;

  Object.assign(instance, { isForgejo });
  Object.assign(repository, { label: name });

  if (version < minVersion) {
    throw new Error(`Unsupported ${name} version`, {
      cause: new Error(
        _('backend_unsupported_version', {
          values: { name, version: minVersion },
        }),
      ),
    });
  }
};
