import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { MIN_FORGEJO_VERSION, MIN_GITEA_VERSION } from '$lib/services/backends/gitea/constants';
import { repository } from '$lib/services/backends/gitea/repository';
import { fetchAPI } from '$lib/services/backends/shared/api';

/**
 * Flag to indicate if the backend is Forgejo. This is used to determine which API endpoints to use,
 * as Gitea and Forgejo have different endpoints for fetching file contents.
 * @type {{ isForgejo: boolean }}
 */
export const instance = { isForgejo: false };

/**
 * Check if the version of the user’s Gitea/Forgejo instance is supported. The API endpoint requires
 * authentication, meaning the user must be signed in before calling this function.
 * @throws {Error} When the detected version is unsupported.
 * @see https://docs.gitea.com/api/next/#tag/miscellaneous/operation/getVersion
 */
export const checkInstanceVersion = async () => {
  const { version } = /** @type {{ version: string }} */ (await fetchAPI('/version'));
  // Check if the instance is Forgejo by looking for the `+gitea-` fork indicator in the version
  // string. Forgejo versions look like `11.0.1-87-5e379c9+gitea-1.22.0`.
  const isForgejo = version.includes('+gitea-');
  const name = isForgejo ? 'Forgejo' : 'Gitea';
  const minVersion = isForgejo ? MIN_FORGEJO_VERSION : MIN_GITEA_VERSION;

  Object.assign(instance, { isForgejo });
  Object.assign(repository, { label: name });

  if (Number.parseFloat(version) < minVersion) {
    throw new Error(`Unsupported ${name} version`, {
      cause: new Error(
        get(_)('backend_unsupported_version', {
          values: { name, version: minVersion },
        }),
      ),
    });
  }
};
