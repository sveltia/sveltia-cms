import { get } from 'svelte/store';
import { BACKEND_NAME } from '$lib/services/backends/git/gitlab/constants';
import { getUserProfile } from '$lib/services/backends/git/gitlab/user';
import { apiConfig } from '$lib/services/backends/git/shared/api';
import {
  handleClientSideAuthPopup,
  initClientSideAuth,
  initServerSideAuth,
} from '$lib/services/backends/git/shared/auth';
import { siteConfig } from '$lib/services/config';

/**
 * @import { SignInOptions, User } from '$lib/types/private';
 */

/**
 * Retrieve the repository configuration and sign in with GitLab REST API.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup or
 * the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 */
export const signIn = async ({ token, refreshToken, auto = false }) => {
  if (!token) {
    const { site_domain: siteDomain, auth_type: authType } = get(siteConfig)?.backend ?? {};
    const { clientId, authURL, tokenURL } = apiConfig;
    const authArgs = { backendName: BACKEND_NAME, authURL, scope: 'api' };

    if (authType === 'pkce') {
      const inPopup = window.opener?.origin === window.location.origin && window.name === 'auth';

      if (inPopup) {
        // We are in the auth popup window; let’s get the OAuth flow done
        await handleClientSideAuthPopup({ backendName: BACKEND_NAME, clientId, tokenURL });
      }

      if (inPopup || auto) {
        return undefined;
      }

      ({ token, refreshToken } = await initClientSideAuth({ ...authArgs, clientId }));
    } else {
      if (auto) {
        return undefined;
      }

      // @todo Add `refreshToken` support
      ({ token } = await initServerSideAuth({ ...authArgs, siteDomain }));
    }
  }

  return getUserProfile({ token, refreshToken });
};

/**
 * Sign out from GitLab. Nothing to do here.
 * @returns {Promise<void>}
 */
export const signOut = async () => undefined;
