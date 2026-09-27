import { _ } from '@sveltia/i18n';

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
  // Forgejo version strings typically look like `13.0.3+gitea-1.22.0`, while Gitea’s look like
  // `1.24.0` or `1.27.0+dev-954-g1f3981a301`. However, depending on the installation, the fork
  // indicator may not be included (I’ve got `13.0.3` with Homebrew) so the major version number is
  // checked as well. Forgejo has used its own major versions since 7.0, while Gitea remains 1.x.x,
  // so anything from version 2 on is Forgejo.
  // @see https://blog.gitea.com/tags/release
  // @see https://forgejo.org/releases/
  const isForgejo = /\+gitea-/.test(versionStr ?? '') || version >= 2;
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
