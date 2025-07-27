import { get } from 'svelte/store';

import { BACKEND_NAME } from '$lib/services/backends/git/github/constants';
import { getUserProfile } from '$lib/services/backends/git/github/user';
import { apiConfig } from '$lib/services/backends/git/shared/api';
import { initServerSideAuth } from '$lib/services/backends/git/shared/auth';
import { siteConfig } from '$lib/services/config';

/**
 * @import { SignInOptions, User } from '$lib/types/private';
 */

/**
 * Retrieve the repository configuration and sign in with GitHub REST API.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 * @todo Add `refreshToken` support.
 */
export const signIn = async ({ token, auto = false }) => {
  if (auto && !token) {
    return undefined;
  }

  if (!token) {
    const { site_domain: siteDomain } = get(siteConfig)?.backend ?? {};
    const { authURL } = apiConfig;

    ({ token } = await initServerSideAuth({
      backendName: BACKEND_NAME,
      siteDomain,
      authURL,
      scope: 'repo,user',
    }));
  }

  return getUserProfile({ token });
};

/**
 * Sign out from GitHub. Nothing to do here.
 * @returns {Promise<void>}
 */
export const signOut = async () => undefined;
