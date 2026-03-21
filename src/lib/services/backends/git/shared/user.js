import { get } from 'svelte/store';

import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { user } from '$lib/services/user';

/**
 * @import { AuthTokens, User } from '$lib/types/private';
 * @import { BackendName } from '$lib/types/public';
 */

/**
 * @typedef {object} UserFieldMap
 * @property {string} name Response field name for the user’s full name.
 * @property {string} login Response field name for the user’s login name.
 * @property {string} profileURL Response field name for the user’s profile page URL.
 */

/**
 * Retrieve the authenticated user’s profile information from the `/user` REST API endpoint.
 * @param {AuthTokens} tokens Authentication tokens.
 * @param {BackendName | 'local'} backendName Backend name, e.g. `github`.
 * @param {UserFieldMap} fieldMap Mapping of normalized field names to provider-specific response
 * field names.
 * @returns {Promise<User>} User information.
 */
export const fetchUserProfile = async ({ token, refreshToken }, backendName, fieldMap) => {
  const response = /** @type {Record<string, any>} */ (
    await fetchAPI('/user', { token, refreshToken })
  );

  const _user = get(user);

  // Update the tokens because these may have been renewed in `refreshAccessToken` while fetching
  // the user info
  if (_user?.token && _user.token !== token) {
    token = _user.token;
    refreshToken = _user.refreshToken;
  }

  return {
    backendName,
    id: response.id,
    name: response[fieldMap.name],
    login: response[fieldMap.login],
    email: response.email,
    avatarURL: response.avatar_url,
    profileURL: response[fieldMap.profileURL],
    token,
    refreshToken,
  };
};
