import { get } from 'svelte/store';

import { BACKEND_NAME } from '$lib/services/backends/git/github/constants';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { user } from '$lib/services/user';

/**
 * @import { AuthTokens, User } from '$lib/types/private';
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
export const getUserProfile = async ({ token, refreshToken }) => {
  const {
    id,
    name,
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
