import {
  DEFAULT_AUTH_ROOT,
  FORGEJO_BACKEND_NAME,
} from '$lib/services/backends/git/gitea/constants';
import { getInstanceURL } from '$lib/services/backends/git/shared/repository';

/**
 * @import { ForgejoBackend, GiteaBackend } from '$lib/types/public';
 */

/**
 * Get the OAuth base URL, which is the URL of the Gitea/Forgejo instance, from the backend
 * configuration. The `base_url` option takes precedence. Without it, the Forgejo backend derives
 * the URL from the required `api_root` option, as Decap CMS does, while the Gitea backend falls
 * back to Gitea.com.
 * @param {GiteaBackend | ForgejoBackend} backend Backend configuration.
 * @returns {string} OAuth base URL, e.g. `https://codeberg.org`.
 */
export const getAuthRoot = ({ name, base_url: baseURL, api_root: apiRoot }) =>
  baseURL ??
  (name === FORGEJO_BACKEND_NAME && apiRoot ? getInstanceURL(apiRoot) : DEFAULT_AUTH_ROOT);
