import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { MIN_FORGEJO_VERSION, MIN_GITEA_VERSION } from '$lib/services/backends/git/gitea/constants';
import { repository } from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';

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
  const { version: versionStr } = /** @type {{ version: string }} */ (await fetchAPI('/version'));
  const version = Number.parseFloat(versionStr);
  // Forgejo version strings typically look like `13.0.3+gitea-1.22.0`. However, depending on the
  // installation, the fork indicator may not be included (I’ve got `13.0.3` with Homebrew) so we
  // just check the numeric major version number. Forgejo is now 1x.x.x while Gitea remains 1.x.x so
  // it’s safe to assume anything above version 10 is Forgejo.
  // @see https://blog.gitea.com/tags/release
  // @see https://forgejo.org/releases/
  const isForgejo = version > 10;
  const name = isForgejo ? 'Forgejo' : 'Gitea';
  const minVersion = isForgejo ? MIN_FORGEJO_VERSION : MIN_GITEA_VERSION;

  Object.assign(instance, { isForgejo });
  Object.assign(repository, { label: name });

  if (version < minVersion) {
    throw new Error(`Unsupported ${name} version`, {
      cause: new Error(
        get(_)('backend_unsupported_version', {
          values: { name, version: minVersion },
        }),
      ),
    });
  }
};
