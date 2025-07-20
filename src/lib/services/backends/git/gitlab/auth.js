import { get } from 'svelte/store';
import { BACKEND_NAME } from '$lib/services/backends/git/gitlab/constants';
import { apiConfig, fetchAPI } from '$lib/services/backends/git/shared/api';
import {
  handleClientSideAuthPopup,
  initClientSideAuth,
  initServerSideAuth,
} from '$lib/services/backends/git/shared/auth';
import { siteConfig } from '$lib/services/config';
import { user } from '$lib/services/user';

/**
 * @import { AuthTokens, SignInOptions, User } from '$lib/types/private';
 */

/**
 * @typedef {object} UserProfileResponse
 * @property {number} id User ID.
 * @property {string} name User’s full name.
 * @property {string} username User’s login name.
 * @property {string} email User’s email address.
 * @property {string} avatar_url URL to the user’s avatar image.
 * @property {string} web_url URL to the user’s profile page.
 */

/**
 * Retrieve the authenticated user’s profile information from GitLab REST API.
 * @param {AuthTokens} tokens Authentication tokens.
 * @returns {Promise<User>} User information.
 * @see https://docs.gitlab.com/api/users.html#list-current-user
 */
const getUserProfile = async ({ token, refreshToken }) => {
  const {
    id,
    name,
    username: login,
    email,
    avatar_url: avatarURL,
    web_url: profileURL,
  } = /** @type {UserProfileResponse} */ (await fetchAPI('/user', { token, refreshToken }));

  const _user = get(user);

  // Update the tokens because these may have been renewed in `refreshAccessToken` while fetching
  // the user info
  if (_user?.token && _user.token !== token) {
    token = _user.token;
    refreshToken = _user.refreshToken;
  }

  return {
    backendName: BACKEND_NAME,
    id,
    name,
    login,
    email,
    avatarURL,
    profileURL,
    token,
    refreshToken,
  };
};

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
