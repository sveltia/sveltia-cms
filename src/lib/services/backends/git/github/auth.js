import { get } from 'svelte/store';
import { BACKEND_NAME } from '$lib/services/backends/git/github/constants';
import { apiConfig, fetchAPI } from '$lib/services/backends/git/shared/api';
import { initServerSideAuth } from '$lib/services/backends/git/shared/auth';
import { siteConfig } from '$lib/services/config';

/**
 * @import { AuthTokens, SignInOptions, User } from '$lib/types/private';
 */

/**
 * @typedef {object} UserProfileResponse
 * @property {number} id User ID.
 * @property {string} name User’s full name.
 * @property {string} login User’s login name.
 * @property {string} email User’s email address.
 * @property {string} avatar_url URL to the user’s avatar image.
 * @property {string} html_url URL to the user’s profile page.
 */

/**
 * Retrieve the authenticated user’s profile information from GitHub REST API.
 * @param {AuthTokens} tokens Authentication tokens.
 * @returns {Promise<User>} User information.
 * @see https://docs.github.com/en/rest/users/users#get-the-authenticated-user
 */
const getUserProfile = async ({ token }) => {
  const {
    id,
    name,
    login,
    email,
    avatar_url: avatarURL,
    html_url: profileURL,
  } = /** @type {UserProfileResponse} */ (await fetchAPI('/user', { token }));

  return {
    backendName: BACKEND_NAME,
    id,
    name,
    login,
    email,
    avatarURL,
    profileURL,
    token,
  };
};

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
