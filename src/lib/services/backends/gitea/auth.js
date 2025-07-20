import { get } from 'svelte/store';
import { BACKEND_NAME } from '$lib/services/backends/gitea/constants';
import { apiConfig, fetchAPI } from '$lib/services/backends/shared/api';
import { handleClientSideAuthPopup, initClientSideAuth } from '$lib/services/backends/shared/auth';
import { user } from '$lib/services/user';

/**
 * @import { AuthTokens, SignInOptions, User } from '$lib/types/private';
 */

/**
 * @typedef {object} UserProfileResponse
 * @property {number} id User ID.
 * @property {string} full_name User’s full name.
 * @property {string} login User’s login name.
 * @property {string} email User’s email address.
 * @property {string} avatar_url URL to the user’s avatar image.
 * @property {string} html_url URL to the user’s profile page.
 */

/**
 * Retrieve the authenticated user’s profile information.
 * @param {AuthTokens} tokens Authentication tokens.
 * @returns {Promise<User>} User information.
 * @see https://docs.gitea.com/api/next/#tag/user/operation/userGetCurrent
 */
const getUserProfile = async ({ token, refreshToken }) => {
  const {
    id,
    full_name: name,
    login,
    email,
    avatar_url: avatarURL,
    html_url: profileURL,
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
 * Retrieve the repository configuration and sign in with the Gitea/Forgejo REST API.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup or
 * the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 */
export const signIn = async ({ token, refreshToken, auto = false }) => {
  if (!token) {
    const { origin } = window.location;
    const { clientId, authURL, tokenURL } = apiConfig;
    const scope = 'read:repository,write:repository,read:user';
    const inPopup = window.opener?.origin === origin && window.name === 'auth';

    if (inPopup) {
      // We are in the auth popup window; let’s get the OAuth flow done
      await handleClientSideAuthPopup({ backendName: BACKEND_NAME, clientId, tokenURL });
    }

    if (inPopup || auto) {
      return undefined;
    }

    ({ token, refreshToken } = await initClientSideAuth({
      backendName: BACKEND_NAME,
      clientId,
      authURL,
      scope,
    }));
  }

  return getUserProfile({ token, refreshToken });
};

/**
 * Sign out from the backend. Nothing to do here.
 * @returns {Promise<void>}
 */
export const signOut = async () => undefined;
